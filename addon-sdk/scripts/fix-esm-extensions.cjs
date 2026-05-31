// Post-build fixup for the ESM output.
//
// `tsconfig.esm.json` compiles the (commonjs-typed) sources, so even under `module: NodeNext`
// TypeScript leaves relative specifiers extensionless. Node's ESM loader and TypeScript's
// NodeNext resolution both REQUIRE explicit extensions, so the raw output cannot be imported as
// ESM (named imports fail at link time) and its `.d.ts` directory re-exports fail to resolve.
//
// This rewrites every relative specifier in `dist/esm/**/*.{js,d.ts}` to a concrete path:
//   "./shared/addon"  -> "./shared/addon.js"      (a file)
//   "./clockify"      -> "./clockify/index.js"    (a directory barrel)
// It only touches relative specifiers ("./" or "../"); bare specifiers (jose, node:http) are left.
const fs = require("node:fs");
const path = require("node:path");

const esmDir = path.join(__dirname, "..", "dist", "esm");

if (!fs.existsSync(esmDir)) {
  console.error("dist/esm not found; run the esm tsc step first.");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|d\.ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveSpecifier(fileDir, spec) {
  if (spec.endsWith(".js")) return spec; // already concrete
  const target = path.resolve(fileDir, spec);
  if (fs.existsSync(target + ".js")) return spec + ".js";
  if (fs.existsSync(path.join(target, "index.js"))) {
    return spec.replace(/\/?$/, "") + "/index.js";
  }
  return spec; // leave anything we can't resolve (should not happen)
}

// Matches the specifier in `from "..."`, `import "..."`, and `export ... from "..."`.
const RELATIVE_FROM = /(\bfrom\s*["'])(\.[^"']*)(["'])/g;
const RELATIVE_BARE_IMPORT = /(\bimport\s*["'])(\.[^"']*)(["'])/g;

let changedFiles = 0;
let changedSpecs = 0;
for (const file of walk(esmDir)) {
  const fileDir = path.dirname(file);
  const src = fs.readFileSync(file, "utf8");
  let dirty = false;
  const rewrite = (_m, pre, spec, post) => {
    const fixed = resolveSpecifier(fileDir, spec);
    if (fixed !== spec) {
      dirty = true;
      changedSpecs++;
    }
    return pre + fixed + post;
  };
  const next = src.replace(RELATIVE_FROM, rewrite).replace(RELATIVE_BARE_IMPORT, rewrite);
  if (dirty) {
    fs.writeFileSync(file, next, "utf8");
    changedFiles++;
  }
}

console.log(`Fixed ESM relative specifiers: ${changedSpecs} in ${changedFiles} files.`);
