const fs = require("node:fs");
const path = require("node:path");

const cjsDir = path.resolve(__dirname, "..", "dist", "cjs");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
    } else if (entry.isFile() && absolute.endsWith(".d.ts")) {
      fs.copyFileSync(absolute, absolute.replace(/\.d\.ts$/, ".d.cts"));
    }
  }
}

if (!fs.existsSync(cjsDir)) {
  throw new Error(`Missing CJS dist directory: ${cjsDir}`);
}

walk(cjsDir);
console.log("Copied CJS declarations to .d.cts files");
