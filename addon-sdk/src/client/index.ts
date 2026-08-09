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
  /** The response status that triggered the retry, absent for a transport or timeout retry. */
  readonly status?: number;
  /** The transport or timeout error that triggered the retry, absent for a status-based retry. */
  readonly error?: unknown;
  /** Delay before the retry, in milliseconds. */
  readonly delayMs: number;
}

/** Construction options for {@link ClockifyAddonClient}. */
export interface ClockifyAddonClientOptions {
  readonly token: string;
  readonly backendUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  /** Stops every request from this client. A per-request signal can stop one generic request. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Observe retries for metrics/logging. Never affects retry behavior, even if it throws. */
  readonly onRetry?: (info: ClockifyAddonClientRetryInfo) => void;
}

/** Options for one generic authenticated add-on request. */
export interface ClockifyAddonRequestOptions extends RequestInit {
  /** Encoded onto the request URL and not forwarded as a nonstandard Fetch option. */
  readonly query?: URLSearchParams;
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

/** Resolves Retry-After or X-RateLimit-Reset to a delay capped at 30 seconds. */
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
  const resetHeader = response.headers.get("x-ratelimit-reset");
  if (resetHeader !== null) {
    const resetMs = Number(resetHeader) * 1000;
    const diffMs = resetMs - Date.now();
    if (Number.isFinite(resetMs) && diffMs > 0) return Math.min(diffMs, 30_000);
  }
  return Math.min(100 * 2 ** (attempt - 1), 2_000);
}

/** True for a body shape `send()` can safely re-issue without it having been consumed. */
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

const RETRYABLE_READ_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

/** Starts best-effort response cleanup without delaying the caller or a retry. */
function cancelResponseBody(response: Response): void {
  try {
    void response.body?.cancel().catch(() => undefined);
  } catch {
    // Response cleanup must not replace or delay the intended result.
  }
}

