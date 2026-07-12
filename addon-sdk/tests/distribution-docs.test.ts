import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published distribution docs", () => {
  const packageRoot = process.cwd();
  const repoRoot = resolve(packageRoot, "..");

  it("ships complete npm release metadata for both packages", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const creatorPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "create-clockify-addon", "package.json"), "utf8"),
    );

    expect(packageJson).toMatchObject({
      name: "@apet97/clockify-addon-sdk",
      version: "1.0.0",
      publishConfig: { access: "public" },
      repository: {
        type: "git",
        url: "git+https://github.com/apet97/addon-ts-sdk.git",
        directory: "addon-sdk",
      },
    });
    expect(creatorPackageJson).toMatchObject({
      name: "create-clockify-addon",
      version: "1.0.0",
      publishConfig: { access: "public" },
      repository: {
        type: "git",
        url: "git+https://github.com/apet97/addon-ts-sdk.git",
        directory: "create-clockify-addon",
      },
      homepage: "https://github.com/apet97/addon-ts-sdk#readme",
      bugs: "https://github.com/apet97/addon-ts-sdk/issues",
    });
  });

  it("documents registry installation for both public packages", () => {
    const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
    const packageReadme = readFileSync(resolve(packageRoot, "README.md"), "utf8");
    const creatorReadme = readFileSync(
      resolve(repoRoot, "create-clockify-addon", "README.md"),
      "utf8",
    );
    const productSurface = readFileSync(resolve(repoRoot, "docs", "product-surface.md"), "utf8");
    const releaseReadiness = readFileSync(
      resolve(repoRoot, "docs", "release-readiness.md"),
      "utf8",
    );
    const qualityGates = readFileSync(resolve(repoRoot, "docs", "quality-gates.md"), "utf8");
    const dependencyStrategy = readFileSync(
      resolve(packageRoot, "docs", "dependency-strategy.md"),
      "utf8",
    );
    const evidenceMap = readFileSync(
      resolve(packageRoot, "docs", "porting", "evidence-map.md"),
      "utf8",
    );
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const creatorPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "create-clockify-addon", "package.json"), "utf8"),
    );

    expect(rootReadme).toContain("npm install @apet97/clockify-addon-sdk");
    expect(packageReadme).toContain("npm install @apet97/clockify-addon-sdk");
    expect(rootReadme).toContain("npm create clockify-addon@latest");
    expect(creatorReadme).toContain("npm create clockify-addon@latest");
    expect(productSurface).toContain("published to the npm registry");
    expect(releaseReadiness).toContain("Published versions");
    expect(releaseReadiness).toContain("@apet97/clockify-addon-sdk@1.0.0");
    expect(releaseReadiness).toContain("create-clockify-addon@1.0.0");

    for (const document of [
      rootReadme,
      packageReadme,
      creatorReadme,
      productSurface,
      releaseReadiness,
    ]) {
      expect(document).not.toContain("source-only");
      expect(document).not.toContain("not published to the npm registry");
    }

    expect(packageReadme).not.toContain("git+https://github.com/apet97/addon-ts-sdk.git#main");
    expect(packageReadme).toContain("npm pack --dry-run");
    expect(packageReadme).toContain("## Fetch and edge runtimes");
    expect(packageReadme).toContain("Hono");
    expect(packageReadme).toContain("handleFetchRequest(addon, request)");
    expect(rootReadme).toContain("npm run release:verify");
    expect(releaseReadiness).toContain(
      "npm publish --dry-run -w @apet97/clockify-addon-sdk --access public",
    );
    expect(releaseReadiness).toContain("explicit npm-owner approval");
    expect(qualityGates).toContain("npm run verify:public-api");
    expect(qualityGates).toContain("npm run verify:package-lint");
    expect(qualityGates).toContain("public-api.snapshot.md");
    expect(qualityGates).toContain("Node minimal");
    expect(qualityGates).toContain("Worker all-features");
    expect(qualityGates).toContain("executes their runtime");
    expect(qualityGates).toContain("installs the creator tarball");
    expect(qualityGates).toContain("Wrangler dry-runs");
    expect(releaseReadiness).toContain("Final-SHA manual checkpoint");
    expect(releaseReadiness).toContain("e74e1f7c1b307791b485f0a25b10a0df0fe7e725");
    expect(dependencyStrategy).toContain("`jose@6` is ESM-only");
    expect(dependencyStrategy).toContain("npm run verify:package-consumer");
    expect(dependencyStrategy).toContain("CommonJS support");
    expect(rootPackageJson.scripts["release:dry-run"]).toBe(
      "npm publish --dry-run -w @apet97/clockify-addon-sdk --access public && npm publish --dry-run -w create-clockify-addon --access public",
    );
    expect(rootPackageJson.scripts["release:verify"]).toBe(
      "npm run ci:verify && npm run verify:schema-live && npm run release:dry-run",
    );
    expect(packageJson.sideEffects).toBe(false);
    expect(creatorPackageJson.version).toBe("1.0.0");
    expect(packageJson.devDependencies["@types/node"]).toMatch(/^\^22\./);
    expect(evidenceMap).toContain("clockify-request-verifiers.ts");
    expect(evidenceMap).toContain("clockify-request-handlers.ts");
    expect(evidenceMap).toContain("clockify-request-wire.ts");
  });

  it("documents the secure server installation and webhook token recipe", () => {
    const packageReadme = readFileSync(resolve(packageRoot, "README.md"), "utf8");
    const recipe = readFileSync(resolve(packageRoot, "docs", "secure-server-recipe.md"), "utf8");

    expect(packageReadme).toContain("Secure Server Recipe");
    expect(recipe).toContain("withClockifyInstalledLifecycleRequest");
    expect(recipe).toContain("getExpectedWebhookAuthToken");
    expect(recipe).toContain("X-Addon-Token");
    expect(recipe).toContain("server-side");
    expect(recipe).toContain("does not add a Clockify REST client");
  });
});
