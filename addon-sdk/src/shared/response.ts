export interface AddonResponse {
  readonly status?: number;
  readonly headers?: Record<string, string | readonly string[]>;
  readonly body?: string | Uint8Array | object | null;
}

// A response body is JSON-serialized (and defaults to `application/json`) when it is a plain
// object or array — i.e. not a string, a binary `Uint8Array`, null/undefined, or an instance of
// some other class. Shared by every adapter so this rule lives in exactly one place.
//
// The class-instance exclusion matters: JSON.stringify(new Map(...)) or
// JSON.stringify(new Set(...)) silently produces "{}", discarding every entry, and
// JSON.stringify(/re/) does the same for a RegExp. Treating those as "not JSON" surfaces the
// mistake (a thrown or malformed response) instead of shipping a silently empty body.
export function isJsonBody(body: unknown): boolean {
  if (typeof body !== "object" || body === null || body instanceof Uint8Array) return false;
  if (Array.isArray(body)) return true;
  // Date is the one class instance JSON.stringify serializes meaningfully
  // (via its toJSON, to an ISO string) rather than silently dropping data
  // the way Map/Set/RegExp do above — treat it as JSON so a handler that
  // returns `new Date()` ships an ISO string instead of a res.end(date)
  // engine-specific toString().
  if (body instanceof Date) return true;
  const proto = Object.getPrototypeOf(body);
  return proto === Object.prototype || proto === null;
}
