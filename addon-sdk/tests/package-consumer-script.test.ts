import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("package consumer verification script", () => {
  const packageRoot = process.cwd();
  const repoRoot = resolve(packageRoot, "..");

  it("is wired as a root/package gate without recursively running prepack", () => {
    const scriptPath = resolve(packageRoot, "scripts", "verify-package-consumer.mjs");
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

    expect(existsSync(scriptPath)).toBe(true);
    expect(packageJson.scripts["verify:package-consumer"]).toBe(
      "node scripts/verify-package-consumer.mjs",
    );
    expect(rootPackageJson.scripts["verify:package-consumer"]).toBe(
      "npm run verify:package-consumer -w @apet97/clockify-addon-sdk",
    );
    expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:package-consumer");
    expect(readFileSync(scriptPath, "utf8")).toContain("--ignore-scripts");
  });
});