/** Races `sleep(ms)` against `signal` aborting, so an abort during backoff does not wait out the delay. */
function sleepOrAbort(
  ms: number,
  signals: readonly AbortSignal[],
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  const aborted = signals.find((signal) => signal.aborted);
  if (aborted) return Promise.reject(aborted.reason);
  if (signals.length === 0) return sleep(ms);
  return new Promise((resolve, reject) => {
    const listeners: Array<{
      readonly signal: AbortSignal;
      readonly listener: () => void;
    }> = [];
    const cleanup = () => {
      for (const { signal, listener } of listeners) {
        signal.removeEventListener("abort", listener);
      }
    };
    for (const signal of signals) {
      const listener = () => {
        cleanup();
        reject(signal.reason);
      };
      listeners.push({ signal, listener });
      signal.addEventListener("abort", listener, { once: true });
    }
    const abortedAfterRegistration = signals.find((signal) => signal.aborted);
    if (abortedAfterRegistration) {
      cleanup();
      reject(abortedAfterRegistration.reason);
      return;
    }
    let delay: Promise<void>;
    try {
      delay = sleep(ms);
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }
    delay.then(
      () => {
        cleanup();
        resolve();
      },
      (error) => {
        cleanup();
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
 *   when a non-retryable or final attempt exceeds `timeoutMs`.
 * - `signal.reason` (identity preserved, may be a `DOMException`) when the caller's `signal` aborts.
 * - `Error` when a request attempts to follow a redirect or receives an HTTP 3xx response.
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

  private async send(
    segments: readonly string[],
    options: ClockifyAddonRequestOptions,
  ): Promise<Response> {
    const { query, ...init } = options;
    const url = requestUrl(this.backendUrl, segments);
    if (query !== undefined) url.search = query.toString();
    if (init.redirect === "follow") {
      throw new Error("Clockify add-on requests must not follow redirects.");
    }
    const method = (init.method ?? "GET").toUpperCase();
    const safeRequest = method === "GET" || method === "HEAD" || method === "OPTIONS";
    const replayableBody = isReplayableRequestBody(init.body);
    const callerSignals = [this.signal, init.signal].filter(
      (signal): signal is AbortSignal => signal !== undefined && signal !== null,
    );
    const initiallyAborted = callerSignals.find((signal) => signal.aborted);
    if (initiallyAborted) throw initiallyAborted.reason;
    const requestHeaders = new Headers(init.headers);
    requestHeaders.delete("authorization");
    requestHeaders.set("x-addon-token", this.token);
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const alreadyAborted = callerSignals.find((signal) => signal.aborted);
      if (alreadyAborted) throw alreadyAborted.reason;
      const controller = new AbortController();
      const timeoutError = new Error("Clockify add-on request timed out.");
      const timeout = setTimeout(() => controller.abort(timeoutError), this.timeoutMs);
      const abortListeners = callerSignals.map((signal) => {
        const listener = () => controller.abort(signal.reason);
        signal.addEventListener("abort", listener, { once: true });
        return { signal, listener };
      });
      // The abort listener above closes most of the race, but signal could
      // still have become aborted between the pre-check at the top of this
      // iteration and the addEventListener call just above (both synchronous,
      // but not atomic) — in that gap the "abort" event already fired and
      // this listener, registered after, never runs. Re-check and abort the
      // controller directly instead of waiting out the full request timeout.
      const abortedAfterRegistration = callerSignals.find((signal) => signal.aborted);
      if (abortedAfterRegistration) controller.abort(abortedAfterRegistration.reason);
      let outcome: { readonly response: Response } | { readonly error: unknown };
      try {
        outcome = {
          response: await this.fetch(url, {
            ...init,
            redirect: "manual",
            headers: new Headers(requestHeaders),
            signal: controller.signal,
          }),
        };
      } catch (error) {
        outcome = { error };
      } finally {
        clearTimeout(timeout);
        for (const { signal, listener } of abortListeners) {
          signal.removeEventListener("abort", listener);
        }
      }

      if ("error" in outcome) {
        const timeoutWon = controller.signal.reason === timeoutError;
        if (controller.signal.aborted && !timeoutWon) throw controller.signal.reason;
        if (timeoutWon && callerSignals.some((signal) => signal.aborted)) throw timeoutError;
        const retryError = timeoutWon ? timeoutError : outcome.error;
        if (!safeRequest || !replayableBody || attempt >= this.maxAttempts) throw retryError;
        const delayMs = Math.min(100 * 2 ** (attempt - 1), 2_000);
        this.notifyRetry({ attempt, error: retryError, delayMs });
        await sleepOrAbort(delayMs, callerSignals, this.sleep);
        continue;
      }

      const { response } = outcome;
      if (response.status >= 300 && response.status < 400) {
        cancelResponseBody(response);
        throw new Error(`Clockify add-on request rejected HTTP ${response.status} redirect.`);
      }
      const retryable =
        replayableBody &&
        (response.status === 429 ||
          (safeRequest && RETRYABLE_READ_STATUS_CODES.has(response.status)));
      if (retryable && attempt < this.maxAttempts) {
        cancelResponseBody(response);
        const delayMs = retryDelay(response, attempt);
        this.notifyRetry({ attempt, status: response.status, delayMs });
        await sleepOrAbort(delayMs, callerSignals, this.sleep);
        continue;
      }
      return response;
    }
    throw new Error("Clockify add-on request exhausted retry attempts.");
  }

  private async expectOk(
    segments: readonly string[],
    init: ClockifyAddonRequestOptions,
  ): Promise<Response> {
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

  /**
   * Performs an authenticated request using encoded path segments and optional query parameters.
   * A signal in `options` stops this request. The client rejects `redirect: "follow"` and never
   * forwards the token to a redirect.
   */
  request(
    pathSegments: readonly string[],
    options: ClockifyAddonRequestOptions = {},
  ): Promise<Response> {
    return this.expectOk(pathSegments, options);
  }
}
