import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tooling configuration", () => {
  const packageRoot = process.cwd();
  const repoRoot = resolve(packageRoot, "..");

  it("wires the coverage gate and uses Vitest 4 coverage fields", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const config = readFileSync(resolve(packageRoot, "vitest.config.ts"), "utf8");

    expect(packageJson.scripts["test:coverage"]).toBe("vitest run --coverage");
    expect(rootPackageJson.scripts["test:coverage"]).toBe(
      "npm run test:coverage -w @apet97/clockify-addon-sdk",
    );
    expect(packageJson.devDependencies["@vitest/coverage-v8"]).toMatch(/^\^4\./);
    expect(config).toContain('provider: "v8"');
    expect(config).toContain('reporter: ["text", "json-summary"]');
    expect(config).toContain('include: ["src/**/*.ts"]');
    expect(config).toContain('"src/clockify/generated/**"');
    expect(config).not.toContain("all:");
    expect(config).not.toContain("extensions:");
  });
});
