import { describe, expect, it } from "vitest";
import {
  ClockifySignatureParser,
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
  verifyClockifyWebhookRequest,
} from "../src";
import {
  buildInstalledPayload,
  createTestComponentRequest,
  createTestLifecycleRequest,
  createTestWebhookRequest,
  generateTestKeys,
  signTestToken,
} from "../src/testing";

describe("testing helpers", () => {
  it("createTestComponentRequest builds a request that verifies as a component token", async () => {
    const keys = await generateTestKeys();
    const parser = new ClockifySignatureParser("my-addon", keys.publicKey);
    const token = await signTestToken(keys.privateKey, "my-addon");
    const request = createTestComponentRequest(token);

    await expect(verifyClockifyComponentRequest(parser, request)).resolves.toMatchObject({
      ok: true,
    });
  });

  it("createTestLifecycleRequest builds a request that verifies as a lifecycle token", async () => {
    const keys = await generateTestKeys();
    const parser = new ClockifySignatureParser("my-addon", keys.publicKey);
    const token = await signTestToken(keys.privateKey, "my-addon");
    const payload = buildInstalledPayload({ workspaceId: "ws-1", addonId: "addon-1" });
    const request = createTestLifecycleRequest(token, payload);

    await expect(verifyClockifyLifecycleRequest(parser, request)).resolves.toMatchObject({
      ok: true,
    });
    expect(request.body).toBe(payload);
  });

  it("createTestWebhookRequest builds a request that verifies as a webhook delivery", async () => {
    const keys = await generateTestKeys();
    const parser = new ClockifySignatureParser("my-addon", keys.publicKey);
    const token = await signTestToken(keys.privateKey, "my-addon", {
      workspaceId: "ws-1",
      addonId: "addon-1",
    });
    const payload = { event: "NEW_PROJECT" };
    const request = createTestWebhookRequest(token, "NEW_PROJECT", payload);

    await expect(
      verifyClockifyWebhookRequest(parser, request, {
        expectedEventType: "NEW_PROJECT",
        expectedWebhookAuthToken: token,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(request.body).toBe(payload);
  });

  it("buildInstalledPayload fills every required field with defaults and applies overrides", () => {
    const payload = buildInstalledPayload();
    expect(payload).toMatchObject({
      addonId: expect.any(String),
      authToken: expect.any(String),
      workspaceId: expect.any(String),
      asUser: expect.any(String),
      apiUrl: expect.stringMatching(/^https:\/\//),
      addonUserId: expect.any(String),
    });

    const overridden = buildInstalledPayload({ workspaceId: "custom-ws" });
    expect(overridden.workspaceId).toBe("custom-ws");
    expect(overridden.addonId).toBe(payload.addonId);
  });
});
