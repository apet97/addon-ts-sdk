import { isCanonicalLoopbackHostname } from "../shared/loopback";

/** A structured settings value update accepted by Clockify's add-on endpoint. */
export interface ClockifySettingUpdate {
  readonly id: string;
  readonly value: unknown;
}

/** Observed just before {@link ClockifyAddonClient} retries a request. */
export interface ClockifyAddonClientRetryInfo {
  /** The attempt that just finished (1-indexed); the retry will be `attempt + 1`. */
  readonly attempt: number;
  /** The response status that triggered the retry, absent for a network-error retry. */
  readonly status?: number;
  /** The response error that triggered the retry, absent for a status-based retry. */
  readonly error?: unknown;
  /** Delay before the retry, in milliseconds. */
  readonly delayMs: number;
}

/** Construction options for {@link ClockifyAddonClient}. */
export interface ClockifyAddonClientOptions {
  readonly token: string;
  readonly backendUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Observe retries for metrics/logging. Never affects retry behavior, even if it throws. */
  readonly onRetry?: (info: ClockifyAddonClientRetryInfo) => void;
}

/**
 * HTTP failure returned by a Clockify add-on API call.
 *
 * `responseBody` is read in full via `response.text()` with no size cap — the Clockify backend is
 * trusted, but a misconfigured proxy or a network failure mid-response could still return a large
 * body, which is buffered entirely before this error is thrown.
 */
export class ClockifyAddonHttpError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string) {
    super(`Clockify add-on request failed with HTTP ${status}.`);
    this.name = "ClockifyAddonHttpError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

function normalizeBackendUrl(value: string): URL {
  // Trim once and parse the trimmed value everywhere below. `new URL()`
  // already tolerates leading/trailing ASCII whitespace on its own, so
  // parsing the untrimmed value while extracting rawHostname from the
  // trimmed value (the previous shape) worked today only because both
  // happened to agree — trimming once removes that implicit assumption.
  const trimmed = value.trim();
  const url = new URL(trimmed);
  if (url.username !== "" || url.password !== "") {
    throw new Error("Clockify backendUrl must not include credentials.");
  }
  const rawHostname =
    /^[a-z][a-z\d+.-]*:\/\/(\[[^?/#\\]+\]|[^:/?#\\]+)(?::[^/?#\\]*)?(?:[/?#\\]|$)/i.exec(
      trimmed,
    )?.[1];
  // Not using the shared isHttpsOrLoopbackHttp predicate here: this call site
  // additionally requires the raw input string's hostname to match the
  // parsed URL's hostname, guarding against a parsing quirk letting a
  // non-loopback input resolve to a loopback URL.hostname.
  const loopback = rawHostname === url.hostname && isCanonicalLoopbackHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Clockify backendUrl must use HTTPS outside canonical loopback hosts.");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

/**
 * Rejects an empty, `.`, or `..` segment — including one only reachable by
 * decoding a caller-supplied percent-encoding once (e.g. `%2e%2e`). Every
 * segment is still passed through encodeURIComponent below, which already
 * keeps embedded `/`, `?`, and `#` characters confined to their own opaque
 * segment; only a segment that resolves to a bare dot or dot-dot is an
 * actual traversal risk. Malformed percent-encoding is rejected outright.
 */
function isBadClockifyPathSegment(segment: string): boolean {
  if (segment === "" || segment === "." || segment === "..") return true;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return true;
  }
  return decoded === "" || decoded === "." || decoded === "..";
}

function requestUrl(base: URL, segments: readonly string[]): URL {
  if (segments.length === 0) {
    throw new Error("Clockify API path segments must contain at least one segment.");
  }
  if (segments.some(isBadClockifyPathSegment)) {
    throw new Error("Clockify API path segments must be non-empty and must not be '.' or '..'.");
  }
  const url = new URL(base);
  const suffix = segments.map((segment) => encodeURIComponent(segment)).join("/");
  url.pathname = `${base.pathname}/${suffix}`.replace(/\/{2,}/g, "/");
  return url;
}

/** RFC 7231's Retry-After: either delay-seconds or an HTTP-date, capped at 30s either way. */
function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header !== null && header.trim() !== "") {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
      const diffMs = dateMs - Date.now();
      if (diffMs > 0) return Math.min(diffMs, 30_000);
    }
  }
  return Math.min(100 * 2 ** (attempt - 1), 2_000);
}

/** True for a body shape `send()` can safely re-issue on a 429 retry without it having been consumed. */
function isReplayableRequestBody(body: BodyInit | null | undefined): boolean {
  return (
    body === null ||
    body === undefined ||
    typeof body === "string" ||
    body instanceof Uint8Array ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  );
}

