import { describe, expect, it, vi } from "vitest";
import { ClockifyAddonClient, ClockifyAddonHttpError } from "../src/client";

describe("ClockifyAddonClient", () => {
  it("rejects unsafe configuration", () => {
    expect(
      () => new ClockifyAddonClient({ token: " ", backendUrl: "https://api.example/api" }),
    ).toThrow(/token/i);
    expect(
      () => new ClockifyAddonClient({ token: "token", backendUrl: "http://api.example/api" }),
    ).toThrow(/HTTPS/i);
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
