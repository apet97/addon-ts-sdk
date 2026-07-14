import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateClockifyManifest } from "../src/index";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function minimalManifest(schemaVersion: "1.2" | "1.3" | "1.4" | "1.5") {
  return {
    schemaVersion,
    key: "validator-test",
    name: "Validator Test",
    baseUrl: "https://example.com/addon",
    minimalSubscriptionPlan: "BASIC",
    scopes: [],
  };
}

describe("Clockify manifest validation", () => {
  it.each(["1.2", "1.3", "1.4", "1.5"] as const)(
    "validates supported schema version %s",
    (schemaVersion) => {
      const manifest = minimalManifest(schemaVersion);
      expect(validateClockifyManifest(manifest)).toEqual({ ok: true, value: manifest });
    },
  );

  it("preserves all-errors URI validation and normalized issue details", () => {
    const result = validateClockifyManifest({
      ...minimalManifest("1.5"),
      key: "",
      baseUrl: "http://",
    });

    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          instancePath: "/key",
          schemaPath: "#/properties/key/minLength",
          keyword: "minLength",
          message: "must NOT have fewer than 2 characters",
        },
        {
          instancePath: "/baseUrl",
          schemaPath: "#/definitions/url/format",
          keyword: "format",
          message: 'must match format "uri"',
        },
      ]),
    );
  });

  it("counts Unicode code points for schema string lengths", () => {
    expect(validateClockifyManifest({ ...minimalManifest("1.5"), key: "😀" })).toMatchObject({
      ok: false,
      issues: [
        {
          instancePath: "/key",
          schemaPath: "#/properties/key/minLength",
          keyword: "minLength",
        },
      ],
    });
    expect(
      validateClockifyManifest({ ...minimalManifest("1.5"), name: "😀".repeat(50) }),
    ).toMatchObject({ ok: true });
    expect(
      validateClockifyManifest({ ...minimalManifest("1.5"), name: "😀".repeat(51) }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          instancePath: "/name",
          schemaPath: "#/properties/name/maxLength",
          keyword: "maxLength",
        },
      ],
    });
  });

  it("uses JSON deep equality for uniqueItems", () => {
    const component = {
      type: "widget",
      accessLevel: "EVERYONE",
      path: "/component",
      label: "Widget",
      options: { nested: [1, { enabled: true }] },
    };
    const result = validateClockifyManifest({
      ...minimalManifest("1.5"),
      components: [component, structuredClone(component)],
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [
        {
          instancePath: "/components",
          schemaPath: "#/properties/components/uniqueItems",
          keyword: "uniqueItems",
          message: "must NOT have duplicate items (items ## 0 and 1 are identical)",
        },
      ],
    });
  });

  it("validates when runtime string code generation is disabled", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "clockify-validator-no-codegen-"));
    const probePath = join(tempDir, "probe.ts");
    const sourceEntrypoint = new URL("../src/index.ts", import.meta.url).href;
    writeFileSync(
      probePath,
      [
        'import assert from "node:assert/strict";',
        `import { validateClockifyManifest } from ${JSON.stringify(sourceEntrypoint)};`,
        `const valid = ${JSON.stringify(minimalManifest("1.5"))};`,
        "assert.deepEqual(validateClockifyManifest(valid), { ok: true, value: valid });",
        "assert.equal(validateClockifyManifest({ ...valid, key: '' }).ok, false);",
        "",
      ].join("\n"),
      "utf8",
    );

    try {
      const result = spawnSync(
        process.execPath,
        ["--disallow-code-generation-from-strings", "--import", "tsx", probePath],
        { cwd: packageRoot, encoding: "utf8" },
      );
      expect(
        { status: result.status, signal: result.signal, stderr: result.stderr },
        result.stdout,
      ).toEqual({ status: 0, signal: null, stderr: "" });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
