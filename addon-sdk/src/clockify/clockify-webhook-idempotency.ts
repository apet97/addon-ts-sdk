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

/** In-memory lease store for tests and single-process deployments. */
export class InMemoryClockifyIdempotencyLeaseStore implements ClockifyIdempotencyLeaseStore {
  private readonly leases = new Map<string, Lease>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async claim(key: string, owner: string, leaseMs: number): Promise<boolean> {
    if (key.trim() === "" || owner.trim() === "")
      throw new Error("Lease key and owner must not be empty.");
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("leaseMs must be positive.");
    const current = this.leases.get(key);
    if (current?.completed || (current && current.expiresAt > this.now())) return false;
    this.leases.set(key, { owner, expiresAt: this.now() + leaseMs, completed: false });
    return true;
  }

  async complete(key: string, owner: string): Promise<boolean> {
    const current = this.leases.get(key);
    if (!current || current.completed || current.owner !== owner || current.expiresAt <= this.now())
      return false;
    this.leases.set(key, { ...current, completed: true, expiresAt: Number.POSITIVE_INFINITY });
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
