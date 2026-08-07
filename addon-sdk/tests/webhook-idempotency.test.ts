import { describe, expect, it } from "vitest";
import { InMemoryClockifyIdempotencyLeaseStore, runClockifyIdempotentWebhook } from "../src";

describe("webhook idempotency leases", () => {
  it("enforces lease ownership and permits reclaim after expiry", async () => {
    let now = 100;
    const store = new InMemoryClockifyIdempotencyLeaseStore(() => now);
    await expect(store.claim("key", "owner-a", 10)).resolves.toBe(true);
    await expect(store.claim("key", "owner-b", 10)).resolves.toBe(false);
    await expect(store.complete("key", "owner-b")).resolves.toBe(false);
    await expect(store.release("key", "owner-b")).resolves.toBe(false);
    now = 111;
    await expect(store.claim("key", "owner-b", 10)).resolves.toBe(true);
    await expect(store.complete("key", "owner-b")).resolves.toBe(true);
    await expect(store.claim("key", "owner-c", 10)).resolves.toBe(false);
  });

  it("releases failed work and completes successful work", async () => {
    const store = new InMemoryClockifyIdempotencyLeaseStore();
    await expect(
      runClockifyIdempotentWebhook(
        store,
        { key: "throws", owner: "one", leaseMs: 1000 },
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");
    await expect(store.claim("throws", "two", 1000)).resolves.toBe(true);

    await expect(
      runClockifyIdempotentWebhook(
        store,
        { key: "server-error", owner: "one", leaseMs: 1000 },
        async () => ({ status: 503 }),
      ),
    ).resolves.toMatchObject({ status: "completed", value: { status: 503 } });
    await expect(store.claim("server-error", "two", 1000)).resolves.toBe(true);

    await expect(
      runClockifyIdempotentWebhook(store, { key: "ok", owner: "one", leaseMs: 1000 }, async () => ({
        status: 204,
      })),
    ).resolves.toMatchObject({ status: "completed", value: { status: 204 } });
    await expect(store.claim("ok", "two", 1000)).resolves.toBe(false);
  });

  it("returns duplicate without invoking work", async () => {
    const store = new InMemoryClockifyIdempotencyLeaseStore();
    await store.claim("key", "first", 1000);
    const result = await runClockifyIdempotentWebhook(
      store,
      { key: "key", owner: "second", leaseMs: 1000 },
      async () => ({ status: 200 }),
    );
    expect(result).toEqual({ status: "duplicate" });
  });

  it("evicts the oldest completed entry once maxCompletedEntries is exceeded", async () => {
    const store = new InMemoryClockifyIdempotencyLeaseStore(Date.now, { maxCompletedEntries: 2 });
    for (const key of ["a", "b", "c"]) {
      await store.claim(key, "owner", 1000);
      await store.complete(key, "owner");
    }

    expect(store.size()).toBe(2);
    // "a" was evicted (oldest completed entry), so it is claimable again.
    await expect(store.claim("a", "owner", 1000)).resolves.toBe(true);
    // "b" and "c" are still retained as completed duplicates.
    await expect(store.claim("b", "owner", 1000)).resolves.toBe(false);
    await expect(store.claim("c", "owner", 1000)).resolves.toBe(false);
  });

  it("lets a completed entry expire and become claimable again once completedTtlMs elapses", async () => {
    let now = 0;
    const store = new InMemoryClockifyIdempotencyLeaseStore(() => now, { completedTtlMs: 10 });
    await store.claim("key", "owner", 1000);
    await store.complete("key", "owner");

    now = 5;
    await expect(store.claim("key", "other-owner", 1000)).resolves.toBe(false);

    now = 11;
    await expect(store.claim("key", "other-owner", 1000)).resolves.toBe(true);
  });

  it("reports the tracked key count via size()", async () => {
    const store = new InMemoryClockifyIdempotencyLeaseStore();
    expect(store.size()).toBe(0);
    await store.claim("key", "owner", 1000);
    expect(store.size()).toBe(1);
    await store.complete("key", "owner");
    expect(store.size()).toBe(1);
  });
});
