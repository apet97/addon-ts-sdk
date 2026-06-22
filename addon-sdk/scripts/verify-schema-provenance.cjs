const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SUPPORTED_SCHEMA_VERSIONS = ["1.2", "1.3", "1.4", "1.5"];

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function sameList(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const schemasDir = path.resolve(
  argValue("--schemas-dir") ?? path.join(__dirname, "..", "schemas", "clockify-manifests"),
);
const provenancePath = path.join(schemasDir, "provenance.json");

if (!fs.existsSync(provenancePath)) {
  fail(`Missing schema provenance file: ${provenancePath}`);
  process.exit();
}

const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const versions = provenance.supportedVersions;
if (!Array.isArray(versions) || versions.length === 0) {
  fail("Schema provenance must declare supportedVersions.");
  process.exit();
}

if (!sameList(versions, SUPPORTED_SCHEMA_VERSIONS)) {
  fail(`Supported schema versions must be exactly: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`);
}

const schemaKeys = Object.keys(provenance.schemas ?? {}).sort();
if (!sameList(schemaKeys, SUPPORTED_SCHEMA_VERSIONS)) {
  fail(`Schema provenance entries must be exactly: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`);
}

const schemaFiles = fs
  .readdirSync(schemasDir)
  .filter((fileName) => /^\d+\.\d+\.json$/.test(fileName))
  .sort();
const expectedSchemaFiles = SUPPORTED_SCHEMA_VERSIONS.map((version) => `${version}.json`);
if (!sameList(schemaFiles, expectedSchemaFiles)) {
  fail(`Schema files must be exactly: ${expectedSchemaFiles.join(", ")}`);
}

for (const version of versions) {
  const entry = provenance.schemas && provenance.schemas[version];
  if (!entry || typeof entry.file !== "string" || typeof entry.sha256 !== "string") {
    fail(`Missing provenance entry for schema version ${version}.`);
    continue;
  }
  if (typeof entry.source !== "string" || entry.source.trim() === "") {
    fail(`Missing provenance source for schema version ${version}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
    fail(`Invalid SHA-256 hash for schema version ${version}.`);
    continue;
  }

  const filePath = path.join(schemasDir, entry.file);
  if (!fs.existsSync(filePath)) {
    fail(`Missing schema file: ${entry.file}`);
    continue;
  }

  const actual = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

  if (actual !== entry.sha256) {
    fail(`Schema hash mismatch: ${entry.file} expected ${entry.sha256} got ${actual}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Schema provenance OK: ${versions.join(", ")}`);
