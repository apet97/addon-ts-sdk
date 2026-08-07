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
   * Caps how many completed entries are retained at once. Once exceeded, the
   * oldest completed entry is evicted (FIFO). Unset keeps every completed
   * entry (the default, unbounded).
   */
  readonly maxCompletedEntries?: number;
  /**
   * TTL, in milliseconds, for a completed entry. Once it elapses, the key is
   * treated as never completed and becomes claimable again — a webhook
   * redelivered after the TTL is no longer deduplicated. Unset retains
   * completed entries forever (the default), matching the class's original
   * behavior.
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
  private readonly completedOrder: string[] = [];
  private readonly now: () => number;
  private readonly options: ClockifyIdempotencyLeaseStoreOptions;

  constructor(now: () => number = Date.now, options: ClockifyIdempotencyLeaseStoreOptions = {}) {
    this.now = now;
    this.options = options;
  }

  /** Number of keys currently tracked (active leases plus retained completed entries). */
  size(): number {
    return this.leases.size;
  }

  async claim(key: string, owner: string, leaseMs: number): Promise<boolean> {
    if (key.trim() === "" || owner.trim() === "")
      throw new Error("Lease key and owner must not be empty.");
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("leaseMs must be positive.");
    const current = this.leases.get(key);
    // A completed entry with no TTL has expiresAt = Infinity, so it always
    // fails this check (stays a permanent duplicate). A completed entry with
    // a TTL becomes claimable again once its expiresAt has passed.
    if (current && current.expiresAt > this.now()) return false;
    this.leases.set(key, { owner, expiresAt: this.now() + leaseMs, completed: false });
    return true;
  }

  async complete(key: string, owner: string): Promise<boolean> {
    const current = this.leases.get(key);
    if (!current || current.completed || current.owner !== owner || current.expiresAt <= this.now())
      return false;
    const { completedTtlMs, maxCompletedEntries } = this.options;
    const expiresAt =
      completedTtlMs === undefined ? Number.POSITIVE_INFINITY : this.now() + completedTtlMs;
    this.leases.set(key, { ...current, completed: true, expiresAt });
    if (maxCompletedEntries !== undefined) {
      this.completedOrder.push(key);
      while (this.completedOrder.length > maxCompletedEntries) {
        const oldest = this.completedOrder.shift();
        if (oldest !== undefined && this.leases.get(oldest)?.completed) {
          this.leases.delete(oldest);
        }
      }
    }
    return true;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const current = this.leases.get(key);
    if (!current || current.completed || current.owner !== owner) return false;
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
  try {
    const value = await work();
    if (isServerError(value)) {
      await store.release(options.key, options.owner);
    } else if (!(await store.complete(options.key, options.owner))) {
      throw new Error("Clockify webhook lease ownership was lost before completion.");
    }
    return { status: "completed", value };
  } catch (error) {
    await store.release(options.key, options.owner);
    throw error;
  }
}
