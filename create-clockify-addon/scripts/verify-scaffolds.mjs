import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { inspectRuntimeJavaScript } from "../../scripts/javascript-runtime-inspection.mjs";
import {
  createChildClosePromise,
  parseWorkerManifest,
  terminateChildProcessTree,
} from "./scaffold-runtime-helpers.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const temp = mkdtempSync(join(tmpdir(), "clockify-addon-scaffolds-"));
const variants = [
  { name: "node-minimal", runtime: "node", features: "minimal" },
  { name: "node-all", runtime: "node", features: "all" },
  { name: "worker-minimal", runtime: "worker", features: "minimal" },
  { name: "worker-all", runtime: "worker", features: "all" },
];

function packWorkspace(workspace) {
  const output = execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--pack-destination",
      temp,
      "--json",
      "-w",
      workspace,
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const [{ filename } = {}] = JSON.parse(output);
  if (!filename)
    throw new Error(`Packed ${workspace} tarball was not created.`);
  return join(temp, filename);
}

function installPackedCreator(tarball) {
  const directory = join(temp, "creator-runner");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2) + "\n",
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    {
      cwd: directory,
      stdio: "inherit",
    },
  );
  const script = join(directory, "create-project.mjs");
  writeFileSync(
    script,
    `import { scaffoldClockifyAddon } from "create-clockify-addon";

const [directory, runtime, features, sdkSpec] = process.argv.slice(2);
await scaffoldClockifyAddon({ directory, runtime, features, sdkSpec });
`,
  );
  return script;
}

