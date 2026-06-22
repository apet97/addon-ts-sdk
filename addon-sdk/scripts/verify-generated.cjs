const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const committedDir = path.join(rootDir, "src", "clockify", "generated");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clockify-addon-generated-"));
const tempGeneratedDir = path.join(tempRoot, "generated");

function listFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath).map((child) => path.join(entry.name, child));
      }
      return [entry.name];
    })
    .sort();
}

function sameList(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

try {
  const tsxPackagePath = require.resolve("tsx/package.json");
  const tsxCli = path.join(path.dirname(tsxPackagePath), "dist", "cli.mjs");
  const generator = path.join(__dirname, "generate-clockify-manifest.ts");
  const generated = spawnSync(
    process.execPath,
    [tsxCli, generator, "--out-dir", tempGeneratedDir],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  if (generated.status !== 0) {
    process.exit(generated.status ?? 1);
  }

  const committedFiles = listFiles(committedDir);
  const generatedFiles = listFiles(tempGeneratedDir);
  let drift = false;

  if (!sameList(committedFiles, generatedFiles)) {
    console.error("Generated file set is out of sync with the schemas.");
    console.error(`Committed: ${committedFiles.join(", ")}`);
    console.error(`Fresh: ${generatedFiles.join(", ")}`);
    drift = true;
  }

  for (const file of committedFiles.filter((fileName) => generatedFiles.includes(fileName))) {
    const committed = fs.readFileSync(path.join(committedDir, file), "utf8");
    const fresh = fs.readFileSync(path.join(tempGeneratedDir, file), "utf8");
    if (committed !== fresh) {
      console.error(`DRIFT: ${file} differs from a fresh generation`);
      drift = true;
    }
  }

  if (drift) {
    console.error(
      "Generated models are out of sync with the schemas. Run `npm run generate` and commit the result.",
    );
    process.exit(1);
  }

  console.log("OK: generated models are in sync with the schemas.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
