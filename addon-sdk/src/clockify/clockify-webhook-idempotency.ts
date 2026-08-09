/** Distributed-capable ownership contract for webhook-processing leases. */
export interface ClockifyIdempotencyLeaseStore {
  claim(key: string, owner: string, leaseMs: number): Promise<boolean>;
  complete(key: string, owner: string): Promise<boolean>;
  release(key: string, owner: string): Promise<boolean>;
}

interface Lease {
  readonly owner: string;
  readonly expiresAt: number;
  readonly completed: boolean;
}

/** Bounds for {@link InMemoryClockifyIdempotencyLeaseStore}'s completed-entry retention. */
export interface ClockifyIdempotencyLeaseStoreOptions {
  /**
   * Caps how many completed entries are retained at once. Must be a nonnegative safe integer.
   * Once exceeded, the oldest completed entry is evicted (FIFO). Unset keeps every completed
   * entry (the default, unbounded).
   */
  readonly maxCompletedEntries?: number;
  /**
   * Positive TTL, in milliseconds, for a completed entry. After it elapses, the key becomes
   * claimable again. A webhook redelivered after the TTL is no longer deduplicated. Unset retains
   * completed entries forever (the default).
   */
  readonly completedTtlMs?: number;
}

/**
 * In-memory lease store for tests and single-process deployments. By
 * default, completed entries are retained forever (no TTL) so a replayed
 * webhook is always recognized as a duplicate; a long-lived process
 * therefore grows this map without bound. Pass `maxCompletedEntries` and/or
 * `completedTtlMs` to bound that growth, or use a durable store with a TTL
 * on completed entries for production.
 */
export class InMemoryClockifyIdempotencyLeaseStore implements ClockifyIdempotencyLeaseStore {
  private readonly leases = new Map<string, Lease>();
  private readonly completedOrder = new Set<string>();
  private readonly now: () => number;
  private readonly options: ClockifyIdempotencyLeaseStoreOptions;

  constructor(now: () => number = Date.now, options: ClockifyIdempotencyLeaseStoreOptions = {}) {
    if (
      options.maxCompletedEntries !== undefined &&
      (!Number.isSafeInteger(options.maxCompletedEntries) || options.maxCompletedEntries < 0)
    ) {
      throw new Error("maxCompletedEntries must be a nonnegative safe integer.");
    }
    if (
      options.completedTtlMs !== undefined &&
      (!Number.isFinite(options.completedTtlMs) || options.completedTtlMs <= 0)
    ) {
      throw new Error("completedTtlMs must be positive.");
    }
    this.now = now;
    this.options = { ...options };
  }

  /** Number of keys currently tracked (active leases plus retained completed entries). */
  size(): number {
    this.pruneExpired(this.now(), true);
    return this.leases.size;
  }

  private pruneExpired(now: number, force = false): void {
    // TTL retention needs activity-based cleanup. Without a completed TTL,
    // avoid scanning permanent completed entries on every store operation.
    if (!force && this.options.completedTtlMs === undefined) return;
    for (const [key, lease] of this.leases) {
      if (lease.expiresAt > now) continue;
      this.leases.delete(key);
      this.completedOrder.delete(key);
    }
  }

  async claim(key: string, owner: string, leaseMs: number): Promise<boolean> {
    if (key.trim() === "" || owner.trim() === "")
      throw new Error("Lease key and owner must not be empty.");
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("leaseMs must be positive.");
    const now = this.now();
    this.pruneExpired(now);
    const current = this.leases.get(key);
    if (current && current.expiresAt > now) return false;
    if (current) this.leases.delete(key);
    this.completedOrder.delete(key);
    this.leases.set(key, { owner, expiresAt: now + leaseMs, completed: false });
    return true;
  }

  async complete(key: string, owner: string): Promise<boolean> {
    const now = this.now();
    this.pruneExpired(now);
    const current = this.leases.get(key);
    if (!current) return false;
    if (current.expiresAt <= now) {
      this.leases.delete(key);
      this.completedOrder.delete(key);
      return false;
    }
    if (current.completed || current.owner !== owner) return false;
    const { completedTtlMs, maxCompletedEntries } = this.options;
    const expiresAt =
      completedTtlMs === undefined ? Number.POSITIVE_INFINITY : now + completedTtlMs;
    this.leases.set(key, { ...current, completed: true, expiresAt });
    if (maxCompletedEntries !== undefined) {
      this.completedOrder.delete(key);
      this.completedOrder.add(key);
      while (this.completedOrder.size > maxCompletedEntries) {
        const oldest = this.completedOrder.values().next().value as string;
        this.completedOrder.delete(oldest);
        this.leases.delete(oldest);
      }
    }
    return true;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const now = this.now();
    this.pruneExpired(now);
    const current = this.leases.get(key);
    if (!current) return false;
    if (current.expiresAt <= now) {
      this.leases.delete(key);
      this.completedOrder.delete(key);
      return false;
    }
    if (current.completed || current.owner !== owner) return false;
    this.leases.delete(key);
    return true;
  }
}

/** Inputs identifying one webhook-processing lease. */
export interface ClockifyIdempotentWebhookOptions {
  readonly key: string;
  readonly owner: string;
  readonly leaseMs: number;
}

/** Result of an idempotent webhook execution attempt. */
export type ClockifyIdempotentWebhookResult<T> =
  { readonly status: "duplicate" } | { readonly status: "completed"; readonly value: T };

function isServerError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as { readonly status?: unknown }).status === "number" &&
    (value as { readonly status: number }).status >= 500
  );
}

/** Runs webhook work once, releasing ownership after throws or server-error responses. */
export async function runClockifyIdempotentWebhook<T>(
  store: ClockifyIdempotencyLeaseStore,
  options: ClockifyIdempotentWebhookOptions,
  work: () => Promise<T>,
): Promise<ClockifyIdempotentWebhookResult<T>> {
  if (!(await store.claim(options.key, options.owner, options.leaseMs)))
    return { status: "duplicate" };
  let releaseAttempted = false;
  try {
    const value = await work();
    if (isServerError(value)) {
      releaseAttempted = true;
      await store.release(options.key, options.owner);
    } else if (!(await store.complete(options.key, options.owner))) {
      throw new Error("Clockify webhook lease ownership was lost before completion.");
    }
    return { status: "completed", value };
  } catch (error) {
    if (!releaseAttempted) {
      try {
        await store.release(options.key, options.owner);
      } catch {
        // Cleanup must not replace the work or completion error.
      }
    }
    throw error;
  }
}
