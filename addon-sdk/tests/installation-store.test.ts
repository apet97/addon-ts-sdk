import { describe, expect, it, vi } from "vitest";
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

  it("round-trips the AES-GCM codec without a global Buffer (browser/workerd shape)", async () => {
    const originalBuffer = globalThis.Buffer;
    // @ts-expect-error simulating a runtime with no Node Buffer global
    delete globalThis.Buffer;
    try {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]);
      const codec = createClockifyAesGcmTokenCodec(key);
      const encoded = await codec.encode("installation-secret");
      expect(encoded).not.toContain("installation-secret");
      await expect(codec.decode(encoded)).resolves.toBe("installation-secret");
    } finally {
      globalThis.Buffer = originalBuffer;
    }
  });

  it("rejects encoding when Web Crypto's getRandomValues is unavailable", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const codec = createClockifyAesGcmTokenCodec(key);
    // getRandomValues lives on Crypto.prototype, so deleting the instance
    // property is a no-op; stub the whole global instead.
    vi.stubGlobal("crypto", { ...globalThis.crypto, getRandomValues: undefined });
    try {
      await expect(codec.encode("installation-secret")).rejects.toThrow(/Web Crypto is required/);
    } finally {
      vi.unstubAllGlobals();
    }
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
