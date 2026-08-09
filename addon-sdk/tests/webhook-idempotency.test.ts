import { describe, expect, it, vi } from "vitest";
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

  it("releases and reports lost ownership when completion fails", async () => {
    const store = {
      claim: vi.fn(async () => true),
      complete: vi.fn(async () => false),
      release: vi.fn(async () => true),
    };

    await expect(
      runClockifyIdempotentWebhook(
        store,
        { key: "key", owner: "owner", leaseMs: 1000 },
        async () => ({ status: 204 }),
      ),
    ).rejects.toThrow(/ownership was lost/i);
    expect(store.release).toHaveBeenCalledExactlyOnceWith("key", "owner");
  });

  it("preserves the work error when releasing the lease also fails", async () => {
    const workError = new Error("work failed");
    const store = {
      claim: vi.fn(async () => true),
      complete: vi.fn(async () => true),
      release: vi.fn(async () => {
        throw new Error("release failed");
      }),
    };

    await expect(
      runClockifyIdempotentWebhook(
        store,
        { key: "key", owner: "owner", leaseMs: 1000 },
        async () => {
          throw workError;
        },
      ),
    ).rejects.toBe(workError);
    expect(store.release).toHaveBeenCalledExactlyOnceWith("key", "owner");
  });

  it("does not retry a release that rejects after a server-error response", async () => {
    const releaseError = new Error("release failed");
    const store = {
      claim: vi.fn(async () => true),
      complete: vi.fn(async () => true),
      release: vi.fn(async () => {
        throw releaseError;
      }),
    };

    await expect(
      runClockifyIdempotentWebhook(
        store,
        { key: "key", owner: "owner", leaseMs: 1000 },
        async () => ({ status: 503 }),
      ),
    ).rejects.toBe(releaseError);
    expect(store.release).toHaveBeenCalledExactlyOnceWith("key", "owner");
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

  it("removes every expired lease before reporting its size", async () => {
    let now = 0;
    const store = new InMemoryClockifyIdempotencyLeaseStore(() => now, { completedTtlMs: 10 });
    await store.claim("completed", "owner", 10);
    await store.complete("completed", "owner");
    await store.claim("active", "owner", 10);

    now = 11;

    expect(store.size()).toBe(0);
  });

  it("removes an expired active lease when completion or release arrives late", async () => {
    let now = 0;
    const store = new InMemoryClockifyIdempotencyLeaseStore(() => now);
    await store.claim("complete", "owner", 10);
    await store.claim("release", "owner", 10);

    now = 11;

    await expect(store.complete("complete", "owner")).resolves.toBe(false);
    await expect(store.release("release", "owner")).resolves.toBe(false);
    expect(store.size()).toBe(0);
  });

  it("does not let an old FIFO position evict a newly completed lease for the same key", async () => {
    let now = 0;
    const store = new InMemoryClockifyIdempotencyLeaseStore(() => now, {
      completedTtlMs: 10,
      maxCompletedEntries: 2,
    });
    await store.claim("a", "owner", 10);
    await store.complete("a", "owner");
    now = 11;
    await store.claim("a", "new-owner", 10);
    await store.complete("a", "new-owner");
    await store.claim("b", "owner", 10);
    await store.complete("b", "owner");

    await expect(store.claim("a", "third-owner", 10)).resolves.toBe(false);
    await expect(store.claim("b", "other-owner", 10)).resolves.toBe(false);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid maxCompletedEntries %s",
    (maxCompletedEntries) => {
      expect(
        () => new InMemoryClockifyIdempotencyLeaseStore(Date.now, { maxCompletedEntries }),
      ).toThrow(/maxCompletedEntries/);
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid completedTtlMs %s",
    (completedTtlMs) => {
      expect(() => new InMemoryClockifyIdempotencyLeaseStore(Date.now, { completedTtlMs })).toThrow(
        /completedTtlMs/,
      );
    },
  );

  it("allows a zero completed-entry cap", async () => {
    const store = new InMemoryClockifyIdempotencyLeaseStore(Date.now, { maxCompletedEntries: 0 });
    await store.claim("key", "owner", 1000);
    await expect(store.complete("key", "owner")).resolves.toBe(true);
    expect(store.size()).toBe(0);
  });

  it("keeps a validated copy of its retention options", async () => {
    const options = { maxCompletedEntries: 1 };
    const store = new InMemoryClockifyIdempotencyLeaseStore(Date.now, options);
    options.maxCompletedEntries = 0;
    await store.claim("key", "owner", 1000);
    await store.complete("key", "owner");

    expect(store.size()).toBe(1);
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
