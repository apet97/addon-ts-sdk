import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const node = process.execPath;
const script = join(process.cwd(), "scripts", "verify-schema-provenance.cjs");
const schemasDir = join(process.cwd(), "schemas", "clockify-manifests");

function runVerifier(dir = schemasDir): string {
  return execFileSync(node, [script, "--schemas-dir", dir], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("schema provenance verification", () => {
  it("passes for the committed supported manifest schemas", () => {
    expect(runVerifier()).toContain("Schema provenance OK");
  }, 15_000);

  it("fails when a supported schema file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-schema-missing-"));
    try {
      cpSync(schemasDir, dir, { recursive: true });
      rmSync(join(dir, "1.5.json"));

      expect(() => runVerifier(dir)).toThrow(/Missing schema file: 1\.5\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it("fails when a supported schema hash changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-schema-hash-"));
    try {
      cpSync(schemasDir, dir, { recursive: true });
      const schemaPath = join(dir, "1.5.json");
      writeFileSync(schemaPath, `${readFileSync(schemaPath, "utf8")}\n`, "utf8");

      expect(() => runVerifier(dir)).toThrow(/Schema hash mismatch: 1\.5\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it("fails when the supported schema version set changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-schema-versions-"));
    try {
      cpSync(schemasDir, dir, { recursive: true });
      const provenancePath = join(dir, "provenance.json");
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
      provenance.supportedVersions = ["1.2", "1.3", "1.4"];
      writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), "utf8");

      expect(() => runVerifier(dir)).toThrow(/Supported schema versions must be exactly/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it("fails when a provenance entry omits its source label", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-schema-source-"));
    try {
      cpSync(schemasDir, dir, { recursive: true });
      const provenancePath = join(dir, "provenance.json");
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
      delete provenance.schemas["1.5"].source;
      writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), "utf8");

      expect(() => runVerifier(dir)).toThrow(/Missing provenance source for schema version 1\.5/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
