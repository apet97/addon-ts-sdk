import { describe, it, expect, vi } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";
import { ValidationException, IllegalArgumentException } from "../src/shared/errors";

describe("Router", () => {
  const mockManifest = ClockifyManifest.v1_4Builder()
    .key("my-addon")
    .name("My Addon")
    .baseUrl("https://example.com/addon")
    .requireBasicPlan()
    .build();

  it("should auto-register GET /manifest", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const response = await addon.handle({
      method: "GET",
      path: "/manifest",
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(response.headers?.["content-type"]).toBe("application/json");
    expect(response.body).toEqual(mockManifest);
  });

  it("should trim trailing slash from request path during routing", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const response = await addon.handle({
      method: "GET",
      path: "/manifest/",
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockManifest);
  });

  it("should not route parameter-like child paths by prefix", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const handler = vi.fn(() => ({ status: 200, body: "matched" }));
    addon.registerHandler("/hooks", "POST", handler);

    const response = await addon.handle({
      method: "POST",
      path: "/hooks/abc-123",
      headers: {},
    });

    expect(response.status).toBe(404);
    expect(response.body).toBe("Not Found");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should reject path registration with ending slash", () => {
    const addon = new ClockifyAddon(mockManifest);
    expect(() => {
      addon.registerHandler("/endpoint/", "GET", () => ({ status: 200 }));
    }).toThrow(ValidationException);
  });

  it("should reject path registration without leading slash", () => {
    const addon = new ClockifyAddon(mockManifest);
    expect(() => {
      addon.registerHandler("endpoint", "GET", () => ({ status: 200 }));
    }).toThrow(ValidationException);
  });

  it("should reject duplicate path registration", () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/test", "GET", () => ({ status: 200 }));
    expect(() => {
      addon.registerHandler("/test", "GET", () => ({ status: 200 }));
    }).toThrow(IllegalArgumentException);
  });

  it("should allow registering same path with different HTTP method", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/test", "GET", () => ({ status: 200, body: "get" }));
    addon.registerHandler("/test", "POST", () => ({ status: 200, body: "post" }));

    const resGet = await addon.handle({ method: "GET", path: "/test", headers: {} });
    const resPost = await addon.handle({ method: "POST", path: "/test", headers: {} });

    expect(resGet.body).toBe("get");
    expect(resPost.body).toBe("post");
  });

  it("should return 405 Method Not Allowed for unregistered route/method", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const response = await addon.handle({
      method: "POST",
      path: "/manifest",
      headers: {},
    });

    expect(response.status).toBe(405);
    expect(response.body).toBe("Method Not Allowed");
    expect(response.headers?.allow).toBe("GET, HEAD, OPTIONS");
  });

  it("supports HEAD and OPTIONS without invoking a GET body twice", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const head = await addon.handle({ method: "HEAD", path: "/manifest", headers: {} });
    expect(head.status).toBe(200);
    expect(head.body).toBeUndefined();
    expect(head.headers?.["content-type"]).toBe("application/json");

    const options = await addon.handle({ method: "OPTIONS", path: "/manifest", headers: {} });
    expect(options.status).toBe(204);
    expect(options.headers?.allow).toBe("GET, HEAD, OPTIONS");
  });

  it("should return 500 on handler exceptions without logging by default", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    addon.registerHandler("/fail", "GET", () => {
      throw new Error("Simulated failure");
    });

    try {
      const response = await addon.handle({
        method: "GET",
        path: "/fail",
        headers: {},
      });

      expect(response.status).toBe(500);
      expect(response.body).toBe("Internal Server Error");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports handled router errors when an error reporter is configured", async () => {
    const onError = vi.fn();
    const addon = new ClockifyAddon(mockManifest, undefined, { onError });
    addon.registerHandler("/fail", "GET", () => {
      throw new Error("Reported failure");
    });

    const request = { method: "GET", path: "/fail", headers: {} };
    const response = await addon.handle(request);

    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        source: "router",
        request,
      }),
    );
  });

  it("should execute middleware chain in order", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const order: number[] = [];

    addon.use(async (req, next) => {
      order.push(1);
      const res = await next(req);
      order.push(3);
      return res;
    });

    addon.use(async (req, next) => {
      order.push(2);
      return await next(req);
    });

    addon.registerHandler("/mid", "GET", () => {
      order.push(4);
      return { status: 200 };
    });

    await addon.handle({ method: "GET", path: "/mid", headers: {} });
    expect(order).toEqual([1, 2, 4, 3]);
  });

  it("should handle middleware that throws", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.use(async () => {
      throw new Error("Middleware error");
    });

    addon.registerHandler("/mid-throw", "GET", () => {
      return { status: 200 };
    });

    const res = await addon.handle({ method: "GET", path: "/mid-throw", headers: {} });
    expect(res.status).toBe(500);
    expect(res.body).toBe("Internal Server Error");
  });

  it("should support middleware that swallows request and returns custom response", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.use(async () => {
      return { status: 403, body: "Forbidden by middleware" };
    });

    addon.registerHandler("/mid-swallow", "GET", () => {
      return { status: 200, body: "ok" };
    });

    const res = await addon.handle({ method: "GET", path: "/mid-swallow", headers: {} });
    expect(res.status).toBe(403);
    expect(res.body).toBe("Forbidden by middleware");
  });

  it("should reject middleware that calls next multiple times after one handler execution", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let count = 0;
    addon.use(async (req, next) => {
      await next(req);
      const res2 = await next(req);
      return res2;
    });

    addon.registerHandler("/mid-double", "GET", () => {
      count++;
      return { status: 200, body: `run-${count}` };
    });

    try {
      const res = await addon.handle({ method: "GET", path: "/mid-double", headers: {} });
      expect(count).toBe(1);
      expect(res.status).toBe(500);
      expect(res.body).toBe("Internal Server Error");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
