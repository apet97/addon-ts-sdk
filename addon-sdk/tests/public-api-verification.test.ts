import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const node = process.execPath;
const packageRoot = process.cwd();
const repoRoot = resolve(packageRoot, "..");
const scriptPath = join(packageRoot, "scripts", "verify-public-api.cjs");

function writeFixtureDist(
  root: string,
  exportedBody = "export interface Widget { readonly id: string; }\n",
) {
  const esmDir = join(root, "dist", "esm");
  for (const entry of ["clockify", "adapters", "testing"]) {
    mkdirSync(join(esmDir, entry), { recursive: true });
    writeFileSync(join(esmDir, entry, "index.d.ts"), "export {};\n", "utf8");
  }

  writeFileSync(join(esmDir, "index.d.ts"), 'export * from "./widget.js";\n', "utf8");
  writeFileSync(join(esmDir, "widget.d.ts"), exportedBody, "utf8");
  writeFixturePackageJson(root);
}

function writeFixturePackageJson(root: string, rootTypes = "./dist/esm/index.d.ts") {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        exports: {
          ".": { types: rootTypes },
          "./clockify": { types: "./dist/esm/clockify/index.d.ts" },
          "./adapters": { types: "./dist/esm/adapters/index.d.ts" },
          "./testing": { types: "./dist/esm/testing/index.d.ts" },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

function writeNestedExportFixturePackageJson(root: string) {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        exports: {
          ".": {
            import: {
              types: "./dist/esm/index.d.ts",
              default: "./dist/esm/index.js",
            },
            require: {
              types: "./dist/cjs/index.d.cts",
              default: "./dist/cjs/index.js",
            },
          },
          "./clockify": {
            import: {
              types: "./dist/esm/clockify/index.d.ts",
              default: "./dist/esm/clockify/index.js",
            },
            require: {
              types: "./dist/cjs/clockify/index.d.cts",
              default: "./dist/cjs/clockify/index.js",
            },
          },
          "./adapters": {
            import: {
              types: "./dist/esm/adapters/index.d.ts",
              default: "./dist/esm/adapters/index.js",
            },
            require: {
              types: "./dist/cjs/adapters/index.d.cts",
              default: "./dist/cjs/adapters/index.js",
            },
          },
          "./testing": {
            import: {
              types: "./dist/esm/testing/index.d.ts",
              default: "./dist/esm/testing/index.js",
            },
            require: {
              types: "./dist/cjs/testing/index.d.cts",
              default: "./dist/cjs/testing/index.js",
            },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

function runVerifier(cwd: string, snapshotPath: string, distDir: string): string {
  return execFileSync(
    node,
    [
      scriptPath,
      "--snapshot",
      snapshotPath,
      "--dist-dir",
      distDir,
      "--package-json",
      join(cwd, "package.json"),
    ],
    {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("public API verification", () => {
  it("is wired into the package and root verification gates", () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["verify:public-api"]).toBe("node scripts/verify-public-api.cjs");
    expect(packageJson.scripts.prepack).toContain("npm run verify:public-api");
    expect(rootPackageJson.scripts["verify:public-api"]).toBe(
      "npm run verify:public-api -w @apet97/clockify-addon-sdk",
    );
    expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:public-api");
  });

  it("passes when the public API declaration snapshot matches", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-public-api-match-"));
    try {
      writeFixtureDist(dir);
      const snapshot = join(dir, "public-api.snapshot.txt");
      execFileSync(
        node,
        [
          scriptPath,
          "--snapshot",
          snapshot,
          "--dist-dir",
          join(dir, "dist", "esm"),
          "--package-json",
          join(dir, "package.json"),
          "--update",
        ],
        { cwd: dir, stdio: "pipe" },
      );

      expect(readFileSync(snapshot, "utf8")).toContain(
        "export interface Widget { readonly id: string; }",
      );

      expect(runVerifier(dir, snapshot, join(dir, "dist", "esm"))).toContain(
        "Public API snapshot OK",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tracks declarations from the package export type paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-public-api-exports-"));
    try {
      writeFixtureDist(dir);
      writeFileSync(
        join(dir, "dist", "esm", "package-root.d.ts"),
        "export interface ExportedFromPackageMap { readonly id: string; }\n",
        "utf8",
      );
      writeFixturePackageJson(dir, "./dist/esm/package-root.d.ts");

      const snapshot = join(dir, "public-api.snapshot.txt");
      execFileSync(
        node,
        [
          scriptPath,
          "--snapshot",
          snapshot,
          "--dist-dir",
          join(dir, "dist", "esm"),
          "--package-json",
          join(dir, "package.json"),
          "--update",
        ],
        { cwd: dir, stdio: "pipe" },
      );

      const snapshotText = readFileSync(snapshot, "utf8");
      expect(snapshotText).toContain("package-root.d.ts");
      expect(snapshotText).toContain("ExportedFromPackageMap");
      expect(snapshotText).not.toContain("Widget");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tracks ESM declarations from nested package export import types", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-public-api-nested-exports-"));
    try {
      writeFixtureDist(dir);
      mkdirSync(join(dir, "dist", "cjs", "clockify"), { recursive: true });
      mkdirSync(join(dir, "dist", "cjs", "adapters"), { recursive: true });
      mkdirSync(join(dir, "dist", "cjs", "testing"), { recursive: true });
      writeFileSync(
        join(dir, "dist", "cjs", "index.d.cts"),
        "export interface CjsOnlyDeclaration { readonly id: string; }\n",
        "utf8",
      );
      for (const entry of ["clockify", "adapters", "testing"]) {
        writeFileSync(join(dir, "dist", "cjs", entry, "index.d.cts"), "export {};\n", "utf8");
      }
      writeNestedExportFixturePackageJson(dir);

      const snapshot = join(dir, "public-api.snapshot.txt");
      execFileSync(
        node,
        [
          scriptPath,
          "--snapshot",
          snapshot,
          "--dist-dir",
          join(dir, "dist", "esm"),
          "--package-json",
          join(dir, "package.json"),
          "--update",
        ],
        { cwd: dir, stdio: "pipe" },
      );

      const snapshotText = readFileSync(snapshot, "utf8");
      expect(snapshotText).toContain("widget.d.ts");
      expect(snapshotText).toContain("Widget");
      expect(snapshotText).not.toContain("CjsOnlyDeclaration");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when an exported declaration changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockify-public-api-drift-"));
    try {
      writeFixtureDist(dir);
      const snapshot = join(dir, "public-api.snapshot.txt");
      execFileSync(
        node,
        [
          scriptPath,
          "--snapshot",
          snapshot,
          "--dist-dir",
          join(dir, "dist", "esm"),
          "--package-json",
          join(dir, "package.json"),
          "--update",
        ],
        { cwd: dir, stdio: "pipe" },
      );

      writeFixtureDist(dir, "export interface Widget { readonly id: number; }\n");

      expect(() => runVerifier(dir, snapshot, join(dir, "dist", "esm"))).toThrow(
        /Public API snapshot is out of date/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tracks all public package entry points", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain('"root"');
    expect(script).toContain('"clockify"');
    expect(script).toContain('"adapters"');
    expect(script).toContain('"testing"');
    expect(script).toContain('"dist", "esm"');
    expect(script).toContain("public-api.snapshot");
  });
});
