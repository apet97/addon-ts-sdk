import { describe, expect, it } from "vitest";
import { IllegalArgumentException, ValidationException, isAddonInputError } from "../src";

describe("isAddonInputError", () => {
  it("recognizes ValidationException and IllegalArgumentException", () => {
    expect(isAddonInputError(new ValidationException("bad path"))).toBe(true);
    expect(isAddonInputError(new IllegalArgumentException("duplicate"))).toBe(true);
  });

  it("does not recognize an unrelated error or non-error value", () => {
    expect(isAddonInputError(new Error("network down"))).toBe(false);
    expect(isAddonInputError("bad path")).toBe(false);
    expect(isAddonInputError(null)).toBe(false);
    expect(isAddonInputError(undefined)).toBe(false);
  });
});
