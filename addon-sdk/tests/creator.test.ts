import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffoldClockifyAddon } from "../../create-clockify-addon/src/index.mjs";

describe("create-clockify-addon", () => {
  it.each(["node", "worker"] as const)("creates a fail-closed %s project", async (runtime) => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    const directory = join(parent, `${runtime}-addon`);
    try {
      await scaffoldClockifyAddon({ directory, runtime, features: "all", sdkSpec: "^1.0.0" });
      const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      const source = await readFile(join(directory, "src", "index.ts"), "utf8");
      const env = await readFile(join(directory, ".env.example"), "utf8");

      expect(packageJson.dependencies["@apet97/clockify-addon-sdk"]).toBe("^1.0.0");
      expect(source).toContain("PUBLIC_BASE_URL");
      expect(source).toContain(
        `@apet97/clockify-addon-sdk/adapters/${runtime === "node" ? "node" : "fetch"}`,
      );
      expect(source).not.toContain("demo-token");
      expect(source).toContain("ALLOW_EPHEMERAL_STORAGE");
      expect(source).toContain("withClockifyInstalledLifecycleRequest");
      expect(source).toContain("getExpectedWebhookAuthToken");
      expect(env).toContain("PUBLIC_BASE_URL=https://");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite a non-empty directory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    try {
      await writeFile(join(parent, "existing.txt"), "keep");
      await expect(
        scaffoldClockifyAddon({ directory: parent, runtime: "node", features: "minimal" }),
      ).rejects.toThrow(/empty/i);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("keeps the minimal scaffold free of lifecycle and webhook routes", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    const directory = join(parent, "minimal-addon");
    try {
      await scaffoldClockifyAddon({ directory, runtime: "node", features: "minimal" });
      const source = await readFile(join(directory, "src", "index.ts"), "utf8");
      expect(source).not.toContain("ClockifyLifecycleEvent");
      expect(source).not.toContain("ClockifyWebhook");
      expect(source).toContain("ClockifyComponent");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
