# Version-Aware Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct post-publication documentation and add repeatable, manifest-version-aware npm
preflight and exact-registry consumer verification.

**Architecture:** `scripts/release-preflight.mjs` owns workspace version discovery and fail-closed
registry metadata checks. `scripts/verify-registry-consumer.mjs` reuses those helpers, creates a
temporary exact-version consumer, exercises both packages and a generated Node project, and always
cleans up. Both network commands remain manual and outside deterministic CI.

**Tech Stack:** Node.js 22+ ESM, npm workspaces/registry, Vitest 4, TypeScript 6, Node `http`, and the
existing SDK/creator public APIs.

## Global Constraints

- Do not change package versions or publish, tag, push, or alter npm/GitHub authentication.
- Do not add runtime or development dependencies.
- Keep `npm run ci:verify` deterministic and green; registry commands must stay outside it.
- Read package names and versions from `addon-sdk/package.json` and
  `create-clockify-addon/package.json`; do not duplicate a release version in script source.
- Honor `npm_config_registry` or `NPM_CONFIG_REGISTRY`, then default to
  `https://registry.npmjs.org/`.
- Treat registry outages, malformed metadata, and unexpected statuses as failures.
- Remove every temporary consumer in `finally`.
- Keep `AGENTS.md` and `CLAUDE.md` identical except for their heading and introduction.
- Preserve SDK runtime behavior and all public exports.

## File Map

- Create `scripts/release-preflight.mjs`: workspace release metadata, registry queries, availability
  and publication assertions, plus the direct preflight CLI.
- Create `scripts/verify-registry-consumer.mjs`: exact published-artifact and generated-runtime
  smoke.
- Create `addon-sdk/tests/release-registry.test.ts`: deterministic fake-registry and command-wiring
  regressions.
- Modify `addon-sdk/tests/distribution-docs.test.ts`: cover all current publication-state docs and
  version-aware command documentation.
- Modify `package.json`: add `release:preflight` and `verify:registry` only.
- Modify `SECURITY.md`, `docs/pre-release-migration.md`, `docs/architecture.md`,
  `docs/release-readiness.md`, `docs/quality-gates.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, and
  `CHANGELOG.md`: truthful post-publication guidance.

---

### Task 1: Correct Post-Publication Documentation Drift

**Files:**

- Modify: `addon-sdk/tests/distribution-docs.test.ts`
- Modify: `SECURITY.md`
- Modify: `docs/pre-release-migration.md`
- Modify: `docs/architecture.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: the current published package names and the historical `1.0.0` release record.
- Produces: a documentation regression boundary that later release-tooling tasks extend.

- [ ] **Step 1: Write the failing documentation assertions**

In `addon-sdk/tests/distribution-docs.test.ts`, read the three omitted current documents beside the
existing README reads:

```ts
const securityPolicy = readFileSync(resolve(repoRoot, "SECURITY.md"), "utf8");
const architecture = readFileSync(
  resolve(repoRoot, "docs", "architecture.md"),
  "utf8",
);
const preReleaseMigration = readFileSync(
  resolve(repoRoot, "docs", "pre-release-migration.md"),
  "utf8",
);
```

Add them to the publication-truth loop and require the completed migration wording:

```ts
for (const document of [
  rootReadme,
  packageReadme,
  creatorReadme,
  productSurface,
  releaseReadiness,
  securityPolicy,
  architecture,
  preReleaseMigration,
]) {
  expect(document).not.toContain("source-only");
  expect(document).not.toContain("not been published to npm");
  expect(document).not.toContain("no published npm version");
}

expect(securityPolicy).toContain("current npm `latest` release");
expect(preReleaseMigration).toContain("Before the public `1.0.0` release");
expect(architecture).toContain(
  "legacy aggregate remains available for package consumers",
);
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
```

Expected: FAIL on the stale `SECURITY.md`, migration, and architecture wording.

- [ ] **Step 3: Apply the smallest truthful documentation changes**

Replace `SECURITY.md` lines 6–7 with:

```markdown
Supported published code is the current npm `latest` release. `main` may contain unreleased changes.
Security reports should include the affected npm version or commit, runtime, minimal reproduction,
and impact.
```

Replace the opening of `docs/pre-release-migration.md` with:

```markdown
# 1.0 API Migration

Before the public `1.0.0` release, Node-only adapters stopped being re-exported from the root so
browser and Worker consumers could import the runtime-neutral entrypoint.
```

