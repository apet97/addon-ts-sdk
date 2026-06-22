import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const workspace = mkdtempSync(join(tmpdir(), "clockify-addon-sdk-consumer-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function packTarball() {
  const output = run("npm", [
    "pack",
    "--ignore-scripts",
    "--pack-destination",
    workspace,
    "--json",
  ]);
  const parsed = JSON.parse(output);
  return join(workspace, parsed[0].filename);
}

function prepareConsumer(name, type, tarball) {
  const dir = join(workspace, name);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ private: true, type, dependencies: {} }, null, 2),
    "utf8",
  );
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: dir,
    stdio: "inherit",
  });
  return dir;
}

function runEsmConsumer(dir) {
  const script = join(dir, "smoke.mjs");
  writeFileSync(
    script,
    `import assert from "node:assert/strict";
import { ClockifyAddon, ClockifyComponent, ClockifyManifest, createClockifyNumberSetting, generated, testing, withClockifyVerifiedComponentRequest } from "@apet97/clockify-addon-sdk";
import * as clockify from "@apet97/clockify-addon-sdk/clockify";
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters";
import { generateTestKeys } from "@apet97/clockify-addon-sdk/testing";

assert.equal(typeof ClockifyAddon, "function");
assert.equal(typeof ClockifyManifest.v1_5Builder, "function");
assert.equal(typeof generated.v1_5.ClockifyManifestBuilder, "function");
assert.equal(typeof clockify.verifyClockifyLifecycleRequest, "function");
assert.equal(typeof clockify.createClockifyTextSetting, "function");
assert.equal(typeof createClockifyNumberSetting, "function");
assert.equal(typeof withClockifyVerifiedComponentRequest, "function");
assert.equal(typeof testing.signTestToken, "function");
assert.equal(typeof generateTestKeys, "function");

const manifest = ClockifyManifest.v1_5Builder()
  .key("packed-consumer-addon")
  .name("Packed Consumer Add-on")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .build();
const addon = new ClockifyAddon(manifest);
addon.registerComponent(
  ClockifyComponent.v1_5Builder().activityTab().allowAdmins().path("/component").label("Component").build(),
  () => ({ status: 200, body: "ok" }),
);

const server = createNodeHttpAddonServer(addon);
const port = await new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
try {
  const res = await fetch(\`http://127.0.0.1:\${port}/manifest\`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, "packed-consumer-addon");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
`,
    "utf8",
  );
  run(process.execPath, [script], { cwd: dir, stdio: "inherit" });
}

function runCjsConsumer(dir) {
  const script = join(dir, "smoke.cjs");
  writeFileSync(
    script,
    `const assert = require("node:assert/strict");
const sdk = require("@apet97/clockify-addon-sdk");
const clockify = require("@apet97/clockify-addon-sdk/clockify");
const adapters = require("@apet97/clockify-addon-sdk/adapters");
const testing = require("@apet97/clockify-addon-sdk/testing");

assert.equal(typeof sdk.ClockifyAddon, "function");
assert.equal(typeof sdk.ClockifyManifest.v1_5Builder, "function");
assert.equal(typeof sdk.generated.v1_5.ClockifyManifestBuilder, "function");
assert.equal(typeof clockify.verifyClockifyLifecycleRequest, "function");
assert.equal(typeof clockify.createClockifyTextSetting, "function");
assert.equal(typeof sdk.createClockifyNumberSetting, "function");
assert.equal(typeof sdk.withClockifyVerifiedComponentRequest, "function");
assert.equal(typeof adapters.createNodeHttpAddonServer, "function");
assert.equal(typeof testing.signTestToken, "function");
`,
    "utf8",
  );
  run(process.execPath, [script], { cwd: dir, stdio: "inherit" });
}

try {
  const tarball = packTarball();
  mkdirSync(join(workspace, "esm-consumer"), { recursive: true });
  mkdirSync(join(workspace, "cjs-consumer"), { recursive: true });
  runEsmConsumer(prepareConsumer("esm-consumer", "module", tarball));
  runCjsConsumer(prepareConsumer("cjs-consumer", "commonjs", tarball));
  console.log("verify:package-consumer OK - packed tarball imports in ESM and CJS consumers.");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
