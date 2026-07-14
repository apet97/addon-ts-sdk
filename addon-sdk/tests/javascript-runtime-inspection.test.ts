import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const inspectorUrl = new URL("../../scripts/javascript-runtime-inspection.mjs", import.meta.url)
  .href;
const inspectorExists = existsSync(fileURLToPath(inspectorUrl));

async function inspect(source: string, options?: { readonly forbidImports?: boolean }) {
  if (!inspectorExists) return [];
  const { inspectRuntimeJavaScript } = await import(inspectorUrl);
  return inspectRuntimeJavaScript(source, options);
}

describe("runtime JavaScript inspection", () => {
  it("provides the syntax-aware inspector module", () => {
    expect(inspectorExists).toBe(true);
  });

  it("ignores compiler-like text in strings and comments", async () => {
    const findings = await inspect(
      `const notes = [
  "eval('payload')",
  "new Function('payload')",
  "require('ajv/dist/compile')",
  "compileSchema CodeGen import('ajv')",
];
// eval("payload"); new Function("payload"); require("ajv");
/* class CodeGen {}; const compileSchema = () => true; */
export default notes;
`,
      { forbidImports: true },
    );

    expect(findings).toEqual([]);
  });

  it("detects executable string-code-generation and require calls", async () => {
    const findings = await inspect(`
eval("payload");
new Function("payload");
require("left-pad");
`);

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "eval-call",
      "function-constructor",
      "require-call",
    ]);
  });

  it.each([
    ["global eval member", 'globalThis.eval("payload");', "eval-call"],
    ["computed global eval member", 'globalThis["eval"]("payload");', "eval-call"],
    ["indirect eval sequence", '(0, eval)("payload");', "eval-call"],
    ["global Function constructor", 'new globalThis.Function("payload");', "function-constructor"],
    [
      "computed global Function constructor",
      'new globalThis["Function"]("payload");',
      "function-constructor",
    ],
    ["immutable Function alias", 'const F = Function; new F("payload");', "function-constructor"],
  ])("detects %s", async (_description, source, expectedKind) => {
    const findings = await inspect(source);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: expectedKind,
        line: 1,
      }),
    ]);
  });

  it("detects imported and executable AJV compiler markers", async () => {
    const findings = await inspect(`
import Ajv from "ajv";
const lazyCompiler = import("ajv/dist/compile/index.js");
class CodeGen {}
const compileSchema = () => true;
void Ajv;
void lazyCompiler;
`);
    const kinds = findings.map((finding: { readonly kind: string }) => finding.kind);

    expect(kinds.filter((kind: string) => kind === "ajv-import")).toHaveLength(2);
    expect(kinds.filter((kind: string) => kind === "ajv-compiler")).toHaveLength(2);
  });

  it("can reject all static and dynamic imports for self-contained output", async () => {
    const findings = await inspect(
      `import value from "./runtime.js";
const lazy = import("./lazy.js");
void value;
void lazy;
`,
      { forbidImports: true },
    );

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "static-import",
      "dynamic-import",
    ]);
  });

  it("declares Acorn only as a root development dependency", () => {
    const repoRoot = resolve(import.meta.dirname, "../..");
    const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const sdkPackage = JSON.parse(
      readFileSync(resolve(repoRoot, "addon-sdk", "package.json"), "utf8"),
    );

    const acornVersion = rootPackage.devDependencies?.acorn;
    expect(typeof acornVersion === "string" && /^\^8\./u.test(acornVersion)).toBe(true);
    expect(sdkPackage.dependencies.acorn).toBeUndefined();
    expect(sdkPackage.devDependencies.acorn).toBeUndefined();
  });
});
