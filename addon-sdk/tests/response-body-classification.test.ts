import { describe, expect, it } from "vitest";
import { isJsonBody } from "../src";

describe("isJsonBody", () => {
  it("treats plain objects and arrays as JSON", () => {
    expect(isJsonBody({})).toBe(true);
    expect(isJsonBody({ a: 1 })).toBe(true);
    expect(isJsonBody([1, 2, 3])).toBe(true);
    expect(isJsonBody(Object.create(null))).toBe(true);
  });

  it("does not treat strings, bytes, or null/undefined as JSON", () => {
    expect(isJsonBody("text")).toBe(false);
    expect(isJsonBody(new Uint8Array([1, 2]))).toBe(false);
    expect(isJsonBody(null)).toBe(false);
    expect(isJsonBody(undefined)).toBe(false);
  });

  it("does not treat a class instance as JSON, even when JSON.stringify would silently discard its data", () => {
    // JSON.stringify(new Map(...)) / JSON.stringify(new Set(...)) both produce "{}",
    // silently dropping every entry — these must never be classified as a JSON body.
    expect(isJsonBody(new Map([["a", 1]]))).toBe(false);
    expect(isJsonBody(new Set([1, 2]))).toBe(false);
    expect(isJsonBody(/re/)).toBe(false);

    class Custom {
      value = 1;
    }
    expect(isJsonBody(new Custom())).toBe(false);
  });

  it("treats Date as JSON, since JSON.stringify serializes it meaningfully (an ISO string) rather than discarding its data", () => {
    const date = new Date("2026-08-07T10:00:00.000Z");
    expect(isJsonBody(date)).toBe(true);
    expect(JSON.stringify(date)).toBe('"2026-08-07T10:00:00.000Z"');
  });
});
