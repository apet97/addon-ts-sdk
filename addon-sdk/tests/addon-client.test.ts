import { describe, expect, it, vi } from "vitest";
import { ClockifyAddonClient, ClockifyAddonHttpError } from "../src/client";

describe("ClockifyAddonClient", () => {
  it("rejects unsafe configuration", () => {
    expect(
      () => new ClockifyAddonClient({ token: " ", backendUrl: "https://api.example/api" }),
    ).toThrow(/token/i);
    expect(
      () => new ClockifyAddonClient({ token: "token", backendUrl: "http://api.example/api" }),
    ).toThrow(new Error("Clockify backendUrl must use HTTPS outside canonical loopback hosts."));
    expect(
      () =>
        new ClockifyAddonClient({
          token: "token",
          backendUrl: "https://api.example/api",
          maxAttempts: 0,
        }),
    ).toThrow(/positive integer/i);
    expect(
      () =>
        new ClockifyAddonClient({
          token: "token",
          backendUrl: "https://user:password@api.example/api",
        }),
    ).toThrow(/credentials/i);
    expect(
      () =>
        new ClockifyAddonClient({
          token: "token",
          backendUrl: "http://user:password@127.1:8080/api",
        }),
    ).toThrow(new Error("Clockify backendUrl must not include credentials."));
  });

  it.each(["http://127.0.0.1:8080/api", "http://[::1]:8080/api"])(
    "accepts canonical loopback backendUrl %s",
    (backendUrl) => {
      expect(() => new ClockifyAddonClient({ token: "token", backendUrl })).not.toThrow();
    },
  );

  it.each([
    ["http://localhost\\api", "http://localhost/api/v1"],
    ["http://localhost:8080\\api", "http://localhost:8080/api/v1"],
  ])(
    "normalizes a special-URL backslash path in backendUrl %s",
    async (backendUrl, expectedUrl) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      const client = new ClockifyAddonClient({ token: "token", backendUrl, fetch });

      await client.request(["v1"]);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(String(fetch.mock.calls[0][0])).toBe(expectedUrl);
    },
  );

  it.each([
    "http://127.0.0.1.:8080/api",
    "http://127.1:8080/api",
    "http://2130706433:8080/api",
    "http://0x7f000001:8080/api",
    "http://[0:0:0:0:0:0:0:1]:8080/api",
    "http://LOCALHOST:8080/api",
    "http://localhost.:8080/api",
  ])("rejects noncanonical loopback backendUrl spelling %s", (backendUrl) => {
    expect(() => new ClockifyAddonClient({ token: "token", backendUrl })).toThrow(
      new Error("Clockify backendUrl must use HTTPS outside canonical loopback hosts."),
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 2_147_483_648])(
    "rejects invalid timeoutMs %s",
    (timeoutMs) => {
      expect(
        () =>
          new ClockifyAddonClient({
            token: "token",
            backendUrl: "https://api.example/api",
            timeoutMs,
          }),
      ).toThrow(new Error("timeoutMs must be an integer between 1 and 2147483647."));
    },
  );

  it.each([1, 15_000, 2_147_483_647])("accepts timeoutMs %s", (timeoutMs) => {
    expect(
      () =>
        new ClockifyAddonClient({
          token: "token",
          backendUrl: "https://api.example/api",
          timeoutMs,
        }),
    ).not.toThrow();
  });

  it("uses claim-derived URLs, X-Addon-Token, and encoded path segments", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ tabs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new ClockifyAddonClient({
      token: "user-token",
      backendUrl: "https://regional.example/api",
      fetch,
    });

    await client.getSettings("workspace/../?secret=true");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://regional.example/api/addon/workspaces/workspace%2F..%2F%3Fsecret%3Dtrue/settings",
    );
    expect(new Headers(init?.headers).get("x-addon-token")).toBe("user-token");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it.each(["", ".", ".."])(
    "rejects exact %j path segments before fetching or sleeping",
    async (segment) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      const sleep = vi.fn(async () => undefined);
      const client = new ClockifyAddonClient({
        token: "token",
        backendUrl: "https://api.example/api",
        fetch,
        sleep,
      });
      const error = new Error(
        "Clockify API path segments must be non-empty and must not be '.' or '..'.",
      );

      await expect(client.request([segment])).rejects.toThrowError(error);
      await expect(client.exchangeUserToken(segment)).rejects.toThrowError(error);
      expect(fetch).not.toHaveBeenCalled();
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it.each(["%2e", "%2e%2e", "%252e"])(
    "rejects a %j segment that decodes to '.' or '..' before fetching",
    async (segment) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      const sleep = vi.fn(async () => undefined);
      const client = new ClockifyAddonClient({
        token: "token",
        backendUrl: "https://api.example/api",
        fetch,
        sleep,
      });

      if (segment === "%252e") {
        // Decodes once to the literal text "%2e", not a dot segment — a
        // single decode never resolves it to traversal, so it is accepted
        // and encoded opaquely, matching the caller's literal intent.
        await expect(client.request([segment])).resolves.toBeInstanceOf(Response);
        return;
      }

      await expect(client.request([segment])).rejects.toThrowError(
        new Error("Clockify API path segments must be non-empty and must not be '.' or '..'."),
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it("still safely encodes a segment containing literal path-separator-like characters", async () => {
    // encodeURIComponent keeps embedded '/', '?', '#' confined to one opaque
    // path segment; only a segment that resolves to a bare dot or dot-dot is
    // rejected as traversal.
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
    });

    await client.request(["a/b"]);
    expect(String(fetch.mock.calls[0]![0])).toBe("https://api.example/api/a%2Fb");
  });

  it("rejects a dot-dot segment before it can escape the configured API base path", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      sleep,
    });

    await expect(client.request(["..", "admin"])).rejects.toThrowError(
      new Error("Clockify API path segments must be non-empty and must not be '.' or '..'."),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exchanges an installation token for a user token", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("user-token", { status: 200 }));
    const client = new ClockifyAddonClient({
      token: "install-token",
      backendUrl: "https://api.example/api",
      fetch,
    });
    await expect(client.exchangeUserToken("user/1")).resolves.toBe("user-token");
    expect(String(fetch.mock.calls[0][0])).toContain("/addon/user/user%2F1/token");
  });

  it("retries safe reads and confirmed 429 mutations but not ambiguous 5xx mutations", async () => {
    const readFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const readClient = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: readFetch,
      sleep: async () => undefined,
    });
    await readClient.getSettings("w1");
    expect(readFetch).toHaveBeenCalledTimes(2);

    const rateLimitedFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const rateLimited = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: rateLimitedFetch,
      sleep: async () => undefined,
    });
    await rateLimited.updateSettings("w1", [{ id: "one", value: true }]);
    expect(rateLimitedFetch).toHaveBeenCalledTimes(2);

    const mutationFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("failed", { status: 503 }));
    const mutation = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: mutationFetch,
    });
    await expect(mutation.updateSettings("w1", [])).rejects.toBeInstanceOf(ClockifyAddonHttpError);
    expect(mutationFetch).toHaveBeenCalledTimes(1);
  });

  it("notifies onRetry for both a status-based retry and a network-error retry", async () => {
    const onRetry = vi.fn();
    const statusFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const statusClient = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: statusFetch,
      sleep: async () => undefined,
      onRetry,
    });
    await statusClient.getSettings("w1");
    expect(onRetry).toHaveBeenCalledExactlyOnceWith({
      attempt: 1,
      status: 429,
      delayMs: expect.any(Number),
    });

    onRetry.mockClear();
    const networkError = new TypeError("network down");
    const errorFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const errorClient = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: errorFetch,
      sleep: async () => undefined,
      onRetry,
    });
    await errorClient.getSettings("w1");
    expect(onRetry).toHaveBeenCalledExactlyOnceWith({
      attempt: 1,
      error: networkError,
      delayMs: expect.any(Number),
    });
  });

  it("does not let a throwing onRetry observer affect retry behavior", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      sleep: async () => undefined,
      onRetry: () => {
        throw new Error("observer boom");
      },
    });
    await expect(client.getSettings("w1")).resolves.toEqual({});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("cancels a discarded retry response before sleeping and ignores cancellation failures", async () => {
    const events: string[] = [];
    const discardedBody = new ReadableStream({
      cancel: () => {
        events.push("cancel");
        return Promise.reject(new Error("cleanup failed"));
      },
    });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => {
        events.push("fetch first");
        return new Response(discardedBody, { status: 429 });
      })
      .mockImplementationOnce(async () => {
        events.push("fetch second");
        return new Response('{"updated":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      sleep: async () => {
        events.push("sleep");
      },
    });

    await expect(
      client.updateSettings<{ updated: boolean }>("w1", [{ id: "one", value: true }]),
    ).resolves.toEqual({ updated: true });
    events.push("success");

    expect(events).toEqual(["fetch first", "cancel", "sleep", "fetch second", "success"]);
  });

  it("retries a safe network failure and exposes generic authenticated requests", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "http://localhost:8080/api/",
      fetch,
      sleep: async () => undefined,
    });
    const response = await client.request(["v1", "workspaces", "w/1"]);
    expect(await response.text()).toBe("ok");
    expect(String(fetch.mock.calls[1][0])).toContain("w%2F1");
  });

  it("strips query and fragment data from the configured backend URL", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api?discard=true#fragment",
      fetch,
    });

    await client.request(["workspaces"]);

    expect(String(fetch.mock.calls[0][0])).toBe("https://api.example/api/workspaces");
  });

  it("treats caller aborts as terminal", async () => {
    const controller = new AbortController();
    controller.abort(new Error("caller stopped"));
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      signal: controller.signal,
    });
    await expect(client.getSettings("w1")).rejects.toThrow("caller stopped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses bounded default backoff and enforces request timeouts", async () => {
    const retryingFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response("busy", { status: 503, headers: { "retry-after": "invalid" } }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const retrying = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: retryingFetch,
      maxAttempts: 2,
    });
    await retrying.getSettings("w1");
    expect(retryingFetch).toHaveBeenCalledTimes(2);

    const hangingFetch = vi.fn<typeof globalThis.fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const timed = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch: hangingFetch,
      maxAttempts: 1,
      timeoutMs: 1,
    });
    await expect(timed.getSettings("w1")).rejects.toThrow(/timed out/i);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace-only", " \t "],
  ])("uses bounded default backoff when retry-after is %s", async (_label, retryAfter) => {
    let attempt = 0;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      attempt += 1;
      if (attempt < 7) {
        return new Response("busy", {
          status: 503,
          headers: retryAfter === undefined ? undefined : { "retry-after": retryAfter },
        });
      }
      return new Response("{}", { status: 200 });
    });
    const delays: number[] = [];
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      maxAttempts: 7,
      sleep: async (delay) => {
        delays.push(delay);
      },
    });

    await client.getSettings("w1");

    expect(fetch).toHaveBeenCalledTimes(7);
    expect(delays).toEqual([100, 200, 400, 800, 1_600, 2_000]);
  });

  it("honors a zero retry-after header", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const delays: number[] = [];
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      maxAttempts: 2,
      sleep: async (delay) => {
        delays.push(delay);
      },
    });

    await client.getSettings("w1");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([0]);
  });

  it("aborts an in-flight request when the caller aborts", async () => {
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const client = new ClockifyAddonClient({
      token: "token",
      backendUrl: "https://api.example/api",
      fetch,
      signal: controller.signal,
    });
    const pending = client.getSettings("w1");
    controller.abort(new Error("caller stopped in flight"));
    await expect(pending).rejects.toThrow("caller stopped in flight");
  });
});
