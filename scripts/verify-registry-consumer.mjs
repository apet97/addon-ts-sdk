import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readReleasePackages,
  waitForVersionsPublished,
} from "./release-preflight.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertInstalledVersion(root, releasePackage) {
  const manifest = readJson(
    join(root, "node_modules", releasePackage.name, "package.json"),
  );
  if (manifest.version !== releasePackage.version) {
    throw new Error(
      `Expected ${releasePackage.name}@${releasePackage.version}, installed ${manifest.version}`,
    );
  }
}

function verifyConsumerImports(workspace) {
  const esmProbe = join(workspace, "consumer-smoke.mjs");
  writeFileSync(
    esmProbe,
    `import assert from "node:assert/strict";
import { ClockifyAddon, validateClockifyManifest } from "@apet97/clockify-addon-sdk";
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
import { scaffoldClockifyAddon } from "create-clockify-addon";

assert.equal(typeof ClockifyAddon, "function");
assert.equal(typeof validateClockifyManifest, "function");
assert.equal(typeof handleFetchRequest, "function");
assert.equal(typeof scaffoldClockifyAddon, "function");
`,
    "utf8",
  );
  run(process.execPath, [esmProbe], { cwd: workspace });

  const cjsProbe = join(workspace, "consumer-smoke.cjs");
  writeFileSync(
    cjsProbe,
    `const assert = require("node:assert/strict");
const sdk = require("@apet97/clockify-addon-sdk");
const nodeAdapter = require("@apet97/clockify-addon-sdk/adapters/node");

assert.equal(typeof sdk.ClockifyAddon, "function");
assert.equal(typeof sdk.validateClockifyManifest, "function");
assert.equal(typeof nodeAdapter.createNodeHttpAddonServer, "function");
`,
    "utf8",
  );
  run(process.execPath, [cjsProbe], { cwd: workspace });
}

function verifyTypeScriptConsumer(workspace) {
  writeJson(join(workspace, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022", "DOM"],
      types: ["node"],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
    },
    include: ["consumer-smoke.ts"],
  });
  writeFileSync(
    join(workspace, "consumer-smoke.ts"),
    `import { ClockifyAddon, validateClockifyManifest } from "@apet97/clockify-addon-sdk";
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";
import { scaffoldClockifyAddon } from "create-clockify-addon";

void ClockifyAddon;
void validateClockifyManifest;
void handleFetchRequest;
void createNodeHttpAddonServer;
void scaffoldClockifyAddon;
`,
    "utf8",
  );
  run("npm", ["exec", "--", "tsc", "-p", "tsconfig.json"], { cwd: workspace });
}

function verifyCreatorCli(workspace, creatorPackage) {
  const creatorBin = join(
    workspace,
    "node_modules",
    ".bin",
    "create-clockify-addon",
  );
  const help = run(process.execPath, [creatorBin, "--help"], {
    cwd: workspace,
    stdio: "pipe",
  });
  if (!help.includes("Usage: create-clockify-addon")) {
    throw new Error(
      "Installed creator CLI did not print its documented help output",
    );
  }

  run(
    "npm",
    [
      "create",
      `clockify-addon@${creatorPackage.version}`,
      "./generated",
      "--",
      "--runtime",
      "node",
      "--features",
      "minimal",
    ],
    {
      cwd: workspace,
      env: { ...process.env, npm_config_yes: "true" },
    },
  );
}

function runtimeProbeSource() {
  return `import assert from "node:assert/strict";
import { once } from "node:events";

import { validateClockifyManifest } from "@apet97/clockify-addon-sdk";

const { startNodeAddon } = await import("./src/index.ts");
assert.equal(typeof startNodeAddon, "function");
assert.throws(() => startNodeAddon({ PORT: "0" }), /PUBLIC_BASE_URL/);

const server = startNodeAddon({
  PORT: "0",
  PUBLIC_BASE_URL: "https://registry-generated.example",
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
  const validation = validateClockifyManifest(manifest);
  assert.equal(validation.ok, true, JSON.stringify(validation));
  assert.equal(manifest.components?.length ?? 0, 1);
  assert.equal(manifest.lifecycle?.length ?? 0, 0);
  assert.equal(manifest.webhooks?.length ?? 0, 0);
  assert.equal((await request("/missing")).status, 404);
  assert.equal((await request("/component")).status, 401);
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
`;
}

function verifyGeneratedProject(workspace, sdkPackage) {
  const generated = join(workspace, "generated");
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: generated,
  });
  run("npm", ["run", "typecheck"], { cwd: generated });
  assertInstalledVersion(generated, sdkPackage);

  writeFileSync(
    join(generated, "verify-runtime.mjs"),
    runtimeProbeSource(),
    "utf8",
  );
  run("npm", ["exec", "--", "tsx", "verify-runtime.mjs"], { cwd: generated });
}

function printHelp() {
  console.log(`Usage: npm run verify:registry

Install the exact SDK and creator workspace versions from the configured npm
registry, exercise ESM/CommonJS/TypeScript consumers, and execute a generated
Node minimal add-on. This command performs registry network requests.`);
}

async function main(args) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    printHelp();
    return;
  }
  if (args.length > 0) {
    throw new Error(`Unknown argument: ${args[0]}`);
  }

  const packages = readReleasePackages(repoRoot);
  await waitForVersionsPublished(packages, {
    onRetry: ({ attempt, maxAttempts, missing, retryDelayMs }) => {
      console.log(
        `Registry propagation pending after attempt ${attempt}/${maxAttempts}; retrying in ${retryDelayMs / 1_000}s:\n${missing
          .map(({ name, version }) => `- ${name}@${version}`)
          .join("\n")}`,
      );
    },
  });
  const sdkPackage = packages.find(
    ({ directory }) => directory === "addon-sdk",
  );
  const creatorPackage = packages.find(
    ({ directory }) => directory === "create-clockify-addon",
  );
  if (sdkPackage == null || creatorPackage == null) {
    throw new Error("Expected SDK and creator release package metadata");
  }

  const typescriptVersion = sdkPackage.manifest.devDependencies?.typescript;
  const nodeTypesVersion = sdkPackage.manifest.devDependencies?.["@types/node"];
  if (
    typeof typescriptVersion !== "string" ||
    typeof nodeTypesVersion !== "string"
  ) {
    throw new Error(
      "SDK manifest must declare TypeScript and @types/node development ranges",
    );
  }

  const workspace = mkdtempSync(
    join(tmpdir(), "clockify-addon-registry-consumer-"),
  );
  try {
    writeJson(join(workspace, "package.json"), {
      private: true,
      type: "module",
      dependencies: Object.fromEntries(
        packages.map((releasePackage) => [
          releasePackage.name,
          releasePackage.version,
        ]),
      ),
      devDependencies: {
        "@types/node": nodeTypesVersion,
        typescript: typescriptVersion,
      },
    });
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: workspace,
    });
    for (const releasePackage of packages) {
      assertInstalledVersion(workspace, releasePackage);
    }

    verifyConsumerImports(workspace);
    verifyTypeScriptConsumer(workspace);
    verifyCreatorCli(workspace, creatorPackage);
    verifyGeneratedProject(workspace, sdkPackage);

    console.log(
      `Registry verification OK:\n${packages
        .map(
          (releasePackage) =>
            `- ${releasePackage.name}@${releasePackage.version}`,
        )
        .join("\n")}`,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

const isDirectExecution =
  process.argv[1] != null &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
