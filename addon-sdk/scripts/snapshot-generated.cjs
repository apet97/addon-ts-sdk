// Snapshot the currently committed generated models to a temp dir (pure fs, no child processes).
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const genDir = path.join(__dirname, "..", "src", "clockify", "generated");
const snapDir = path.join(os.tmpdir(), "clockify-addon-generated-snapshot");

fs.rmSync(snapDir, { recursive: true, force: true });
fs.cpSync(genDir, snapDir, { recursive: true });
console.log("Snapshot taken.");
