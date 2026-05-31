export interface AddonResponse {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly body?: string | Uint8Array | object | null;
}

// A response body is JSON-serialized (and defaults to `application/json`) when it is a plain object
// — i.e. not a string, a binary `Uint8Array`, or null/undefined. Shared by every adapter so this
// rule lives in exactly one place.
export function isJsonBody(body: unknown): boolean {
  return typeof body === "object" && body !== null && !(body instanceof Uint8Array);
}
