import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const workspace = mkdtempSync(join(tmpdir(), "clockify-addon-sdk-consumer-"));
const require = createRequire(import.meta.url);
const tscBin = require.resolve("typescript/bin/tsc");
const nodeTypesPackage = dirname(require.resolve("@types/node/package.json"));
const undiciTypesPackage = dirname(require.resolve("undici-types/package.json"));
const typesRoot = join(workspace, "types");
const tempNodeModules = join(workspace, "node_modules");
mkdirSync(typesRoot, { recursive: true });
mkdirSync(tempNodeModules, { recursive: true });
cpSync(nodeTypesPackage, join(typesRoot, "node"), { recursive: true });
cpSync(undiciTypesPackage, join(tempNodeModules, "undici-types"), { recursive: true });

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
import { ClockifyAddon, ClockifyComponent, ClockifyManifest, ClockifySignatureParser, createClockifyNumberSetting, generated, testing, withClockifyVerifiedComponentRequest } from "@apet97/clockify-addon-sdk";
import * as clockify from "@apet97/clockify-addon-sdk/clockify";
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters";
import { generateTestKeys } from "@apet97/clockify-addon-sdk/testing";
import schema15 from "@apet97/clockify-addon-sdk/schemas/clockify-manifests/1.5.json" with { type: "json" };
import schemaProvenance from "@apet97/clockify-addon-sdk/schemas/clockify-manifests/provenance.json" with { type: "json" };

assert.equal(typeof ClockifyAddon, "function");
assert.equal(typeof ClockifyManifest.v1_5Builder, "function");
assert.equal(typeof generated.v1_5.ClockifyManifestBuilder, "function");
assert.equal(typeof clockify.verifyClockifyLifecycleRequest, "function");
assert.equal(typeof clockify.createClockifyTextSetting, "function");
assert.equal(typeof createClockifyNumberSetting, "function");
assert.equal(typeof withClockifyVerifiedComponentRequest, "function");
assert.equal(typeof testing.signTestToken, "function");
assert.equal(typeof generateTestKeys, "function");
assert.equal(schema15.version, "1.5");
assert.equal(schemaProvenance.schemas["1.5"].file, "1.5.json");

const esmKeys = await testing.generateTestKeys();
const esmToken = await testing.signTestToken(esmKeys.privateKey, "packed-consumer-addon", {
  workspaceId: "workspace-esm",
});
const esmClaims = await new ClockifySignatureParser(
  "packed-consumer-addon",
  esmKeys.publicKey,
).parseClaims(esmToken);
assert.equal(esmClaims.workspaceId, "workspace-esm");

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
const schema15 = require("@apet97/clockify-addon-sdk/schemas/clockify-manifests/1.5.json");
const schemaProvenance = require("@apet97/clockify-addon-sdk/schemas/clockify-manifests/provenance.json");

(async () => {
  assert.equal(typeof sdk.ClockifyAddon, "function");
  assert.equal(typeof sdk.ClockifyManifest.v1_5Builder, "function");
  assert.equal(typeof sdk.generated.v1_5.ClockifyManifestBuilder, "function");
  assert.equal(typeof clockify.verifyClockifyLifecycleRequest, "function");
  assert.equal(typeof clockify.createClockifyTextSetting, "function");
  assert.equal(typeof sdk.createClockifyNumberSetting, "function");
  assert.equal(typeof sdk.withClockifyVerifiedComponentRequest, "function");
  assert.equal(typeof adapters.createNodeHttpAddonServer, "function");
  assert.equal(typeof testing.signTestToken, "function");
  assert.equal(schema15.version, "1.5");
  assert.equal(schemaProvenance.schemas["1.5"].file, "1.5.json");

  const cjsKeys = await testing.generateTestKeys();
  const cjsToken = await testing.signTestToken(cjsKeys.privateKey, "packed-consumer-addon", {
    workspaceId: "workspace-cjs",
  });
  const cjsClaims = await new sdk.ClockifySignatureParser(
    "packed-consumer-addon",
    cjsKeys.publicKey,
  ).parseClaims(cjsToken);
  assert.equal(cjsClaims.workspaceId, "workspace-cjs");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`,
    "utf8",
  );
  run(process.execPath, [script], { cwd: dir, stdio: "inherit" });
}

function runTypeScriptConsumer(dir) {
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2022"],
          strict: true,
          noEmit: true,
          resolveJsonModule: true,
          skipLibCheck: false,
          typeRoots: [typesRoot],
          types: ["node"],
        },
        include: ["smoke.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    join(dir, "smoke.ts"),
    `import {
  ClockifyAddon,
  ClockifyComponent,
  ClockifyManifest,
  createClockifyNumberSetting,
  generated,
  testing,
  withClockifyVerifiedComponentRequest,
  type ClockifyVerifiedWebhookRequestOptions,
} from "@apet97/clockify-addon-sdk";
import * as clockify from "@apet97/clockify-addon-sdk/clockify";
import { createNodeHttpAddonServer, handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters";
import { generateTestKeys } from "@apet97/clockify-addon-sdk/testing";
import schema15 from "@apet97/clockify-addon-sdk/schemas/clockify-manifests/1.5.json" with { type: "json" };
import schemaProvenance from "@apet97/clockify-addon-sdk/schemas/clockify-manifests/provenance.json" with { type: "json" };

const manifest = ClockifyManifest.v1_5Builder()
  .key("typed-consumer-addon")
  .name("Typed Consumer Add-on")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .build();
const addon = new ClockifyAddon(manifest);
addon.registerComponent(
  ClockifyComponent.v1_5Builder().activityTab().allowAdmins().path("/component").label("Component").build(),
  withClockifyVerifiedComponentRequest(
    clockify.createClockifySignatureParser("typed-consumer-addon"),
    async (_request, claims) => ({ status: 200, body: { user: claims.user } }),
  ),
);

const fixedWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
};

const lookupWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  getExpectedWebhookAuthToken: () => "stored-token",
};

// @ts-expect-error webhook wrappers must choose either a fixed token or a lookup, not both
const ambiguousWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
  getExpectedWebhookAuthToken: () => "stored-token",
};

void createClockifyNumberSetting({ id: "n", name: "Number", accessLevel: "ADMINS", value: 1 });
void generated.v1_5.ClockifyManifestBuilder;
void testing.signTestToken;
void generateTestKeys;
void createNodeHttpAddonServer(addon);
void handleFetchRequest;
void schema15.version;
void schemaProvenance.supportedVersions;
void fixedWebhookOptions;
void lookupWebhookOptions;
void ambiguousWebhookOptions;
`,
    "utf8",
  );
  run(process.execPath, [tscBin, "-p", "tsconfig.json", "--noEmit"], {
    cwd: dir,
    stdio: "inherit",
  });
}

try {
  const tarball = packTarball();
  mkdirSync(join(workspace, "esm-consumer"), { recursive: true });
  mkdirSync(join(workspace, "cjs-consumer"), { recursive: true });
  mkdirSync(join(workspace, "ts-consumer"), { recursive: true });
  runEsmConsumer(prepareConsumer("esm-consumer", "module", tarball));
  runCjsConsumer(prepareConsumer("cjs-consumer", "commonjs", tarball));
  runTypeScriptConsumer(prepareConsumer("ts-consumer", "module", tarball));
  console.log(
    "verify:package-consumer OK - packed tarball imports in ESM and CJS consumers, signs/verifies test tokens, and type-checks in a TypeScript consumer.",
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
