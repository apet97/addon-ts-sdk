import { testing } from "@apet97/clockify-addon-sdk";
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
import { describe, expect, it } from "vitest";
import worker, { ADDON_KEY, buildAddon } from "./worker.js";

const { generateTestKeys, signTestToken } = testing;

describe("@apet97/clockify-addon-sdk on Cloudflare Workers", () => {
  it("serves the manifest through the fetch adapter", async () => {
    const res = await worker.fetch(new Request("https://test.local/manifest"));
    expect(res.status).toBe(200);
    const manifest = await res.json();
    expect(manifest.key).toBe(ADDON_KEY);
    expect(manifest.schemaVersion).toBe("1.5");
  });

  it("rejects an unsigned component request", async () => {
    const res = await worker.fetch(new Request("https://test.local/component"));
    expect(res.status).toBe(401);
  });

  it("verifies an RS256-signed component request in workerd", async () => {
    const keys = await generateTestKeys();
    const token = await signTestToken(keys.privateKey, ADDON_KEY, { workspaceId: "w1" });
    const res = await handleFetchRequest(
      buildAddon(keys.pem),
      new Request(`https://test.local/component?auth_token=${token}`),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ workspaceId: "w1" });
  });

  it("rejects a token signed with an untrusted key", async () => {
    const trusted = await generateTestKeys();
    const untrusted = await generateTestKeys();
    const token = await signTestToken(untrusted.privateKey, ADDON_KEY);
    const res = await handleFetchRequest(
      buildAddon(trusted.pem),
      new Request(`https://test.local/component?auth_token=${token}`),
    );
    expect(res.status).toBe(401);
  });
});
