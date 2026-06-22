import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = path.join(pkgRoot, "src", "clockify", "generated");

function generatedFileMtimes(): Record<string, number> {
  return Object.fromEntries(
    fs
      .readdirSync(generatedDir)
      .filter((fileName) => fileName.endsWith(".ts"))
      .sort()
      .map((fileName) => [fileName, fs.statSync(path.join(generatedDir, fileName)).mtimeMs]),
  );
}

describe("generated verification", () => {
  it("checks generated manifest files without rewriting the tracked files", () => {
    const before = generatedFileMtimes();

    execFileSync("npm", ["run", "verify:generated"], {
      cwd: pkgRoot,
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(generatedFileMtimes()).toEqual(before);
  }, 15_000);
});
