// Real-world parity: the official Clockify add-on examples (github.com/clockify/addon-examples).
//
// Each fixture in ./fixtures/official-examples/ is an UNMODIFIED manifest from that repo. We verify
// the SDK's Addon router accepts and serves each one verbatim through GET /manifest. Combined with
// the compile-time fidelity probe (tests/types/official-manifest.probe.ts), this proves the SDK
// handles real, shipping Clockify manifests — not just synthetic fixtures.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ClockifyAddon } from "../../src";

const FIXTURE_DIR = join(process.cwd(), "tests", "parity", "fixtures", "official-examples");

const EXAMPLES = [
  "hello-world-go.json",
  "weather-serverless.json",
  "iframe-example.json",
  "ui-example.json",
];

function loadManifest(file: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf-8"));
}

describe("Official Clockify add-on examples (schema 1.2)", () => {
  for (const file of EXAMPLES) {
    it(`serves ${file} verbatim at GET /manifest`, async () => {
      const manifest = loadManifest(file);
      const addon = new ClockifyAddon(manifest);

      const res = await addon.handle({ method: "GET", path: "/manifest", headers: {} });
      expect(res.status).toBe(200);
      expect(res.headers?.["content-type"]).toBe("application/json");

      // The router must serve the manifest unchanged.
      expect(JSON.parse(JSON.stringify(res.body))).toEqual(manifest);
      // ...and /manifest/ (trailing slash) resolves to the same handler.
      const resSlash = await addon.handle({ method: "GET", path: "/manifest/", headers: {} });
      expect(resSlash.status).toBe(200);
    });
  }

  it("the ui-example uses every component type the SDK supports", () => {
    const manifest = loadManifest("ui-example.json");
    const types = manifest.components.map((c: any) => c.type).sort();
    expect(types).toEqual(
      [
        "activity.tab",
        "approvals.tab",
        "projects.tab",
        "reports.tab",
        "schedule.tab",
        "sidebar",
        "team.tab",
        "timeoff.tab",
        "widget",
      ].sort(),
    );
  });
});
