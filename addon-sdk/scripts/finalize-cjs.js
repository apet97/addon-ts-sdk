const fs = require("fs");
const path = require("path");

function main() {
  const root = path.join(__dirname, "..");
  
  const cjsDir = path.join(root, "dist", "cjs");
  if (fs.existsSync(cjsDir)) {
    fs.writeFileSync(
      path.join(cjsDir, "package.json"),
      JSON.stringify({ type: "commonjs" }, null, 2),
      "utf-8"
    );
    console.log("Wrote type: commonjs to dist/cjs/package.json");
  }

  const esmDir = path.join(root, "dist", "esm");
  if (fs.existsSync(esmDir)) {
    fs.writeFileSync(
      path.join(esmDir, "package.json"),
      JSON.stringify({ type: "module" }, null, 2),
      "utf-8"
    );
    console.log("Wrote type: module to dist/esm/package.json");
  }
}

main();