Replace the `/adapters` sentence in `docs/architecture.md` with:

```markdown
- `/adapters/node`, `/adapters/express`, and `/adapters/fetch` isolate host integration. The legacy
  `/adapters` aggregate remains available for package consumers but is Node-oriented.
```

Insert this section above `## 1.0.0 - 2026-07-12` in `CHANGELOG.md`:

```markdown
## Unreleased

- Correct post-publication security, architecture, and migration guidance.
```

- [ ] **Step 4: Run the focused test and documentation checks**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
npx prettier --check SECURITY.md docs/pre-release-migration.md docs/architecture.md CHANGELOG.md \
  addon-sdk/tests/distribution-docs.test.ts
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the documentation correction**

```bash
git add SECURITY.md CHANGELOG.md docs/pre-release-migration.md docs/architecture.md \
  addon-sdk/tests/distribution-docs.test.ts
git commit -m "Correct post-publication documentation"
```

---

### Task 2: Add a Version-Aware Release Preflight

**Files:**

- Create: `scripts/release-preflight.mjs`
- Create: `addon-sdk/tests/release-registry.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `fetch`, workspace `package.json` files, and configured registry URL.
- Produces:
  - `readReleasePackages(root?): ReleasePackage[]`
  - `assertVersionsUnpublished(packages, options?): Promise<void>`
  - `assertVersionsPublished(packages, options?): Promise<void>`
  - root command `npm run release:preflight`

- [ ] **Step 1: Write the failing preflight tests**

Create `addon-sdk/tests/release-registry.test.ts` with local-server helpers following
`schema-live-verification.test.ts`. The core assertions are:

```ts
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const repoRoot = resolve(packageRoot, "..");
const scriptPath = resolve(repoRoot, "scripts", "release-preflight.mjs");
const rootPackageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "package.json"), "utf8"),
);
const sdkPackageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "addon-sdk", "package.json"), "utf8"),
);
const creatorPackageJson = JSON.parse(
  readFileSync(
    resolve(repoRoot, "create-clockify-addon", "package.json"),
    "utf8",
  ),
);

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address == null || typeof address === "string")
        throw new Error("expected TCP address");
      resolvePort(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

async function runPreflight(server: Server) {
  const port = await listen(server);
  try {
    return await execFileAsync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, NPM_CONFIG_REGISTRY: `http://127.0.0.1:${port}/` },
    });
  } finally {
    await close(server);
  }
}

