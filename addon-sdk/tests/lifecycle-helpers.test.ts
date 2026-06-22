import { describe, expect, it } from "vitest";
import {
  ClockifyAddonClaims,
  ClockifyLifecycleMatchedClaims,
  clockifyLifecyclePayloadMatchesClaims,
  isClockifyDeletedLifecyclePayload,
  isClockifyInstalledLifecyclePayload,
  isClockifySettingsUpdatedLifecyclePayload,
  isClockifyStatusChangedLifecyclePayload,
} from "../src";

describe("Clockify lifecycle payload helpers", () => {
  const claims: ClockifyAddonClaims = {
    type: "addon",
    iss: "clockify",
    sub: "mileage-addon",
    workspaceId: "workspace-1",
    addonId: "addon-1",
  };

  it("recognizes documented lifecycle payload shapes", () => {
    expect(
      isClockifyInstalledLifecyclePayload({
        addonId: "addon-1",
        authToken: "installation-token",
        workspaceId: "workspace-1",
        asUser: "user-1",
        apiUrl: "https://api.clockify.example/api",
        addonUserId: "addon-user-1",
        webhooks: [{ path: "/webhook", webhookType: "ADDON", authToken: "webhook-token" }],
      }),
    ).toBe(true);
    expect(
      isClockifyStatusChangedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
        status: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      isClockifySettingsUpdatedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
        settings: [{ id: "distance-unit", name: "Distance unit", value: "km" }],
      }),
    ).toBe(true);
    expect(
      isClockifyDeletedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
        asUser: "user-1",
      }),
    ).toBe(true);
  });

  it("rejects malformed lifecycle payloads", () => {
    expect(isClockifyInstalledLifecyclePayload(null)).toBe(false);
    expect(isClockifyInstalledLifecyclePayload({ addonId: "addon-1" })).toBe(false);
    expect(
      isClockifyInstalledLifecyclePayload({
        addonId: "addon-1",
        authToken: "installation-token",
        workspaceId: "workspace-1",
        asUser: "user-1",
        apiUrl: "https://api.clockify.example/api",
        addonUserId: "addon-user-1",
        webhooks: [{ path: "/webhook", webhookType: "WRONG", authToken: "webhook-token" }],
      }),
    ).toBe(false);
    expect(
      isClockifyStatusChangedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
        status: "PAUSED",
      }),
    ).toBe(false);
    expect(
      isClockifySettingsUpdatedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
        settings: [{ id: "distance-unit", value: "km" }],
      }),
    ).toBe(false);
    expect(
      isClockifyDeletedLifecyclePayload({
        addonId: "addon-1",
        workspaceId: "workspace-1",
      }),
    ).toBe(false);
  });

  it("matches lifecycle payloads to verified workspace and add-on claims", () => {
    const payload = {
      addonId: "addon-1",
      authToken: "installation-token",
      workspaceId: "workspace-1",
      asUser: "user-1",
      apiUrl: "https://api.clockify.example/api",
      addonUserId: "addon-user-1",
    };

    expect(clockifyLifecyclePayloadMatchesClaims(payload, claims)).toBe(true);
    if (!clockifyLifecyclePayloadMatchesClaims(payload, claims)) {
      throw new Error("expected payload and claims to match");
    }
    const matchedClaims: ClockifyLifecycleMatchedClaims = claims;
    expect(matchedClaims.workspaceId).toBe("workspace-1");
    expect(
      clockifyLifecyclePayloadMatchesClaims({ ...payload, workspaceId: "workspace-2" }, claims),
    ).toBe(false);
    expect(clockifyLifecyclePayloadMatchesClaims(null, claims)).toBe(false);
    expect(clockifyLifecyclePayloadMatchesClaims(payload, { ...claims, addonId: undefined })).toBe(
      false,
    );
  });
});
