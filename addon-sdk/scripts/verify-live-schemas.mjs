import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEFAULT_BASE_URL = "https://api.clockify.me/api/addons/manifest-schema";
const DEFAULT_UNSUPPORTED_VERSION = "1.6";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function loadProvenance(schemasDir) {
  return JSON.parse(readFileSync(join(schemasDir, "provenance.json"), "utf8"));
}

function schemaUrl(baseUrl, version) {
  const url = new URL(baseUrl);
  url.searchParams.set("version", version);
  return url;
}

function hashBody(body) {
  return createHash("sha256").update(body).digest("hex");
}

async function fetchSchema(baseUrl, version) {
  const response = await fetch(schemaUrl(baseUrl, version));
  const body = await response.text();
  return { response, body };
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const schemasDir = resolve(
  argValue("--schemas-dir") ?? join(packageRoot, "schemas", "clockify-manifests"),
);
const baseUrl = argValue("--base-url") ?? DEFAULT_BASE_URL;
const unsupportedVersion = argValue("--unsupported-version") ?? DEFAULT_UNSUPPORTED_VERSION;
const provenance = loadProvenance(schemasDir);
const supportedVersions = provenance.supportedVersions ?? [];

for (const version of supportedVersions) {
  const entry = provenance.schemas?.[version];
  if (!entry?.file) {
    fail(`Missing provenance entry for schema version ${version}.`);
    continue;
  }

  const vendored = JSON.parse(readFileSync(join(schemasDir, entry.file), "utf8"));
  const { response, body } = await fetchSchema(baseUrl, version);

  if (!response.ok) {
    fail(`Live schema ${version} returned HTTP ${response.status}.`);
    continue;
  }

  let live;
  try {
    live = JSON.parse(body);
  } catch {
    fail(`Live schema ${version} did not return valid JSON.`);
    continue;
  }

  if (stableJson(live) !== stableJson(vendored)) {
    fail(`Live schema ${version} is structurally different from ${entry.file}.`);
    continue;
  }

  const rawHash = hashBody(body);
  const vendoredHash = hashBody(readFileSync(join(schemasDir, entry.file)));
  const rawSuffix = rawHash === vendoredHash ? "" : ` (raw hash differs: live ${rawHash})`;
  console.log(`OK: live schema ${version} matches ${entry.file} structurally${rawSuffix}`);
}

const unsupported = await fetchSchema(baseUrl, unsupportedVersion);
if (unsupported.response.status !== 400) {
  fail(
    `Expected schema ${unsupportedVersion} to return HTTP 400, got ${unsupported.response.status}.`,
  );
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `Live schema verification OK: ${supportedVersions.join(", ")} match structurally; ${unsupportedVersion} is unsupported.`,
);
