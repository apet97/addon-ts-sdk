import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatorPath = join(packageRoot, "scripts", "generate-clockify-manifest.ts");
const tsxCli = resolve(packageRoot, "..", "node_modules", "tsx", "dist", "cli.mjs");
const committedValidatorsPath = join(
  packageRoot,
  "src",
  "clockify",
  "generated",
  "manifest-validators.ts",
);

function generateInto(outDir: string): string {
  const result = spawnSync(process.execPath, [tsxCli, generatorPath, "--out-dir", outDir], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  expect(
    { status: result.status, signal: result.signal, stderr: result.stderr },
    result.stdout,
  ).toEqual({ status: 0, signal: null, stderr: "" });

  const validatorsPath = join(outDir, "manifest-validators.ts");
  expect(existsSync(validatorsPath)).toBe(true);
  return existsSync(validatorsPath) ? readFileSync(validatorsPath, "utf8") : "";
}

describe("generated manifest validators", () => {
  it("commits self-contained validators with legal provenance and no runtime compiler imports", async () => {
    expect(existsSync(committedValidatorsPath)).toBe(true);
    if (!existsSync(committedValidatorsPath)) return;

    const source = readFileSync(committedValidatorsPath, "utf8");
    for (const version of ["1_2", "1_3", "1_4", "1_5"]) {
      expect(source).toContain(`export const validateManifest${version}`);
    }
    expect(source).toContain("clockifyUnicodeLength");
    expect(source).toContain("clockifyJsonDeepEqual");
    expect(source).toContain("clockifyUriFormat");
    expect(source.includes("AJV")).toBe(true);
    expect(source.includes("fast-deep-equal")).toBe(true);
    expect(source.includes("THIRD_PARTY_NOTICES.md")).toBe(true);
    expect(source).not.toContain("ajv/dist/runtime");
    const inspectorUrl = new URL("../../scripts/javascript-runtime-inspection.mjs", import.meta.url)
      .href;
    const { inspectRuntimeJavaScript } = await import(inspectorUrl);
    expect(inspectRuntimeJavaScript(source, { forbidImports: true })).toEqual([]);
  });

  it("generates byte-identical validators across clean output directories", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "clockify-validator-generation-"));

    try {
      const first = generateInto(join(tempRoot, "first"));
      const second = generateInto(join(tempRoot, "second"));
      expect(first).toBe(second);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
