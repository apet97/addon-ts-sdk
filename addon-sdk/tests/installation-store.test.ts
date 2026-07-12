import { describe, expect, it } from "vitest";
import {
  InMemoryClockifyInstallationStore,
  createClockifyAesGcmTokenCodec,
  wrapClockifyInstallationStoreWithEncryption,
  type ClockifyInstallationContext,
} from "../src";

function context(
  installedAt: number,
  authToken = "installation-secret",
): ClockifyInstallationContext {
  return {
    workspaceId: "workspace-1",
    addonId: "addon-1",
    addonUserId: "addon-user-1",
    asUser: "owner-1",
    apiUrl: "https://api.clockify.me/api",
    authToken,
    installedAt,
    webhooks: [{ path: "/expense", webhookType: "ADDON", authToken: "webhook-secret" }],
  };
}

describe("installation stores", () => {
  it("does not let a stale uninstall delete a newer installation generation", async () => {
    const store = new InMemoryClockifyInstallationStore();
    await store.save(context(100));
    await store.save(context(200, "new-secret"));

    await expect(
      store.delete({ workspaceId: "workspace-1", addonId: "addon-1", installedAt: 100 }),
    ).resolves.toBe("stale");
    await expect(store.load("workspace-1", "addon-1")).resolves.toMatchObject({
      installedAt: 200,
      authToken: "new-secret",
    });
    await store.save(context(50, "older-secret"));
    await expect(store.load("workspace-1", "addon-1")).resolves.toMatchObject({ installedAt: 200 });
  });

  it("deletes unconditionally when the caller supplies no installation generation", async () => {
    const store = new InMemoryClockifyInstallationStore();
    await store.save(context(100));
    await store.save(context(200, "new-secret"));

    await expect(store.delete({ workspaceId: "workspace-1", addonId: "addon-1" })).resolves.toBe(
      "deleted",
    );
    await expect(store.load("workspace-1", "addon-1")).resolves.toBeNull();
  });

  it("distinguishes deleted and missing records", async () => {
    const store = new InMemoryClockifyInstallationStore();
    await expect(store.delete({ workspaceId: "workspace-1", addonId: "addon-1" })).resolves.toBe(
      "missing",
    );
    await store.save(context(100));
    await expect(
      store.delete({ workspaceId: "workspace-1", addonId: "addon-1", installedAt: 100 }),
    ).resolves.toBe("deleted");
  });

  it("encrypts installation and nested webhook credential copies at rest", async () => {
    const raw = new InMemoryClockifyInstallationStore();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const encrypted = wrapClockifyInstallationStoreWithEncryption(
      raw,
      createClockifyAesGcmTokenCodec(key),
    );
    await encrypted.save(context(100));

    const persisted = await raw.load("workspace-1", "addon-1");
    expect(persisted?.authToken).not.toContain("installation-secret");
    expect(persisted?.webhooks?.[0]?.authToken).not.toContain("webhook-secret");
    await expect(encrypted.load("workspace-1", "addon-1")).resolves.toEqual(context(100));
    await expect(
      encrypted.delete({ workspaceId: "workspace-1", addonId: "addon-1", installedAt: 100 }),
    ).resolves.toBe("deleted");
  });

  it("fails open-null when encrypted storage is corrupt and rejects empty writes", async () => {
    const raw = new InMemoryClockifyInstallationStore();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const encrypted = wrapClockifyInstallationStoreWithEncryption(
      raw,
      createClockifyAesGcmTokenCodec(key),
    );

    await expect(encrypted.save(context(100, " "))).rejects.toThrow(/auth token/i);
    await expect(encrypted.save({ ...context(100), installedAt: Number.NaN })).rejects.toThrow(
      /installedAt/i,
    );
    await raw.save(context(100, "enc:v1:not-valid"));
    await expect(encrypted.load("workspace-1", "addon-1")).resolves.toBeNull();
  });
});