/** Races `sleep(ms)` against `signal` aborting, so an abort during backoff does not wait out the delay. */
function sleepOrAbort(
  ms: number,
  signal: AbortSignal | undefined,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  if (!signal) return sleep(ms);
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    sleep(ms).then(
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Fetch-based client for Marketplace-specific add-on token, settings, and generic API calls.
 *
 * A request can reject with:
 * - {@link ClockifyAddonHttpError} on a non-`ok` HTTP status.
 * - `Error("Clockify add-on request timed out.")` — a generic `Error`, matched by `/timed out/i` —
 *   when one attempt exceeds `timeoutMs`.
 * - `signal.reason` (identity preserved, may be a `DOMException`) when the caller's `signal` aborts.
 * - `Error` with `cause` set to the original parse error when `getSettings`/`updateSettings` receive
 *   a `200` response whose body is not valid JSON.
 *
 * The `sleep` constructor option exists to let tests control backoff timing; a production override
 * must not throw or reject — if it does, that rejection propagates as-is instead of one of the
 * shapes above.
 */
export class ClockifyAddonClient {
  private readonly token: string;
  private readonly backendUrl: URL;
  private readonly fetch: typeof globalThis.fetch;
  private readonly signal?: AbortSignal;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly onRetry?: (info: ClockifyAddonClientRetryInfo) => void;

  constructor(options: ClockifyAddonClientOptions) {
    if (options.token.trim() === "") throw new Error("Clockify add-on token must not be empty.");
    this.token = options.token;
    this.backendUrl = normalizeBackendUrl(options.backendUrl);
    this.fetch = options.fetch ?? globalThis.fetch;
    this.signal = options.signal;
    const timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      throw new Error("timeoutMs must be an integer between 1 and 2147483647.");
    }
    this.timeoutMs = timeoutMs;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1)
      throw new Error("maxAttempts must be a positive integer.");
    this.onRetry = options.onRetry;
  }

  private notifyRetry(info: ClockifyAddonClientRetryInfo): void {
    try {
      this.onRetry?.(info);
    } catch {
      // An observer must never affect retry behavior.
    }
  }

  private async send(segments: readonly string[], init: RequestInit): Promise<Response> {
    const url = requestUrl(this.backendUrl, segments);
    const method = (init.method ?? "GET").toUpperCase();
    const safeRead = method === "GET" || method === "HEAD";
    const replayableBody = isReplayableRequestBody(init.body);
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (this.signal?.aborted) throw this.signal.reason;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error("Clockify add-on request timed out.")),
        this.timeoutMs,
      );
      const abort = () => controller.abort(this.signal?.reason);
      this.signal?.addEventListener("abort", abort, { once: true });
      // The abort listener above closes most of the race, but signal could
      // still have become aborted between the pre-check at the top of this
      // iteration and the addEventListener call just above (both synchronous,
      // but not atomic) — in that gap the "abort" event already fired and
      // this listener, registered after, never runs. Re-check and abort the
      // controller directly instead of waiting out the full request timeout.
      if (this.signal?.aborted) controller.abort(this.signal.reason);
      try {
        const headers = new Headers(init.headers);
        headers.delete("authorization");
        headers.set("x-addon-token", this.token);
        const response = await this.fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const retryable =
          replayableBody && (response.status === 429 || (safeRead && response.status >= 500));
        if (retryable && attempt < this.maxAttempts) {
          try {
            // cancel() releases the connection back to the pool on Node 22's
            // fetch and on workerd. The Fetch spec defines cancel() as
            // best-effort, so a runtime that needs a full drain instead of a
            // cancel is a known gap; whatever happens here must never block
            // or replace the intended retry below.
            await response.body?.cancel();
          } catch {
            // Discarded-response cleanup must not replace the intended retry.
          }
          const delayMs = retryDelay(response, attempt);
          this.notifyRetry({ attempt, status: response.status, delayMs });
          await sleepOrAbort(delayMs, this.signal, this.sleep);
          continue;
        }
        return response;
      } catch (error) {
        if (!safeRead || attempt >= this.maxAttempts || this.signal?.aborted) throw error;
        const delayMs = Math.min(100 * 2 ** (attempt - 1), 2_000);
        this.notifyRetry({ attempt, error, delayMs });
        await sleepOrAbort(delayMs, this.signal, this.sleep);
      } finally {
        clearTimeout(timeout);
        this.signal?.removeEventListener("abort", abort);
      }
    }
    throw new Error("Clockify add-on request exhausted retry attempts.");
  }

  private async expectOk(segments: readonly string[], init: RequestInit): Promise<Response> {
    const response = await this.send(segments, init);
    if (!response.ok) throw new ClockifyAddonHttpError(response.status, await response.text());
    return response;
  }

  /**
   * Parses an ok response as JSON, wrapping a malformed body (a `SyntaxError`
   * from `response.json()`) with a clearer message and `cause` chain instead
   * of letting the raw parse error surface unattributed.
   */
  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new Error("Clockify add-on response is not valid JSON.", { cause });
    }
  }

  /** Exchanges an installation token for a user-scoped add-on token. */
  async exchangeUserToken(userId: string): Promise<string> {
    const response = await this.expectOk(["addon", "user", userId, "token"], { method: "POST" });
    return response.text();
  }

  /** Retrieves structured settings for one installation workspace. */
  async getSettings<T = unknown>(workspaceId: string): Promise<T> {
    const response = await this.expectOk(["addon", "workspaces", workspaceId, "settings"], {
      method: "GET",
    });
    return this.parseJson<T>(response);
  }

  /** Updates structured settings for one installation workspace. */
  async updateSettings<T = unknown>(
    workspaceId: string,
    updates: readonly ClockifySettingUpdate[],
  ): Promise<T> {
    const response = await this.expectOk(["addon", "workspaces", workspaceId, "settings"], {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updates),
    });
    return this.parseJson<T>(response);
  }

  /** Performs an authenticated request using encoded, caller-supplied path segments. */
  request(pathSegments: readonly string[], init: RequestInit = {}): Promise<Response> {
    return this.expectOk(pathSegments, init);
  }
}
