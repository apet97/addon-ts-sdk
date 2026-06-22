import { describe, it, expect, vi } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";
import {
  DEFAULT_MAX_BODY_BYTES,
  createExpressAddonHandler,
  fromNodeRequest,
  handleFetchRequest,
  resolveMaxBodyBytes,
  writeNodeResponse,
} from "../src/adapters";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

describe("Adapters", () => {
  const mockManifest = ClockifyManifest.v1_4Builder()
    .key("my-addon")
    .name("My Addon")
    .baseUrl("https://example.com/addon")
    .requireBasicPlan()
    .build();

  it("exposes and validates adapter body-limit options", () => {
    expect(DEFAULT_MAX_BODY_BYTES).toBe(1_048_576);
    expect(resolveMaxBodyBytes()).toBe(DEFAULT_MAX_BODY_BYTES);
    expect(resolveMaxBodyBytes({ maxBodyBytes: 2 })).toBe(2);
    expect(() => resolveMaxBodyBytes({ maxBodyBytes: 0 })).toThrow(/positive integer/);
    expect(() => resolveMaxBodyBytes({ maxBodyBytes: Number.POSITIVE_INFINITY })).toThrow(
      /positive integer/,
    );
  });

  it("throws configuration errors instead of dispatching with an invalid Fetch body limit", async () => {
    const addon = new ClockifyAddon(mockManifest);
    let dispatched = false;
    addon.registerHandler("/webhook", "POST", () => {
      dispatched = true;
      return { status: 204 };
    });

    await expect(
      handleFetchRequest(
        addon,
        new Request("https://example.com/webhook", {
          method: "POST",
          body: JSON.stringify({ event: "NEW_PROJECT" }),
        }),
        { maxBodyBytes: 0 },
      ),
    ).rejects.toThrow(/positive integer/);
    expect(dispatched).toBe(false);
  });

  it("should serve /manifest via Fetch adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const request = new Request("https://example.com/manifest", {
      method: "GET",
    });

    const response = await handleFetchRequest(addon, request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");

    const body = await response.json();
    expect(body.key).toBe("my-addon");
  });

  it("should serve POST webhook via Fetch adapter with body", async () => {
    const addon = new ClockifyAddon(mockManifest);
    let receivedBody: any = null;
    addon.registerHandler("/webhook", "POST", (req) => {
      receivedBody = req.body;
      return { status: 204 };
    });

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "NEW_PROJECT" }),
    });

    const response = await handleFetchRequest(addon, request);
    expect(response.status).toBe(204);
    expect(receivedBody).toEqual({ event: "NEW_PROJECT" });
  });

  it("returns 400 and does not dispatch when a Fetch request body cannot be read", async () => {
    const addon = new ClockifyAddon(mockManifest);
    let dispatched = false;
    addon.registerHandler("/webhook", "POST", () => {
      dispatched = true;
      return { status: 204 };
    });

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "NEW_PROJECT" }),
    });
    await request.text();

    const response = await handleFetchRequest(addon, request);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Bad Request");
    expect(dispatched).toBe(false);
  });

  it("returns 500 from Fetch adapter errors without logging by default", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const addon = {
      handle: vi.fn().mockRejectedValue(new Error("adapter exploded")),
    } as unknown as ClockifyAddon;

    try {
      const response = await handleFetchRequest(
        addon,
        new Request("https://example.com/manifest", { method: "GET" }),
      );

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Internal Server Error");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports Fetch adapter errors when an error reporter is configured", async () => {
    const onError = vi.fn();
    const error = new Error("adapter exploded");
    const addon = {
      handle: vi.fn().mockRejectedValue(error),
    } as unknown as ClockifyAddon;

    await handleFetchRequest(
      addon,
      new Request("https://example.com/manifest", { method: "GET" }),
      { onError },
    );

    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        source: "fetch-adapter",
      }),
    );
  });

  it("returns 413 when a Fetch request body exceeds maxBodyBytes", async () => {
    const addon = new ClockifyAddon(mockManifest);
    let dispatched = false;
    addon.registerHandler("/webhook", "POST", () => {
      dispatched = true;
      return { status: 204 };
    });

    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "NEW_PROJECT" }),
      }),
      { maxBodyBytes: 4 },
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("Payload Too Large");
    expect(dispatched).toBe(false);
  });

  it("should handle Express handler flow", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/manifest",
      path: "/manifest",
      headers: {},
      query: {},
      body: {},
    };

    const statusSpy = vi.fn();
    const setSpy = vi.fn();
    const jsonSpy = vi.fn();
    const endSpy = vi.fn();

    const mockRes = {
      status: statusSpy.mockImplementation(() => mockRes),
      set: setSpy.mockImplementation(() => mockRes),
      json: jsonSpy.mockImplementation(() => mockRes),
      end: endSpy.mockImplementation(() => mockRes),
    };

    await handler(mockReq, mockRes);

    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(setSpy).toHaveBeenCalledWith({ "content-type": "application/json" });
    expect(jsonSpy).toHaveBeenCalledWith(mockManifest);
  });

  it("should serialize Node HTTP mock response properly", () => {
    const mockRes = new ServerResponse(new IncomingMessage(new Socket()));
    const writeSpy = vi.spyOn(mockRes, "end").mockImplementation(() => mockRes);
    const headerSpy = vi.spyOn(mockRes, "setHeader").mockImplementation(() => {});

    writeNodeResponse(mockRes, {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<h1>Hello</h1>",
    });

    expect(mockRes.statusCode).toBe(200);
    expect(headerSpy).toHaveBeenCalledWith("content-type", "text/html");
    expect(writeSpy).toHaveBeenCalledWith("<h1>Hello</h1>");
  });

  it("should parse Node HTTP requests with JSON and text bodies via fromNodeRequest", async () => {
    const mockReq = new IncomingMessage(new Socket());
    mockReq.headers = { host: "localhost" };
    mockReq.url = "/test-route?param=abc";
    mockReq.method = "POST";

    // Simulate reading body stream
    const promise = fromNodeRequest(mockReq);
    mockReq.emit("data", Buffer.from('{"key":"value"}'));
    mockReq.emit("end");

    const parsed = await promise;
    expect(parsed.method).toBe("POST");
    expect(parsed.path).toBe("/test-route");
    expect(parsed.query?.get("param")).toBe("abc");
    expect(parsed.body).toEqual({ key: "value" });
    expect(Buffer.from(parsed.rawBody!)).toEqual(Buffer.from('{"key":"value"}'));

    // Test malformed JSON fallback to string
    const mockReqText = new IncomingMessage(new Socket());
    mockReqText.headers = { host: "localhost" };
    mockReqText.url = "/test-route";
    mockReqText.method = "POST";

    const promiseText = fromNodeRequest(mockReqText);
    mockReqText.emit("data", Buffer.from("plain-text"));
    mockReqText.emit("end");

    const parsedText = await promiseText;
    expect(parsedText.body).toBe("plain-text");
  });

  it("should handle Node HTTP request read error", async () => {
    const mockReq = new IncomingMessage(new Socket());
    const promise = fromNodeRequest(mockReq);
    mockReq.emit("error", new Error("Read error"));

    await expect(promise).rejects.toThrow("Read error");
  });

  it("should delegate to next(e) in Express adapter if routing throws", async () => {
    const addon = new ClockifyAddon(mockManifest);
    vi.spyOn(addon, "handle").mockRejectedValue(new Error("Route execution error"));
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/cause-error",
      path: "/cause-error",
      headers: {},
    };

    const nextSpy = vi.fn();
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockReq, mockRes, nextSpy);

    expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should respond with 500 in Express adapter if next is not provided", async () => {
    const addon = new ClockifyAddon(mockManifest);
    vi.spyOn(addon, "handle").mockRejectedValue(new Error("Route execution error"));
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/cause-error-no-next",
      path: "/cause-error-no-next",
      headers: {},
    };

    const statusSpy = vi.fn();
    const sendSpy = vi.fn();
    const mockRes = {
      status: statusSpy.mockImplementation(() => mockRes),
      send: sendSpy.mockImplementation(() => mockRes),
    };

    await handler(mockReq, mockRes); // no next callback passed

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(sendSpy).toHaveBeenCalledWith("Internal Server Error");
  });

  it("writes Uint8Array response bodies as raw bytes via writeNodeResponse", () => {
    const mockRes = new ServerResponse(new IncomingMessage(new Socket()));
    const endSpy = vi.spyOn(mockRes, "end").mockImplementation(() => mockRes);
    const headerSpy = vi.spyOn(mockRes, "setHeader").mockImplementation(() => mockRes);

    writeNodeResponse(mockRes, { status: 200, body: new Uint8Array([1, 2, 3]) });

    expect(endSpy).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(headerSpy).not.toHaveBeenCalledWith("content-type", "application/json");
  });

  it("preserves Uint8Array response bodies as raw bytes via the Fetch adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/binary", "POST", () => ({
      status: 200,
      body: new Uint8Array([1, 2, 3]),
    }));

    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/binary", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).not.toBe("application/json");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it("sends Uint8Array response bodies as raw bytes via the Express adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/binary", "POST", () => ({
      status: 200,
      body: new Uint8Array([1, 2, 3]),
    }));
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "POST",
      url: "/binary",
      path: "/binary",
      headers: {},
      query: {},
      body: {},
    };
    const sendSpy = vi.fn().mockReturnThis();
    const jsonSpy = vi.fn().mockReturnThis();
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: jsonSpy,
      send: sendSpy,
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq as any, mockRes as any);

    expect(jsonSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
  });
});
