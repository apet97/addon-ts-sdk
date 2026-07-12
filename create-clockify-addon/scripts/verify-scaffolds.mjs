import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { scaffoldClockifyAddon } from "../src/index.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const temp = mkdtempSync(join(tmpdir(), "clockify-addon-scaffolds-"));
const variants = [
  { name: "node-minimal", runtime: "node", features: "minimal" },
  { name: "node-all", runtime: "node", features: "all" },
  { name: "worker-minimal", runtime: "worker", features: "minimal" },
  { name: "worker-all", runtime: "worker", features: "all" },
];

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
  execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--pack-destination",
      temp,
      "-w",
      "@apet97/clockify-addon-sdk",
    ],
    { cwd: root, stdio: "inherit" },
  );
  const tarballName = readdirSync(temp).find((name) => name.endsWith(".tgz"));
  if (!tarballName) throw new Error("Packed SDK tarball was not created.");
  const tarball = join(temp, tarballName);

  for (const variant of variants) {
    const directory = join(temp, variant.name);
    await scaffoldClockifyAddon({
      directory,
      runtime: variant.runtime,
      features: variant.features,
      sdkSpec: `file:${tarball}`,
    });
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: directory,
      stdio: "inherit",
    });
    execFileSync("npm", ["run", "typecheck"], {
      cwd: directory,
      stdio: "inherit",
    });
    const probe = join(directory, "verify-runtime.mjs");
    writeFileSync(probe, runtimeProbeSource(variant));
    execFileSync(process.execPath, [tsxCli, probe], {
      cwd: directory,
      stdio: "inherit",
    });
  }

  console.log(
    "verify:scaffolds OK - packed SDK executes Node and Worker minimal/all projects with valid manifests and fail-closed routes.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
