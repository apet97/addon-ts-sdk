import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("source-only distribution docs", () => {
  const packageRoot = process.cwd();
  const repoRoot = resolve(packageRoot, "..");

  it("does not advertise npm registry install while the SDK is source-only", () => {
    const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
    const packageReadme = readFileSync(resolve(packageRoot, "README.md"), "utf8");
    const productSurface = readFileSync(resolve(repoRoot, "docs", "product-surface.md"), "utf8");
    const releaseReadiness = readFileSync(
      resolve(repoRoot, "docs", "release-readiness.md"),
      "utf8",
    );
    const evidenceMap = readFileSync(
      resolve(packageRoot, "docs", "porting", "evidence-map.md"),
      "utf8",
    );
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

    expect(packageReadme).not.toContain("npm install @apet97/clockify-addon-sdk");
    expect(packageReadme).not.toContain("git+https://github.com/apet97/addon-ts-sdk.git#main");
    expect(`${rootReadme}\n${packageReadme}\n${productSurface}\n${releaseReadiness}`).toContain(
      "source-only",
    );
    expect(packageReadme).toContain("npm pack --dry-run");
    expect(packageReadme).toContain(
      "npm install /absolute/path/to/apet97-clockify-addon-sdk-1.0.0.tgz",
    );
    expect(packageReadme).toContain("## Fetch and edge runtimes");
    expect(packageReadme).toContain("Hono");
    expect(packageReadme).toContain("handleFetchRequest(addon, request)");
    expect(productSurface).toContain("not published to the npm registry");
    expect(rootReadme).toContain("npm run release:verify");
    expect(releaseReadiness).toContain(
      "npm publish --dry-run -w @apet97/clockify-addon-sdk --access public",
    );
    expect(releaseReadiness).toContain("Do not run a real npm publish");
    expect(rootPackageJson.scripts["release:dry-run"]).toBe(
      "npm publish --dry-run -w @apet97/clockify-addon-sdk --access public",
    );
    expect(rootPackageJson.scripts["release:verify"]).toBe(
      "npm run ci:verify && npm run verify:schema-live && npm run release:dry-run",
    );
    expect(packageJson.devDependencies["@types/node"]).toMatch(/^\^22\./);
    expect(packageJson.sideEffects).toBe(false);
    expect(evidenceMap).toContain("clockify-request-verifiers.ts");
    expect(evidenceMap).toContain("clockify-request-handlers.ts");
    expect(evidenceMap).toContain("clockify-request-wire.ts");
  });
});
