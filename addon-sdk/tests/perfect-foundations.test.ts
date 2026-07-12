import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ClockifyManifest,
  createValidatedClockifyAddon,
  assertClockifyManifest,
  buildClockifySecurityHeaders,
  createClockifyHtmlResponse,
  createClockifyJsonResponse,
  resolveClockifyPublicOrigin,
  validateClockifyManifest,
} from "../src/index";

describe("runtime-neutral foundations", () => {
  it("keeps Node-only adapters out of the root entrypoint", async () => {
    const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(source).not.toContain('export * from "./adapters/index"');
  });

  it("validates manifests against their declared draft-04 schema", () => {
    const valid = ClockifyManifest.v1_5Builder()
      .key("perfect-addon")
      .name("Perfect Add-on")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

    expect(validateClockifyManifest(valid)).toEqual({ ok: true, value: valid });

    const invalid = { ...valid, key: "" };
    const result = validateClockifyManifest(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    expect(() => assertClockifyManifest(invalid)).toThrow(/manifest/i);
    expect(() => createValidatedClockifyAddon(invalid as typeof valid)).toThrow(/manifest/i);
    expect(createValidatedClockifyAddon(valid).getManifest()).toEqual(valid);
    expect(validateClockifyManifest({})).toMatchObject({ ok: false });
    expect(validateClockifyManifest({ schemaVersion: "9.9" })).toMatchObject({ ok: false });
    expect(validateClockifyManifest({ ...valid, baseUrl: "http://" })).toMatchObject({ ok: false });
  });

  it("builds hardened browser response headers and rejects CSP injection", () => {
    const headers = buildClockifySecurityHeaders({
      frameAncestors: ["https://app.clockify.me"],
    });
    expect(headers["content-security-policy"]).toContain("frame-ancestors https://app.clockify.me");
    expect(headers["permissions-policy"]).toBeDefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(() =>
      buildClockifySecurityHeaders({
        frameAncestors: ["https://app.clockify.me, https://evil.test"],
      }),
    ).toThrow(/invalid/i);
    expect(() => buildClockifySecurityHeaders({ frameAncestors: ["http://evil.example"] })).toThrow(
      /HTTPS/i,
    );
    expect(() =>
      buildClockifySecurityHeaders({ frameAncestors: ["https://app.clockify.me/path"] }),
    ).toThrow(/paths/i);
    expect(() =>
      buildClockifySecurityHeaders({
        contentSecurityPolicy: { "img-src default-src": ["'self'"] },
      }),
    ).toThrow(/directive/i);
    expect(
      buildClockifySecurityHeaders({
        contentSecurityPolicy: { "img-src": ["https://cdn.example"] },
      })["content-security-policy"],
    ).toContain("img-src https://cdn.example");
  });

  it.each(["default-src", "base-uri", "form-action", "frame-ancestors"])(
    "rejects custom overrides of the SDK-managed %s directive",
    (managedDirective) => {
      expect(() =>
        buildClockifySecurityHeaders({
          contentSecurityPolicy: { [managedDirective]: ["'self'"] },
        }),
      ).toThrow(/managed CSP directive/i);
    },
  );

  it("creates no-store HTML and JSON responses", () => {
    const html = createClockifyHtmlResponse("<p>ok</p>", {
      frameAncestors: ["https://app.clockify.me"],
    });
    expect(html.headers?.["content-type"]).toBe("text/html; charset=utf-8");
    expect(html.headers?.["cache-control"]).toBe("no-store");

    const json = createClockifyJsonResponse({ ok: true });
    expect(json.headers?.["content-type"]).toBe("application/json; charset=utf-8");
    expect(json.headers?.["cache-control"]).toBe("no-store");
    expect(json.headers?.["content-security-policy"]).toBeUndefined();
  });

  it("requires an explicit HTTPS public origin outside opted-in local development", () => {
    expect(() => resolveClockifyPublicOrigin({})).toThrow(/PUBLIC_BASE_URL/);
    expect(() => resolveClockifyPublicOrigin({ publicBaseUrl: "http://example.com" })).toThrow(
      /HTTPS/,
    );
    expect(() =>
      resolveClockifyPublicOrigin({ publicBaseUrl: "https://user:secret@example.com" }),
    ).toThrow(/credentials/i);
    expect(
      resolveClockifyPublicOrigin({ publicBaseUrl: "https://addons.example.com/base/path" }),
    ).toBe("https://addons.example.com");
    expect(
      resolveClockifyPublicOrigin({
        requestUrl: "http://localhost:8787/addon",
        allowLocalRequestOrigin: true,
      }),
    ).toBe("http://localhost:8787");
    expect(() =>
      resolveClockifyPublicOrigin({
        requestUrl: "https://attacker.example/addon",
        allowLocalRequestOrigin: true,
      }),
    ).toThrow(/local/i);
    expect(() => resolveClockifyPublicOrigin({ allowLocalRequestOrigin: true })).toThrow(
      /request URL/i,
    );
    expect(() =>
      resolveClockifyPublicOrigin({
        requestUrl: "ftp://localhost/a",
        allowLocalRequestOrigin: true,
      }),
    ).toThrow(/HTTP/i);
  });
});