describe("release registry verification", () => {
  it("wires a manual version-aware preflight outside deterministic gates", async () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(rootPackageJson.scripts["release:preflight"]).toBe(
      "node scripts/release-preflight.mjs",
    );
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain(
      "release:preflight",
    );
    expect(rootPackageJson.scripts["release:verify"]).not.toContain(
      "release:preflight",
    );
    const { stdout } = await execFileAsync(
      process.execPath,
      [scriptPath, "--help"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    expect(stdout).toContain("release:preflight");
  });

  it("accepts package metadata whose exact workspace versions are absent", async () => {
    const server = createServer((request, response) => {
      const name = decodeURIComponent(
        new URL(request.url ?? "/", "http://registry").pathname.slice(1),
      );
      if (name === sdkPackageJson.name) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ versions: { "0.9.0": {} } }));
    });
    const { stdout } = await runPreflight(server);
    expect(stdout).toContain(
      `${sdkPackageJson.name}@${sdkPackageJson.version}`,
    );
    expect(stdout).toContain(
      `${creatorPackageJson.name}@${creatorPackageJson.version}`,
    );
  });

  it("reports every exact version that already exists", async () => {
    const server = createServer((request, response) => {
      const name = decodeURIComponent(
        new URL(request.url ?? "/", "http://registry").pathname.slice(1),
      );
      const version =
        name === sdkPackageJson.name
          ? sdkPackageJson.version
          : creatorPackageJson.version;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ versions: { [version]: {} } }));
    });
    try {
      await runPreflight(server);
      throw new Error("expected preflight to reject published versions");
    } catch (error) {
      expect(error).toMatchObject({ code: 1 });
      const stderr = String((error as { stderr?: string }).stderr);
      expect(stderr).toContain(
        `${sdkPackageJson.name}@${sdkPackageJson.version}`,
      );
      expect(stderr).toContain(
        `${creatorPackageJson.name}@${creatorPackageJson.version}`,
      );
    }
  });

  it("rejects unknown arguments before making a registry request", async () => {
    await expect(
      execFileAsync(process.execPath, [scriptPath, "--unknown"], {
        cwd: repoRoot,
        encoding: "utf8",
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown argument"),
    });
  });

  it("fails closed on registry errors and malformed metadata", async () => {
    for (const handler of [
      (_request: unknown, response: import("node:http").ServerResponse) =>
        response.writeHead(503).end(),
      (_request: unknown, response: import("node:http").ServerResponse) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ versions: [] }));
      },
    ]) {
      await expect(runPreflight(createServer(handler))).rejects.toMatchObject({
        code: 1,
      });
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/release-registry.test.ts
```

Expected: FAIL because `scripts/release-preflight.mjs` and `release:preflight` do not exist.

- [ ] **Step 3: Implement the shared registry-state script**

Create `scripts/release-preflight.mjs`:

```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultRegistry = "https://registry.npmjs.org/";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readReleasePackages(root = defaultRoot) {
  return [
    { id: "sdk", directory: "addon-sdk" },
    { id: "creator", directory: "create-clockify-addon" },
  ].map(({ id, directory }) => {
    const manifest = readJson(resolve(root, directory, "package.json"));
    if (
      typeof manifest.name !== "string" ||
      typeof manifest.version !== "string"
    ) {
      throw new Error(
        `${directory}/package.json must contain string name and version fields.`,
      );
    }
    return {
      id,
      directory,
      name: manifest.name,
      version: manifest.version,
      manifest,
    };
  });
}

export function configuredRegistry(environment = process.env) {
  const value =
    environment.npm_config_registry ??
    environment.NPM_CONFIG_REGISTRY ??
    defaultRegistry;
  return value.endsWith("/") ? value : `${value}/`;
}

async function hasExactVersion(releasePackage, { registry, fetchImpl }) {
  const encodedName = encodeURIComponent(releasePackage.name).replace(
    /^%40/,
    "@",
  );
  const url = new URL(encodedName, registry);
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `Registry returned HTTP ${response.status} for ${releasePackage.name}.`,
    );
  }
  const metadata = await response.json();
  if (
    metadata == null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    metadata.versions == null ||
    typeof metadata.versions !== "object" ||
    Array.isArray(metadata.versions)
  ) {
    throw new Error(
      `Registry returned invalid metadata for ${releasePackage.name}.`,
    );
  }
  return Object.hasOwn(metadata.versions, releasePackage.version);
}

async function existingVersions(packages, options = {}) {
  const registry = options.registry ?? configuredRegistry();
  const fetchImpl = options.fetchImpl ?? fetch;
  const states = await Promise.all(
    packages.map(async (releasePackage) => ({
      releasePackage,
      exists: await hasExactVersion(releasePackage, { registry, fetchImpl }),
    })),
  );
  return states;
}

export async function assertVersionsUnpublished(packages, options) {
  const states = await existingVersions(packages, options);
  const conflicts = states
    .filter(({ exists }) => exists)
    .map(
      ({ releasePackage }) =>
        `${releasePackage.name}@${releasePackage.version}`,
    );
  if (conflicts.length > 0)
    throw new Error(`Already published: ${conflicts.join(", ")}`);
}

