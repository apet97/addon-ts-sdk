// Compare the freshly regenerated models against the snapshot; fail (exit 1) on any drift.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const genDir = path.join(__dirname, "..", "src", "clockify", "generated");
const snapDir = path.join(os.tmpdir(), "clockify-addon-generated-snapshot");

let drift = false;
const snap = fs.readdirSync(snapDir);
for (const f of snap) {
  const before = fs.readFileSync(path.join(snapDir, f), "utf8");
  const after = fs.readFileSync(path.join(genDir, f), "utf8");
  if (before !== after) {
    console.error("DRIFT: " + f + " differs from a fresh generation");
    drift = true;
  }
}
for (const f of fs.readdirSync(genDir)) {
  if (!snap.includes(f)) {
    console.error("NEW uncommitted generated file: " + f);
    drift = true;
  }
}
fs.rmSync(snapDir, { recursive: true, force: true });

if (drift) {
  console.error("Generated models are out of sync with the schemas. Run `npm run generate` and commit the result.");
  process.exit(1);
}
console.log("OK: generated models are in sync with the schemas.");
