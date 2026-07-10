import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldClockifyAddon } from "../src/index.mjs";

const root = new URL("../..", import.meta.url).pathname;
const temp = mkdtempSync(join(tmpdir(), "clockify-addon-scaffolds-"));

try {
  execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--pack-destination",
      temp,
      "-w",
      "@apet97/clockify-addon-sdk",
    ],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  const tarball = join(
    temp,
    readdirSync(temp).find((name) => name.endsWith(".tgz")),
  );
  for (const runtime of ["node", "worker"]) {
    const directory = join(temp, runtime);
    await scaffoldClockifyAddon({
      directory,
      runtime,
      features: "all",
      sdkSpec: `file:${tarball}`,
    });
    execFileSync(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      { cwd: directory, stdio: "inherit" },
    );
    execFileSync("npm", ["run", "typecheck"], {
      cwd: directory,
      stdio: "inherit",
    });
  }
  console.log(
    "verify:scaffolds OK - packed SDK type-checks in Node and Worker projects.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
