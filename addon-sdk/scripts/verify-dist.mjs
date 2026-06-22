// Smoke-tests the BUILT package (dist/), not the TypeScript sources.
//
// Regression guard for the "ESM build emits CommonJS mislabeled as ESM" bug: every existing test
// runs against src/ via vitest, so a broken dist/ shipped green. This imports the emitted ESM and
// CJS entry points the way a consumer does, asserts the public API resolves, and boots the README
// quick-start server end-to-end. Run after `npm run build`; wired into `prepack`.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const require = createRequire(import.meta.url);

const fail = (msg) => {
  console.error("verify:dist FAILED — " + msg);
  process.exit(1);
};
const expectFn = (label, v) => {
  if (typeof v !== "function") fail(`${label} is not a function (got ${typeof v})`);
};
const expectObj = (label, v) => {
  if (v === null || typeof v !== "object") fail(`${label} is not an object (got ${typeof v})`);
};

// --- 1. The emitted ESM entry must expose the public API as real named exports. ---
const esm = await import(path.join(dist, "esm", "index.js")).catch((e) =>
  fail("ESM import threw: " + e.message),
);
const esmAdapters = await import(path.join(dist, "esm", "adapters", "index.js")).catch((e) =>
  fail("ESM /adapters import threw: " + e.message),
);
for (const name of [
  "ClockifyAddon",
  "ClockifyManifest",
  "ClockifyComponent",
  "ClockifyScope",
  "ClockifySignatureParser",
]) {
  if (!(name in esm)) fail(`ESM build is missing named export '${name}'`);
}
expectFn("esm.ClockifyAddon", esm.ClockifyAddon);
expectFn("esm.ClockifyManifest.v1_4Builder", esm.ClockifyManifest.v1_4Builder);
expectFn("esm.ClockifyComponent.v1_4Builder", esm.ClockifyComponent.v1_4Builder);
expectObj("esm.ClockifyScope", esm.ClockifyScope);
if (esm.ClockifyScope.PROJECT_READ !== "PROJECT_READ")
  fail("esm.ClockifyScope.PROJECT_READ missing");
expectFn("esm /adapters createNodeHttpAddonServer", esmAdapters.createNodeHttpAddonServer);

// All four subpath entry points (".", "./clockify", "./adapters", "./testing") must load as ESM.
const esmClockify = await import(path.join(dist, "esm", "clockify", "index.js")).catch((e) =>
  fail("ESM /clockify import threw: " + e.message),
);
const esmTesting = await import(path.join(dist, "esm", "testing", "index.js")).catch((e) =>
  fail("ESM /testing import threw: " + e.message),
);
expectFn("esm /clockify ClockifyAddon", esmClockify.ClockifyAddon);
expectFn("esm /testing generateTestKeys", esmTesting.generateTestKeys);
expectFn("esm root testing.signTestToken", esm.testing && esm.testing.signTestToken);

// --- 2. The emitted CJS entry must expose the same API via require(). ---
const cjs = require(path.join(dist, "cjs", "index.js"));
const cjsAdapters = require(path.join(dist, "cjs", "adapters", "index.js"));
const cjsClockify = require(path.join(dist, "cjs", "clockify", "index.js"));
const cjsTesting = require(path.join(dist, "cjs", "testing", "index.js"));
for (const name of [
  "ClockifyAddon",
  "ClockifyManifest",
  "ClockifyComponent",
  "ClockifyScope",
  "ClockifySignatureParser",
]) {
  if (!(name in cjs)) fail(`CJS build is missing export '${name}'`);
}
expectFn("cjs.ClockifyAddon", cjs.ClockifyAddon);
expectFn("cjs /adapters createNodeHttpAddonServer", cjsAdapters.createNodeHttpAddonServer);
expectFn("cjs /clockify ClockifyAddon", cjsClockify.ClockifyAddon);
expectFn("cjs /testing generateTestKeys", cjsTesting.generateTestKeys);

// --- 3. The README quick-start must actually boot and serve /manifest (from the ESM build). ---
const { ClockifyAddon, ClockifyManifest, ClockifyComponent, ClockifyScope } = esm;
const { createNodeHttpAddonServer } = esmAdapters;

const manifest = ClockifyManifest.v1_4Builder()
  .key("my-clockify-addon")
  .name("My Add-on")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .scopes([ClockifyScope.PROJECT_READ, ClockifyScope.PROJECT_WRITE])
  .build();

const addon = new ClockifyAddon(manifest);
addon.registerComponent(
  ClockifyComponent.v1_4Builder()
    .activityTab()
    .allowAdmins()
    .path("/component")
    .label("Activity Tab")
    .build(),
  async () => ({
    status: 200,
    headers: { "content-type": "text/html" },
    body: "<html><body>Hello Clockify!</body></html>",
  }),
);

const server = createNodeHttpAddonServer(addon);
const port = await new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
try {
  const res = await fetch(`http://127.0.0.1:${port}/manifest`);
  if (res.status !== 200) fail(`GET /manifest returned ${res.status}`);
  if (res.headers.get("content-type") !== "application/json")
    fail("GET /manifest content-type not application/json");
  const body = await res.json();
  if (body.key !== "my-clockify-addon") fail(`served wrong manifest (key=${body.key})`);
  if (body.schemaVersion !== "1.4") fail(`served wrong schemaVersion (${body.schemaVersion})`);

  const comp = await fetch(`http://127.0.0.1:${port}/component`);
  if (comp.status !== 200) fail(`GET /component returned ${comp.status}`);

  const miss = await fetch(`http://127.0.0.1:${port}/nope`);
  if (miss.status !== 405) fail(`GET /nope returned ${miss.status}, expected 405`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(
  "verify:dist OK — ESM + CJS exports resolve and the README quick-start serves /manifest.",
);
