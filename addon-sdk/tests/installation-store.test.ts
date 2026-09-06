import { describe, expect, it, vi } from "vitest";
import {
  InMemoryClockifyInstallationStore,
  createClockifyAesGcmTokenCodec,
  createRotatingClockifyTokenCodec,
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
  it("rejects a save() whose apiUrl, asUser, or addonUserId fails validation", async () => {
    const store = new InMemoryClockifyInstallationStore();
    await expect(store.save({ ...context(100), apiUrl: "" })).rejects.toThrow(/apiUrl/);
    await expect(store.save({ ...context(100), apiUrl: "not-a-url" })).rejects.toThrow(/apiUrl/);
    await expect(
      store.save({ ...context(100), apiUrl: "http://nonloopback.example/api" }),
    ).rejects.toThrow(/apiUrl/);
    await expect(store.save({ ...context(100), asUser: " " })).rejects.toThrow(/asUser/);
    await expect(store.save({ ...context(100), addonUserId: "" })).rejects.toThrow(/addonUserId/);
    // A loopback HTTP apiUrl is still accepted (local development).
    await expect(
      store.save({ ...context(100), apiUrl: "http://localhost:3000/api" }),
    ).resolves.toBeUndefined();
  });

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

  it("fails closed to null when encrypted storage is corrupt and rejects empty writes", async () => {
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

  it("fails closed when a durable store returns a decoded row with invalid context", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const codec = createClockifyAesGcmTokenCodec(key);
    const encoded = await codec.encode("installation-secret");
    const onDecodeError = vi.fn();
    const raw = {
      load: vi.fn(async () => ({ ...context(100, encoded), apiUrl: "http://attacker.invalid" })),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => "deleted" as const),
    };
    const encrypted = wrapClockifyInstallationStoreWithEncryption(raw, codec, onDecodeError);

    await expect(encrypted.load("workspace-1", "addon-1")).resolves.toBeNull();
    expect(onDecodeError).toHaveBeenCalledWith(expect.any(Error), "workspace-1", "addon-1");
  });

  it.each([false, true])(
    "keeps corrupt-decode loads null when the observer throws: %s",
    async (throws) => {
      const raw = new InMemoryClockifyInstallationStore();
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]);
      const onDecodeError = vi.fn(() => {
        if (throws) throw new Error("observer failed");
      });
      const encrypted = wrapClockifyInstallationStoreWithEncryption(
        raw,
        createClockifyAesGcmTokenCodec(key),
        onDecodeError,
      );

      await raw.save(context(100, "enc:v1:not-valid"));
      await expect(encrypted.load("workspace-1", "addon-1")).resolves.toBeNull();
      expect(onDecodeError).toHaveBeenCalledTimes(1);
      expect(onDecodeError).toHaveBeenCalledWith(expect.anything(), "workspace-1", "addon-1");
    },
  );

  it("rotates encryption keys by decoding old-key rows and encoding new ones with the new key", async () => {
    const oldKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const newKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const oldCodec = createClockifyAesGcmTokenCodec(oldKey);
    const newCodec = createClockifyAesGcmTokenCodec(newKey);
    const rotating = createRotatingClockifyTokenCodec(newCodec, oldCodec);

    // A row encrypted before the rotation must still decode.
    const legacyEncoded = await oldCodec.encode("pre-rotation-secret");
    await expect(rotating.decode(legacyEncoded)).resolves.toBe("pre-rotation-secret");

    // A newly encoded row must be decryptable with only the new key, proving
    // encode() never falls back to the old codec.
    const rotatedEncoded = await rotating.encode("post-rotation-secret");
    await expect(newCodec.decode(rotatedEncoded)).resolves.toBe("post-rotation-secret");
    await expect(oldCodec.decode(rotatedEncoded)).rejects.toThrow();

    const raw = new InMemoryClockifyInstallationStore();
    const store = wrapClockifyInstallationStoreWithEncryption(raw, rotating);
    const legacyWebhookEncoded = await oldCodec.encode("webhook-secret");
    await raw.save({
      ...context(100, legacyEncoded),
      webhooks: [{ path: "/expense", webhookType: "ADDON", authToken: legacyWebhookEncoded }],
    });
    await expect(store.load("workspace-1", "addon-1")).resolves.toMatchObject({
      authToken: "pre-rotation-secret",
      webhooks: [{ authToken: "webhook-secret" }],
    });
  });

  it("retains both rotating-codec errors without mutating a frozen original error", async () => {
    const newError = new Error("new codec failed");
    const originalCause = new Error("original cause");
    const oldError = Object.freeze(new Error("old codec failed", { cause: originalCause }));
    const rotating = createRotatingClockifyTokenCodec(
      { encode: vi.fn(), decode: vi.fn().mockRejectedValue(newError) },
      { encode: vi.fn(), decode: vi.fn().mockRejectedValue(oldError) },
    );

    await expect(rotating.decode("enc:v1:not-valid-at-all")).rejects.toMatchObject({
      name: "AggregateError",
      message: expect.stringContaining("Both Clockify token codecs failed"),
      errors: [newError, oldError],
      cause: oldError,
    });
    expect(oldError.cause).toBe(originalCause);
  });
});
