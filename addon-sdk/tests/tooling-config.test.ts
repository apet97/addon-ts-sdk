import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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

  it("keeps Makefile aliases aligned with root npm gates", () => {
    const makefile = readFileSync(resolve(repoRoot, "Makefile"), "utf8");

    expect(makefile).toContain("verify-fast:");
    expect(makefile).toContain("\tnpm run verify:fast");
    expect(makefile).toContain("ci-verify:");
    expect(makefile).toContain("\tnpm run ci:verify");
    expect(makefile).toContain("package-lint:");
    expect(makefile).toContain("\tnpm run verify:package-lint");
    expect(makefile).toContain("addon-sdk-package: ci-verify");
    expect(makefile).toContain("addon-sdk-parity: verify-fast");
  });

  it("includes every root release tool in the canonical lint and format gates", () => {
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const rootEslintConfigPath = resolve(repoRoot, "eslint.config.mjs");

    expect(existsSync(rootEslintConfigPath)).toBe(true);
    const rootEslintConfig = readFileSync(rootEslintConfigPath, "utf8");
    expect(rootEslintConfig).toContain("./addon-sdk/eslint.config.mjs");
    expect(rootPackageJson.scripts["lint:release-tools"]).toBe(
      "npm exec -- eslint --config eslint.config.mjs scripts/*.mjs",
    );
    expect(rootPackageJson.scripts.lint).toBe(
      "npm run lint -w @apet97/clockify-addon-sdk && npm run lint:release-tools",
    );
    expect(rootPackageJson.scripts["format:release-tools:check"]).toBe(
      "npm exec -- prettier scripts/*.mjs --check",
    );
    expect(rootPackageJson.scripts["format:check"]).toBe(
      "npm run format:check -w @apet97/clockify-addon-sdk && npm run format:release-tools:check",
    );
  });

  it("keeps source tooling on its tested Node and dependency lines", () => {
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const sdkPackageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const creatorPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "create-clockify-addon", "package.json"), "utf8"),
    );
    const workflow = readFileSync(resolve(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const dependabot = readFileSync(resolve(repoRoot, ".github", "dependabot.yml"), "utf8");

    expect(rootPackageJson.engines?.node).toBe(">=22.13.0");
    expect(sdkPackageJson.engines.node).toBe(">=22");
    expect(creatorPackageJson.engines.node).toBe(">=22");
    expect(sdkPackageJson.devDependencies).toMatchObject({
      "@arethetypeswrong/cli": "^0.18.5",
      "@types/node": "^22.20.1",
      "@vitest/coverage-v8": "^4.1.10",
      eslint: "^10.7.0",
      prettier: "^3.9.5",
      tsx: "^4.23.1",
      typescript: "^6.0.3",
      "typescript-eslint": "^8.64.0",
      vite: "^8.1.4",
      vitest: "^4.1.10",
    });
    expect(workflow).toContain("          - 22.13.0");
    expect(workflow).toContain("          - 24.x");
    expect(dependabot).toContain('        update-types:\n          - "minor"\n          - "patch"');
    expect(dependabot).toMatch(
      /dependency-name: "@types\/node"[\s\S]*?update-types:[\s\S]*?"version-update:semver-major"/,
    );
    expect(dependabot).toMatch(
      /dependency-name: "typescript"[\s\S]*?update-types:[\s\S]*?"version-update:semver-major"/,
    );
  });
});
