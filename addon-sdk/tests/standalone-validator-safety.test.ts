import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const safetyModuleUrl = new URL("../scripts/standalone-validator-safety.ts", import.meta.url).href;
const safetyModuleExists = existsSync(fileURLToPath(safetyModuleUrl));

describe("standalone validator safety", () => {
  it("provides the codegen safety module", () => {
    expect(safetyModuleExists).toBe(true);
  });

  it.each([
    ["static", 'import runtime from "./runtime.js"; void runtime;'],
    ["dynamic", 'const runtime = import("./runtime.js"); void runtime;'],
  ])("rejects %s imports", async (_kind, source) => {
    if (!safetyModuleExists) return;
    const { assertStandaloneValidatorSafety } = await import(safetyModuleUrl);
    expect(() => assertStandaloneValidatorSafety(source)).toThrow(/import/u);
  });

  it.each([
    ["indirect eval", '(0, eval)("return true");'],
    ["aliased Function constructor", 'const Factory = Function; new Factory("return true");'],
    [
      "forward Function alias",
      'function compile(){ return Factory("return true") } const Factory = Function; compile();',
    ],
  ])("rejects %s string code generation", async (_kind, source) => {
    if (!safetyModuleExists) return;
    const { assertStandaloneValidatorSafety } = await import(safetyModuleUrl);
    expect(() => assertStandaloneValidatorSafety(source)).toThrow(
      /eval-call|function-constructor/u,
    );
  });

  it("accepts self-contained validator JavaScript", async () => {
    if (!safetyModuleExists) return;
    const { assertStandaloneValidatorSafety } = await import(safetyModuleUrl);
    expect(() =>
      assertStandaloneValidatorSafety("export const validate = (value) => value !== null;"),
    ).not.toThrow();
  });
});