export async function assertVersionsPublished(packages, options) {
  const states = await existingVersions(packages, options);
  const missing = states
    .filter(({ exists }) => !exists)
    .map(
      ({ releasePackage }) =>
        `${releasePackage.name}@${releasePackage.version}`,
    );
  if (missing.length > 0)
    throw new Error(`Not published: ${missing.join(", ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log(
      "Usage: npm run release:preflight\n\nFails if an exact workspace version already exists.",
    );
    return;
  }
  if (args.length > 0) throw new Error(`Unknown argument: ${args[0]}`);
  const packages = readReleasePackages();
  await assertVersionsUnpublished(packages);
  console.log(
    `Release preflight OK - available: ${packages.map(({ name, version }) => `${name}@${version}`).join(", ")}`,
  );
}

const isDirect =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

Add this root package script:

```json
"release:preflight": "node scripts/release-preflight.mjs"
```

- [ ] **Step 4: Run tests and fix only contract mismatches**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/release-registry.test.ts
```

Expected: all preflight tests pass without contacting npm.

- [ ] **Step 5: Commit the preflight**

```bash
git add package.json scripts/release-preflight.mjs addon-sdk/tests/release-registry.test.ts
git commit -m "Add version-aware release preflight"
```

---

### Task 3: Add Exact Registry Consumer Verification

**Files:**

- Create: `scripts/verify-registry-consumer.mjs`
- Modify: `addon-sdk/tests/release-registry.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `readReleasePackages()` and `assertVersionsPublished()` from Task 2.
- Produces: root command `npm run verify:registry` and a complete temporary-consumer receipt.

- [ ] **Step 1: Write the failing consumer-command assertions**

Add paths and this test to `addon-sdk/tests/release-registry.test.ts`:

```ts
const consumerScriptPath = resolve(
  repoRoot,
  "scripts",
  "verify-registry-consumer.mjs",
);

it("wires exact registry consumers outside deterministic gates", () => {
  const currentRootPackageJson = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf8"),
  );
  expect(existsSync(consumerScriptPath)).toBe(true);
  expect(currentRootPackageJson.scripts["verify:registry"]).toBe(
    "node scripts/verify-registry-consumer.mjs",
  );
  expect(currentRootPackageJson.scripts["ci:verify"]).not.toContain(
    "verify:registry",
  );
  expect(currentRootPackageJson.scripts["release:verify"]).not.toContain(
    "verify:registry",
  );
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/release-registry.test.ts
```

Expected: FAIL because the consumer script and package command do not exist.

- [ ] **Step 3: Implement the exact registry smoke**

Create `scripts/verify-registry-consumer.mjs` using the same `mkdtempSync`/`finally` pattern as
`create-clockify-addon/scripts/verify-scaffolds.mjs`. The implementation must contain these complete
phases:

```js
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assertVersionsPublished,
  readReleasePackages,
} from "./release-preflight.mjs";

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const packages = readReleasePackages();
const sdk = packages.find(({ id }) => id === "sdk");
const creator = packages.find(({ id }) => id === "creator");
if (!sdk || !creator)
  throw new Error("Expected SDK and creator release packages.");

await assertVersionsPublished(packages);
const temp = mkdtempSync(join(tmpdir(), "clockify-addon-registry-"));

try {
  writeJson(join(temp, "package.json"), { private: true, type: "module" });
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      `${sdk.name}@${sdk.version}`,
      `${creator.name}@${creator.version}`,
      `typescript@${sdk.manifest.devDependencies.typescript}`,
      `@types/node@${sdk.manifest.devDependencies["@types/node"]}`,
    ],
    temp,
  );

  writeFileSync(
    join(temp, "verify-esm.mjs"),
    `import assert from "node:assert/strict";
const sdk = await import("@apet97/clockify-addon-sdk");
const fetchAdapter = await import("@apet97/clockify-addon-sdk/adapters/fetch");
const creator = await import("create-clockify-addon");
assert.equal(typeof sdk.validateClockifyManifest, "function");
assert.equal(typeof fetchAdapter.handleFetchRequest, "function");
assert.equal(typeof creator.scaffoldClockifyAddon, "function");
`,
  );
  writeFileSync(
    join(temp, "verify-cjs.cjs"),
    `const assert = require("node:assert/strict");
const sdk = require("@apet97/clockify-addon-sdk");
const nodeAdapter = require("@apet97/clockify-addon-sdk/adapters/node");
assert.equal(typeof sdk.validateClockifyManifest, "function");
assert.equal(typeof nodeAdapter.createNodeHttpAddonServer, "function");
`,
  );
  writeFileSync(
    join(temp, "consumer.ts"),
    `import { validateClockifyManifest } from "@apet97/clockify-addon-sdk";
import { scaffoldClockifyAddon } from "create-clockify-addon";
void validateClockifyManifest;
const options: Parameters<typeof scaffoldClockifyAddon>[0] = {
  directory: "./generated-by-api",
  runtime: "node",
  features: "minimal",
};
void options;
`,
  );
  writeJson(join(temp, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["consumer.ts"],
  });

  run(process.execPath, [join(temp, "verify-esm.mjs")], temp);
  run(process.execPath, [join(temp, "verify-cjs.cjs")], temp);
  run(
    process.execPath,
    [
      join(temp, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "tsconfig.json",
    ],
    temp,
  );
  run(
    process.execPath,
    [
      join(
        temp,
        "node_modules",
        "create-clockify-addon",
        "bin",
        "create-clockify-addon.mjs",
      ),
      "--help",
    ],
    temp,
  );

  run(
    "npm",
    [
      "create",
      `clockify-addon@${creator.version}`,
      "./generated",
      "--",
      "--runtime",
      "node",
      "--features",
      "minimal",
    ],
    temp,
  );
  const generated = resolve(temp, "generated");
  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    generated,
  );
  run("npm", ["run", "typecheck"], generated);

  const installedSdk = JSON.parse(
    readFileSync(
      resolve(
        generated,
        "node_modules",
        "@apet97",
        "clockify-addon-sdk",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (installedSdk.version !== sdk.version) {
    throw new Error(
      `Generated project resolved SDK ${installedSdk.version}; expected ${sdk.version}.`,
    );
  }

  writeFileSync(
    join(generated, "verify-runtime.mjs"),
    `import assert from "node:assert/strict";
import { once } from "node:events";
import { validateClockifyManifest } from "@apet97/clockify-addon-sdk";
const { startNodeAddon } = await import("./src/index.ts");
assert.throws(() => startNodeAddon({ PORT: "0" }), /PUBLIC_BASE_URL/);
const server = startNodeAddon({
  PORT: "0",
  PUBLIC_BASE_URL: "https://registry-smoke.example",
  CLOCKIFY_PARENT_ORIGIN: "https://app.clockify.me",
  ALLOW_LOCAL_REQUEST_ORIGIN: "false",
  ALLOW_EPHEMERAL_STORAGE: "false",
});
if (!server.listening) await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
try {
  const request = (path) => fetch(\`http://127.0.0.1:\${address.port}\${path}\`);
  const manifestResponse = await request("/manifest");
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(validateClockifyManifest(manifest).ok, true);
  assert.equal(manifest.components?.length ?? 0, 1);
  assert.equal(manifest.lifecycle?.length ?? 0, 0);
  assert.equal(manifest.webhooks?.length ?? 0, 0);
  assert.equal((await request("/missing")).status, 404);
  assert.equal((await request("/component")).status, 401);
} finally {
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}
`,
  );
  run("npm", ["exec", "--", "tsx", "verify-runtime.mjs"], generated);
  console.log(
    `Registry verification OK - ${sdk.name}@${sdk.version}, ${creator.name}@${creator.version}`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
```

Add the root package script:

```json
"verify:registry": "node scripts/verify-registry-consumer.mjs"
```

- [ ] **Step 4: Run the focused wiring tests**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/release-registry.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the real exact-version registry smoke**

Run:

```bash
npm run verify:registry
```

Expected: exact `1.0.0` SDK/creator installation passes ESM, CJS, TypeScript, CLI, generated-project,
manifest, 404, 401, and fail-closed probes; the command prints `Registry verification OK` and leaves
no temporary directory behind.

- [ ] **Step 6: Commit the registry consumer**

```bash
git add package.json scripts/verify-registry-consumer.mjs addon-sdk/tests/release-registry.test.ts
git commit -m "Verify exact npm registry consumers"
```

---

### Task 4: Document the Version-Aware Release Workflow

**Files:**

- Modify: `addon-sdk/tests/distribution-docs.test.ts`
- Modify: `README.md`
- Modify: `docs/release-readiness.md`
- Modify: `docs/quality-gates.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: `npm run release:preflight` and `npm run verify:registry` from Tasks 2–3.
- Produces: one current maintainer contract with no hard-coded future registry lookup.

- [ ] **Step 1: Write failing documentation-contract assertions**

Add to `distribution-docs.test.ts`:

```ts
expect(rootPackageJson.scripts["release:preflight"]).toBe(
  "node scripts/release-preflight.mjs",
);
expect(rootPackageJson.scripts["verify:registry"]).toBe(
  "node scripts/verify-registry-consumer.mjs",
);
expect(rootPackageJson.scripts["ci:verify"]).not.toContain("release:preflight");
expect(rootPackageJson.scripts["ci:verify"]).not.toContain("verify:registry");
expect(releaseReadiness).toContain("npm run release:preflight");
expect(releaseReadiness).toContain("npm run verify:registry");
expect(releaseReadiness).not.toContain(
  "npm view @apet97/clockify-addon-sdk@1.0.0 version",
);
expect(qualityGates).toContain("npm run release:preflight");
expect(qualityGates).toContain("npm run verify:registry");
expect(rootReadme).toContain("npm run verify:registry");
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
```

Expected: FAIL because future-release docs still contain hard-coded `1.0.0` lookup commands and do
not explain the new scripts.

- [ ] **Step 3: Update release and quality documentation**

In `docs/release-readiness.md`:

- retain the `Published versions` list as historical publication state;
- add `npm run release:preflight` after `npm run release:verify` and explain that it must fail on the
  current published workspaces until versions are bumped;
- replace the hard-coded `npm view` block with `npm run verify:registry`;
- state that the command discovers exact versions from both workspace manifests and runs the
  installed consumer/generated-runtime proof.

In `docs/quality-gates.md`, add a `Manual release boundary` section:

```markdown
Manual release boundary:

- **`npm run release:preflight`** — reads both workspace package versions and fails if either exact
  version already exists in the configured npm registry. It is intentionally outside deterministic
  CI and should run only after the intended version changes.
- **`npm run verify:registry`** — after publication, installs both exact workspace versions from the
  registry, verifies SDK ESM/CJS and TypeScript consumers, runs creator help and canonical
  `npm create`, then type-checks and executes the generated Node/minimal runtime.
```

In `README.md`, add `npm run verify:registry` immediately after the `release:verify` explanation as
the post-publish installed-artifact command.

In both `AGENTS.md` and `CLAUDE.md`:

- add gate-table rows for the two commands;
- state in `Git / publish workflow` that preflight runs after version changes and registry
  verification runs after successful publication;
- keep all content below the introductions byte-identical.

Add the second `Unreleased` bullet to `CHANGELOG.md` now that both commands exist:

```markdown
- Add version-aware npm release preflight and exact-registry consumer verification.
```

- [ ] **Step 4: Run focused docs tests and synchronization checks**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- \
  tests/distribution-docs.test.ts tests/release-registry.test.ts
diff -u AGENTS.md CLAUDE.md || true
npx prettier --check README.md CHANGELOG.md docs/release-readiness.md docs/quality-gates.md \
  AGENTS.md CLAUDE.md addon-sdk/tests/distribution-docs.test.ts
git diff --check
```

Expected: tests and formatting pass; the only `diff` output is the allowed title/introduction.

- [ ] **Step 5: Commit the release guidance**

```bash
git add README.md CHANGELOG.md docs/release-readiness.md docs/quality-gates.md AGENTS.md CLAUDE.md \
  addon-sdk/tests/distribution-docs.test.ts
git commit -m "Document version-aware release checks"
```

---

### Task 5: Run Final Verification and Review

**Files:**

- Verify only: all changed files from Tasks 1–4.

**Interfaces:**

- Consumes: complete implementation and documentation.
- Produces: evidence-backed local handoff; no push, tag, or publish.

- [ ] **Step 1: Prove the focused behavior**

```bash
npm test -w @apet97/clockify-addon-sdk -- \
  tests/distribution-docs.test.ts tests/release-registry.test.ts
npm run verify:registry
```

Expected: tests pass and the public `1.0.0` artifacts pass exact registry verification.

- [ ] **Step 2: Prove the current-version preflight blocks republishing**

Run:

```bash
npm run release:preflight
```

Expected: exit 1 with both `@apet97/clockify-addon-sdk@1.0.0` and
`create-clockify-addon@1.0.0` listed as already published. Do not weaken the command to make this
current-tree invocation exit 0.

- [ ] **Step 3: Run all local release gates**

```bash
npm run ci:verify
npm run verify:schema-live
npm run release:dry-run
npx madge@8 --extensions ts --circular addon-sdk/src
git diff --check
```

Expected: every command exits 0; Madge reports no circular dependency. `release:dry-run` does not
upload another package version.

- [ ] **Step 4: Review scope and repository state**

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- . ':!docs/superpowers/specs/**' ':!docs/superpowers/plans/**'
diff -u AGENTS.md CLAUDE.md || true
find . -maxdepth 3 -type f -name '*.tgz' -print
git status --short --branch
```

Expected: only approved documentation/tests/scripts/package wiring changed; agent docs differ only
at the introduction; no tarballs exist; the worktree is clean and local `main` is ahead only by the
focused design/plan/implementation commits.

- [ ] **Step 5: Stop before remote delivery**

Report commit SHAs, exact verification outcomes, and the absence of any publish/tag/push action.
Wait for explicit user authorization before pushing `main` or creating a release.
