/** A structured settings value update accepted by Clockify's add-on endpoint. */
export interface ClockifySettingUpdate {
  readonly id: string;
  readonly value: unknown;
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
}

/** HTTP failure returned by a Clockify add-on API call. */
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
  const url = new URL(value);
  if (url.username !== "" || url.password !== "") {
    throw new Error("Clockify backendUrl must not include credentials.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("Clockify backendUrl must use HTTPS outside localhost.");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function requestUrl(base: URL, segments: readonly string[]): URL {
  const url = new URL(base);
  const suffix = segments.map((segment) => encodeURIComponent(segment)).join("/");
  url.pathname = `${base.pathname}/${suffix}`.replace(/\/{2,}/g, "/");
  return url;
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  const seconds = header === null || header.trim() === "" ? Number.NaN : Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(100 * 2 ** (attempt - 1), 2_000);
}

/** Fetch-based client for Marketplace-specific add-on token, settings, and generic API calls. */
export class ClockifyAddonClient {
  private readonly token: string;
  private readonly backendUrl: URL;
  private readonly fetch: typeof globalThis.fetch;
  private readonly signal?: AbortSignal;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

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
  }

  private async send(segments: readonly string[], init: RequestInit): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const safeRead = method === "GET" || method === "HEAD";
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (this.signal?.aborted) throw this.signal.reason;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error("Clockify add-on request timed out.")),
        this.timeoutMs,
      );
      const abort = () => controller.abort(this.signal?.reason);
      this.signal?.addEventListener("abort", abort, { once: true });
      try {
        const headers = new Headers(init.headers);
        headers.set("x-addon-token", this.token);
        const response = await this.fetch(requestUrl(this.backendUrl, segments), {
          ...init,
          headers,
          signal: controller.signal,
        });
        const retryable = response.status === 429 || (safeRead && response.status >= 500);
        if (retryable && attempt < this.maxAttempts) {
          try {
            await response.body?.cancel();
          } catch {
            // Discarded-response cleanup must not replace the intended retry.
          }
          await this.sleep(retryDelay(response, attempt));
          continue;
        }
        return response;
      } catch (error) {
        if (!safeRead || attempt >= this.maxAttempts || this.signal?.aborted) throw error;
        await this.sleep(Math.min(100 * 2 ** (attempt - 1), 2_000));
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
    return (await response.json()) as T;
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
    return (await response.json()) as T;
  }

  /** Performs an authenticated request using encoded, caller-supplied path segments. */
  request(pathSegments: readonly string[], init: RequestInit = {}): Promise<Response> {
    return this.expectOk(pathSegments, init);
  }
}
