import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("generated schema JSDoc", () => {
  it("emits schema descriptions into generated declaration source", () => {
    const generated = readFileSync(
      join(process.cwd(), "src", "clockify", "generated", "v1_5.ts"),
      "utf8",
    );

    expect(generated).toContain("/** Clockify event that triggers webhook");
    expect(generated).toContain("/** Path to addon endpoint designated for receiving webhooks");
    expect(generated).toContain("/** Addon name */");
  });
});
