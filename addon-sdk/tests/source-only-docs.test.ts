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

    expect(packageReadme).not.toContain("npm install @apet97/clockify-addon-sdk");
    expect(packageReadme).not.toContain("git+https://github.com/apet97/addon-ts-sdk.git#main");
    expect(`${rootReadme}\n${packageReadme}\n${productSurface}`).toContain("source-only");
    expect(packageReadme).toContain("npm pack --dry-run");
    expect(packageReadme).toContain(
      "npm install /absolute/path/to/apet97-clockify-addon-sdk-1.0.0.tgz",
    );
    expect(productSurface).toContain("not published to the npm registry");
  });
});