function runtimeProbeSource({ runtime, features }) {
  const expectedLifecycle = features === "all" ? 2 : 0;
  const expectedWebhooks = features === "all" ? 1 : 0;
  const runtimeProbe =
    runtime === "node"
      ? `const { startNodeAddon } = await import("./src/index.ts");
assert.equal(typeof startNodeAddon, "function");
assert.throws(() => startNodeAddon({ PORT: "0" }), /PUBLIC_BASE_URL/);

const server = startNodeAddon({ ...environment, PORT: "0" });
if (!server.listening) await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
try {
  await verifyResponses((path) => fetch(\`http://127.0.0.1:\${address.port}\${path}\`));
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}`
      : `const { default: worker } = await import("./src/index.ts");
assert.equal(typeof worker.fetch, "function");
assert.throws(
  () => worker.fetch(new Request("https://request.example/manifest"), {}),
  /PUBLIC_BASE_URL/,
);
await verifyResponses((path) =>
  worker.fetch(new Request(\`https://request.example\${path}\`), environment),
);`;

  return `import assert from "node:assert/strict";
import { once } from "node:events";

import { validateClockifyManifest } from "@apet97/clockify-addon-sdk";

const environment = {
  PUBLIC_BASE_URL: "https://generated-addon.example",
  CLOCKIFY_PARENT_ORIGIN: "https://app.clockify.me",
  ALLOW_LOCAL_REQUEST_ORIGIN: "false",
  ALLOW_EPHEMERAL_STORAGE: "false",
};

async function verifyResponses(request) {
  const manifestResponse = await request("/manifest");
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  const validation = validateClockifyManifest(manifest);
  assert.equal(validation.ok, true, JSON.stringify(validation));
  assert.equal(manifest.components?.length ?? 0, 1);
  assert.equal(manifest.lifecycle?.length ?? 0, ${expectedLifecycle});
  assert.equal(manifest.webhooks?.length ?? 0, ${expectedWebhooks});

  const missingResponse = await request("/missing");
  assert.equal(missingResponse.status, 404);
  const componentResponse = await request("/component");
  assert.equal(componentResponse.status, 401);
}

${runtimeProbe}
`;
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a local port for Wrangler.");
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

function captureChildOutput(child) {
  let output = "";
  const append = (chunk) => {
    output = `${output}${chunk}`.slice(-32_000);
  };
  child.stdout.setEncoding("utf8").on("data", append);
  child.stderr.setEncoding("utf8").on("data", append);
  return () => output;
}

async function waitForWorker(origin, child, readOutput, readSpawnError) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const spawnError = readSpawnError();
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Wrangler exited before becoming ready.\n${readOutput()}`,
      );
    }
    try {
      await fetch(`${origin}/manifest`, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(
    `Timed out waiting for Wrangler at ${origin}.\n${readOutput()}`,
  );
}

async function verifyWorkerThroughWrangler(directory, variant) {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const wrangler = join(
    directory,
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  const child = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "src/index.ts",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--compatibility-date",
      "2026-07-12",
      "--var",
      "PUBLIC_BASE_URL:https://generated-addon.example",
      "--var",
      "CLOCKIFY_PARENT_ORIGIN:https://app.clockify.me",
      "--var",
      "ALLOW_LOCAL_REQUEST_ORIGIN:false",
      "--var",
      "ALLOW_EPHEMERAL_STORAGE:false",
    ],
    {
      cwd: directory,
      detached: process.platform !== "win32",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const processGroupId = process.platform === "win32" ? undefined : child.pid;
  const closed = createChildClosePromise(child);
  const readOutput = captureChildOutput(child);
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });

  const request = async (path, expectedStatus) => {
    const response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.text();
    if (response.status !== expectedStatus) {
      throw new Error(
        `${variant.name} ${path}: expected HTTP ${expectedStatus}, received ${response.status}.\n` +
          `Body: ${body}\nWrangler output:\n${readOutput()}`,
      );
    }
    return body;
  };

  try {
    await waitForWorker(origin, child, readOutput, () => spawnError);
    const manifestBody = await request("/manifest", 200);
    parseWorkerManifest(manifestBody, variant, readOutput());
    await request("/missing", 404);
    await request("/component", 401);
    console.log(
      `${variant.name}: real workerd routes returned /manifest 200, /missing 404, /component 401.`,
    );
  } finally {
    await terminateChildProcessTree(child, closed, { processGroupId });
  }
}

function filesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(fullPath) : [fullPath];
  });
}

function verifyWorkerBundle(bundleDirectory, variant) {
  const javascriptFiles = filesRecursively(bundleDirectory).filter((file) =>
    file.endsWith(".js"),
  );
  if (javascriptFiles.length === 0) {
    throw new Error(
      `${variant.name}: Wrangler dry-run did not emit a JavaScript bundle.`,
    );
  }
  for (const file of javascriptFiles) {
    const findings = inspectRuntimeJavaScript(readFileSync(file, "utf8"));
    if (findings.length > 0) {
      const details = findings
        .map(
          (finding) =>
            `${finding.kind} at ${finding.line}:${finding.column + 1} (${finding.message})`,
        )
        .join(", ");
      throw new Error(
        `${variant.name}: bundled Worker contains forbidden runtime syntax in ${file}: ${details}.`,
      );
    }
  }
  console.log(
    `${variant.name}: bundled Worker contains no runtime AJV compiler or string eval.`,
  );
}

try {
  const tarball = packWorkspace("@apet97/clockify-addon-sdk");
  const creatorTarball = packWorkspace("create-clockify-addon");
  const creatorRunner = installPackedCreator(creatorTarball);

  for (const variant of variants) {
    const directory = join(temp, variant.name);
    execFileSync(process.execPath, [
      creatorRunner,
      directory,
      variant.runtime,
      variant.features,
      `file:${tarball}`,
    ]);
    execFileSync(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      {
        cwd: directory,
        stdio: "inherit",
      },
    );
    execFileSync("npm", ["run", "typecheck"], {
      cwd: directory,
      stdio: "inherit",
    });
    if (variant.runtime === "worker") {
      const bundleDirectory = join(directory, ".wrangler-verify-bundle");
      execFileSync(
        "npm",
        [
          "exec",
          "--",
          "wrangler",
          "deploy",
          "src/index.ts",
          "--name",
          variant.name,
          "--compatibility-date",
          "2026-07-12",
          "--outdir",
          bundleDirectory,
          "--dry-run",
        ],
        {
          cwd: directory,
          env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
          stdio: "inherit",
        },
      );
      verifyWorkerBundle(bundleDirectory, variant);
      await verifyWorkerThroughWrangler(directory, variant);
    }
    const probe = join(directory, "verify-runtime.mjs");
    writeFileSync(probe, runtimeProbeSource(variant));
    execFileSync(process.execPath, [tsxCli, probe], {
      cwd: directory,
      stdio: "inherit",
    });
  }

  console.log(
    "verify:scaffolds OK - packed creator and SDK execute Node/Worker minimal/all projects with valid manifests, real workerd routes, Worker dry-runs, and fail-closed routes.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
