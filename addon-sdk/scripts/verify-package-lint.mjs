import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const creatorRoot = join(packageRoot, "..", "create-clockify-addon");
const workspace = mkdtempSync(join(tmpdir(), "clockify-addon-sdk-package-lint-"));
const attwPackageJson = require.resolve("@arethetypeswrong/cli/package.json");
const publintBin = join(dirname(require.resolve("publint")), "cli.js");
const attwBin = join(dirname(attwPackageJson), "dist", "index.js");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    stdio: options.stdio ?? "inherit",
    encoding: "utf8",
  });
}

try {
  for (const { root, profile } of [
    { root: packageRoot, profile: "node16" },
    { root: creatorRoot, profile: "esm-only" },
  ]) {
    const output = run(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", workspace, "--json"],
      { cwd: root, stdio: "pipe" },
    );
    const [{ filename }] = JSON.parse(output);
    const tarball = join(workspace, filename);

    run(process.execPath, [publintBin, "run", tarball, "--strict"]);
    run(process.execPath, [attwBin, tarball, "--profile", profile]);
  }
  console.log("verify:package-lint OK - both packed packages pass publint and type resolution.");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
