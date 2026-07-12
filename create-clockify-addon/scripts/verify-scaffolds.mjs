import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
          "--dry-run",
        ],
        {
          cwd: directory,
          env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
          stdio: "inherit",
        },
      );
    }
    const probe = join(directory, "verify-runtime.mjs");
    writeFileSync(probe, runtimeProbeSource(variant));
    execFileSync(process.execPath, [tsxCli, probe], {
      cwd: directory,
      stdio: "inherit",
    });
  }

  console.log(
    "verify:scaffolds OK - packed creator and SDK execute Node/Worker minimal/all projects with valid manifests, Worker dry-runs, and fail-closed routes.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
