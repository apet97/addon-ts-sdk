import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published distribution docs", () => {
  const packageRoot = process.cwd();
  const repoRoot = resolve(packageRoot, "..");

  it("provides a builder-first documentation path", () => {
    const builderDocs = ["docs/README.md", "docs/getting-started.md", "docs/how-an-addon-works.md"];
    for (const file of builderDocs) expect(existsSync(resolve(repoRoot, file))).toBe(true);

    const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
    const index = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
    const gettingStarted = readFileSync(resolve(repoRoot, "docs/getting-started.md"), "utf8");
    const lifecycle = readFileSync(resolve(repoRoot, "docs/how-an-addon-works.md"), "utf8");

    expect(rootReadme).toContain("docs/getting-started.md");
    expect(rootReadme).toContain("npm create clockify-addon@latest");
    expect(index).toContain("getting-started.md");
    expect(index).toContain("how-an-addon-works.md");
    expect(gettingStarted).toContain("GET /manifest");
    expect(gettingStarted).toContain("PUBLIC_BASE_URL");
    expect(gettingStarted).toContain("CLOCKIFY_PARENT_ORIGIN");
    for (const owner of ["Clockify", "SDK", "Add-on application"]) {
      expect(lifecycle).toContain(owner);
    }
    for (const stage of ["INSTALLED", "auth_token", "webhook", "X-Addon-Token", "DELETED"]) {
      expect(lifecycle).toContain(stage);
    }
  });

  it("documents missing webhook tokens at the verification boundary", () => {
    const lifecycle = readFileSync(resolve(repoRoot, "docs/how-an-addon-works.md"), "utf8");
    const unavailable = lifecycle.match(/- `503 Service Unavailable`:[\s\S]*?(?=\n\n|$)/)?.[0];

    expect(lifecycle).toContain("Missing expected webhook tokens");
    expect(lifecycle).toContain("before the scaffold handler runs");
    expect(unavailable).toBeDefined();
    expect(unavailable).not.toContain("webhook");
  });

  it("distinguishes transient component tokens from stored credentials", () => {
    const lifecycle = readFileSync(resolve(repoRoot, "docs/how-an-addon-works.md"), "utf8");

    expect(lifecycle).toContain("transiently in the iframe query URL");
    expect(lifecycle).toContain("must not be logged, persisted, or re-emitted");
    expect(lifecycle).toContain("Installation and webhook credentials remain server-side");
  });

  it("runs the manifest probe from a second terminal", () => {
    const gettingStarted = readFileSync(resolve(repoRoot, "docs/getting-started.md"), "utf8");

    expect(gettingStarted).toContain("In a second terminal");
  });

  it("ships complete npm release metadata for both packages", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const creatorPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "create-clockify-addon", "package.json"), "utf8"),
    );

    expect(packageJson).toMatchObject({
      name: "@apet97/clockify-addon-sdk",
      publishConfig: { access: "public" },
      repository: {
        type: "git",
        url: "git+https://github.com/apet97/addon-ts-sdk.git",
        directory: "addon-sdk",
      },
    });
    expect(creatorPackageJson).toMatchObject({
      name: "create-clockify-addon",
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
    const securityPolicy = readFileSync(resolve(repoRoot, "SECURITY.md"), "utf8");
    const architecture = readFileSync(resolve(repoRoot, "docs", "architecture.md"), "utf8");
    const preReleaseMigration = readFileSync(
      resolve(repoRoot, "docs", "pre-release-migration.md"),
      "utf8",
    );
    const qualityGates = readFileSync(resolve(repoRoot, "docs", "quality-gates.md"), "utf8");
    const dependencyStrategy = readFileSync(
      resolve(packageRoot, "docs", "dependency-strategy.md"),
      "utf8",
    );
    const agents = readFileSync(resolve(repoRoot, "AGENTS.md"), "utf8");
    const claude = readFileSync(resolve(repoRoot, "CLAUDE.md"), "utf8");
    const evidenceMap = readFileSync(
      resolve(packageRoot, "docs", "porting", "evidence-map.md"),
      "utf8",
    );
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const packageLock = JSON.parse(readFileSync(resolve(repoRoot, "package-lock.json"), "utf8"));
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
    expect(releaseReadiness).toContain(`${packageJson.name}@${packageJson.version}`);
    expect(releaseReadiness).toContain(`${creatorPackageJson.name}@${creatorPackageJson.version}`);

    const activeVersionNeutralDocuments = [
      rootReadme,
      packageReadme,
      productSurface,
      qualityGates,
      agents,
      claude,
    ];
    for (const version of new Set([packageJson.version, creatorPackageJson.version])) {
      for (const document of activeVersionNeutralDocuments) {
        expect(document).not.toContain(version);
      }
    }

    for (const document of [
      rootReadme,
      packageReadme,
      creatorReadme,
      productSurface,
      releaseReadiness,
      securityPolicy,
      architecture,
      preReleaseMigration,
    ]) {
      expect(document).not.toContain("source-only");
      expect(document).not.toContain("not published to the npm registry");
      expect(document).not.toContain("not been published to npm");
      expect(document).not.toContain("no published npm version");
    }

    expect(securityPolicy).toContain("current npm `latest` release");
    expect(preReleaseMigration).toContain("Before the public `1.0.0` release");
    expect(architecture).toMatch(
      /legacy\s+`\/adapters` aggregate remains available for package consumers/,
    );
    expect(packageReadme).not.toContain("git+https://github.com/apet97/addon-ts-sdk.git#main");
    expect(packageReadme).toContain("npm pack --dry-run");
    expect(packageReadme).toContain("## Fetch and edge runtimes");
    expect(packageReadme).toContain("Hono");
    expect(packageReadme).toContain("handleFetchRequest(addon, request)");
    expect(rootReadme).toContain("npm run release:verify");
    expect(rootReadme).toContain("npm run verify:registry");
    expect(releaseReadiness).toContain("npm run release:preflight");
    expect(releaseReadiness).toContain("npm run verify:registry");
    expect(releaseReadiness).toContain(
      "Run `release:verify` only for unpublished workspace versions",
    );
    expect(releaseReadiness).not.toContain(
      `npm view ${packageJson.name}@${packageJson.version} version`,
    );
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
    expect(qualityGates).toContain("npm run release:preflight");
    expect(qualityGates).toContain("npm run verify:registry");
    expect(releaseReadiness).toContain("Final-SHA manual checkpoint");
    expect(releaseReadiness).toContain("e74e1f7c1b307791b485f0a25b10a0df0fe7e725");
    expect(dependencyStrategy).toContain("`jose@6` is ESM-only");
    expect(dependencyStrategy).toContain("npm run verify:package-consumer");
    expect(dependencyStrategy).toContain("CommonJS support");
    expect(rootPackageJson.scripts["release:dry-run"]).toBe(
      "npm publish --dry-run -w @apet97/clockify-addon-sdk --access public && npm publish --dry-run -w create-clockify-addon --access public",
    );
    expect(rootPackageJson.scripts["release:preflight"]).toBe("node scripts/release-preflight.mjs");
    expect(rootPackageJson.scripts["verify:registry"]).toBe(
      "node scripts/verify-registry-consumer.mjs",
    );
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain("release:preflight");
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain("verify:registry");
    expect(rootPackageJson.scripts["release:verify"]).toBe(
      "npm run ci:verify && npm run verify:schema-live && npm run release:dry-run",
    );
    expect(packageJson.sideEffects).toBe(false);
    expect(packageLock.packages["addon-sdk"].version).toBe(packageJson.version);
    expect(packageLock.packages["create-clockify-addon"].version).toBe(creatorPackageJson.version);
    expect(packageJson.devDependencies["@types/node"]).toMatch(/^\^22\./);
    expect(evidenceMap).toContain("clockify-request-verifiers.ts");
    expect(evidenceMap).toContain("clockify-request-handlers.ts");
    expect(evidenceMap).toContain("clockify-request-wire.ts");
  });

  it("keeps AGENTS.md and CLAUDE.md synchronized after their introductions", () => {
    const agents = readFileSync(resolve(repoRoot, "AGENTS.md"), "utf8").split("\n").slice(4);
    const claude = readFileSync(resolve(repoRoot, "CLAUDE.md"), "utf8").split("\n").slice(4);

    expect(agents).toEqual(claude);
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
