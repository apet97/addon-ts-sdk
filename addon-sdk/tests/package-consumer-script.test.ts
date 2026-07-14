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
    const script = readFileSync(scriptPath, "utf8");

    expect(existsSync(scriptPath)).toBe(true);
    expect(packageJson.scripts["verify:package-consumer"]).toBe(
      "node scripts/verify-package-consumer.mjs",
    );
    expect(rootPackageJson.scripts["verify:deps"]).toBe("npm ls --workspaces --depth=0");
    expect(rootPackageJson.scripts["verify:package-consumer"]).toBe(
      "npm run verify:package-consumer -w @apet97/clockify-addon-sdk",
    );
    expect(packageJson.scripts["verify:package-lint"]).toBe("node scripts/verify-package-lint.mjs");
    expect(rootPackageJson.scripts["verify:package-lint"]).toBe(
      "npm run verify:package-lint -w @apet97/clockify-addon-sdk",
    );
    expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:package-lint");
    expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:deps");
    expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:package-consumer");
    expect(script).toContain("--ignore-scripts");
    expect(script).toContain("cpSync");
    expect(script).toContain("tsc");
    expect(script).toContain("tsconfig.json");
    expect(script).toContain("smoke.cts");
    expect(script).toContain("import sdk = require");
    expect(script).toContain("cts-consumer");
    expect(script).toContain("typeRoots: [typesRoot]");
    expect(script).toContain('types: ["node"]');
    expect(script).toContain("undici-types");
    expect(script).toContain("@ts-expect-error");
    expect(script).toContain("const esmClaims = await new ClockifySignatureParser");
    expect(script).toContain("const cjsClaims = await new sdk.ClockifySignatureParser");
    expect(script.includes("THIRD_PARTY_NOTICES.md")).toBe(true);
    expect(script.includes("Copyright (c) 2015-2021 Evgeny Poberezkin")).toBe(true);
    expect(script.includes("Copyright (c) 2017 Evgeny Poberezkin")).toBe(true);
    expect(script.includes("ships third-party notices")).toBe(true);
    expect(script).toContain("signs/verifies test tokens");
  });
});
