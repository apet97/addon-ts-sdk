import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

// Regression guard for the "type-state probe was silently excluded" bug.
//
// `tsconfig.typecheck.json` extends `tsconfig.json`, whose `exclude` lists `tests/**/*`.
// TypeScript's `exclude` filters `include`, so without an explicit `exclude` override the
// probe files (`tests/types/*.probe.ts`) were dropped from the program and `npm run type-check`
// passed no matter how badly the builders were weakened. This test fails if that ever happens
// again: it asks `tsc` for the exact file set and asserts the probes are in it.
const require = createRequire(import.meta.url);
const tscBin = require.resolve("typescript/bin/tsc");
const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function typecheckFileList(): string {
  const out = execFileSync(
    process.execPath,
    [tscBin, "-p", "tsconfig.typecheck.json", "--listFilesOnly"],
    { cwd: pkgRoot, encoding: "utf8" },
  );
  return out.replace(/\\/g, "/");
}

describe("type-check gate integrity", () => {
  const files = typecheckFileList();
  const probeDir = path.join(pkgRoot, "tests", "types");
  const probes = fs.readdirSync(probeDir).filter((f) => f.endsWith(".probe.ts"));

  it("has at least the known type-state + fidelity probes on disk", () => {
    // Sanity: if someone deletes every probe, the gate has nothing to enforce.
    expect(probes).toContain("typestate.probe.ts");
    expect(probes).toContain("official-manifest.probe.ts");
    expect(probes.length).toBeGreaterThanOrEqual(2);
  });

  // Every probe on disk MUST be in the type-check program. If the typecheck tsconfig ever
  // re-excludes `tests/**` (the original bug), these fail and the builder gate is exposed as
  // decoration before it can ship.
  for (const probe of probes) {
    it(`actually compiles ${probe}`, () => {
      expect(files).toContain(`tests/types/${probe}`);
    });
  }
});
