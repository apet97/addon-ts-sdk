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

  it("resolves a Function alias declared after a closing-over function", async () => {
    const findings = await inspect(
      'function compile(){ return Factory("return true") } const Factory = Function; compile();',
    );

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "function-constructor",
    ]);
  });

  it("does not leak an outer Function alias through a shadowing parameter", async () => {
    const findings = await inspect(
      'const Factory = Function; function safe(Factory){ return Factory("value") } safe((value) => value);',
    );

    expect(findings).toEqual([]);
  });

  it.each([
    [
      "parameter",
      'function safe(globalThis){ return globalThis.eval("value") } safe({ eval: (value) => value });',
    ],
    [
      "local binding",
      'const globalThis = { Function: (value) => value }; globalThis.Function("value");',
    ],
  ])("does not treat a shadowed globalThis %s as the intrinsic", async (_description, source) => {
    expect(await inspect(source)).toEqual([]);
  });

  it("does not leak an outer Function alias through a local const shadow", async () => {
    const findings = await inspect(
      'const Factory = Function; { const Factory = (value) => value; Factory("value"); }',
    );

    expect(findings).toEqual([]);
  });

  it.each([
    [
      "function parameters",
      'function safe(Function){ Function("value"); } safe((value) => value);',
    ],
    ["a block const", '{ const Function = (value) => value; Function("value"); }'],
    [
      "a catch parameter",
      'try { throw (value) => value; } catch (Function) { Function("value"); }',
    ],
    ["a function declaration", 'function Function(value){ return value; } Function("value");'],
    ["a class declaration", "class Function {} new Function();"],
    ["a var declaration", 'var Function = (value) => value; Function("value");'],
  ])("does not flag intrinsic names shadowed by %s", async (_description, source) => {
    expect(await inspect(source)).toEqual([]);
  });

  it.each([
    [
      "ForStatement",
      'for (const Function = (value) => value; false; ) { Function("value"); } Function("return 1")();',
    ],
    [
      "ForOfStatement",
      'const safe = (value) => value; for (const Function of [safe]) { Function("value"); } Function("return 1")();',
    ],
    [
      "ForInStatement",
      'for (const Function in { value: true }) { void Function; } Function("return 1")();',
    ],
  ])("keeps a %s lexical header binding inside the loop", async (_description, source) => {
    const findings = await inspect(source);

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "function-constructor",
    ]);
  });

  it("shares switch-case bindings without leaking them outside the switch", async () => {
    const findings = await inspect(`
const safe = (value) => value;
switch (Function("return 0")()) {
  case 0:
    const Function = safe;
    Function("value");
    break;
}
Function("return 1")();
`);

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "function-constructor",
      "function-constructor",
    ]);
  });

  it("keeps a class static-block binding inside that block", async () => {
    const findings = await inspect(`
const safe = (value) => value;
class Example {
  static { const Function = safe; Function("value"); }
  static { Function("return 1")(); }
}
`);

    expect(findings.map((finding: { readonly kind: string }) => finding.kind)).toEqual([
      "function-constructor",
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
