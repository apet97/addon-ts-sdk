import { describe, it, expect, vi } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";
import {
  DEFAULT_MAX_BODY_BYTES,
  InvalidContentLengthError,
  InvalidRequestTargetError,
  PayloadTooLargeError,
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
    expect(() => resolveMaxBodyBytes({ maxBodyBytes: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
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

  it("rejects an absolute-form Node request-target before it can pick its own host", async () => {
    // A single-"/" target is always prefixed with http://localhost, so it can
    // never resolve to a foreign host. Only a full "scheme://host/..." target
    // bypasses that prefix entirely and lets the target pick its own host.
    const mockReq = new IncomingMessage(new Socket());
    mockReq.headers = { host: "localhost" };
    mockReq.url = "http://evil.example/manifest";
    mockReq.method = "GET";

    await expect(fromNodeRequest(mockReq)).rejects.toBeInstanceOf(InvalidRequestTargetError);
  });

  it("rejects a //-prefixed Node request-target (authority-form, not origin-form)", async () => {
    for (const url of ["//evil.example/manifest", "///", "//"]) {
      const mockReq = new IncomingMessage(new Socket());
      mockReq.headers = { host: "localhost" };
      mockReq.url = url;
      mockReq.method = "GET";

      await expect(fromNodeRequest(mockReq)).rejects.toBeInstanceOf(InvalidRequestTargetError);
    }
  });

  it("rejects Node HTTP requests with oversized content-length before body parsing", async () => {
    const mockReq = new IncomingMessage(new Socket());
    mockReq.headers = { host: "localhost", "content-length": "8" };
    mockReq.url = "/webhook";
    mockReq.method = "POST";

    const promise = fromNodeRequest(mockReq, { maxBodyBytes: 4 });
    mockReq.emit("end");

    await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects malformed or negative declared content lengths", async () => {
    for (const contentLength of ["not-a-number", "-1", "1.5"]) {
      const mockReq = new IncomingMessage(new Socket());
      mockReq.headers = { host: "localhost", "content-length": contentLength };
      mockReq.url = "/webhook";
      mockReq.method = "POST";
      const promise = fromNodeRequest(mockReq);
      mockReq.emit("end");
      await expect(promise).rejects.toBeInstanceOf(InvalidContentLengthError);
    }
    const huge = new IncomingMessage(new Socket());
    huge.headers = { host: "localhost", "content-length": String(Number.MAX_SAFE_INTEGER + 1) };
    huge.url = "/webhook";
    huge.method = "POST";
    const hugePromise = fromNodeRequest(huge);
    huge.emit("end");
    await expect(hugePromise).rejects.toBeInstanceOf(InvalidContentLengthError);
  });

  it("rejects Node HTTP requests with a duplicate content-length header", async () => {
    // Node's IncomingMessage.headers silently keeps only the first content-length
    // value; the duplicate is only visible on rawHeaders.
    const mockReq = new IncomingMessage(new Socket());
    mockReq.headers = { host: "localhost", "content-length": "5" };
    mockReq.rawHeaders = ["host", "localhost", "content-length", "5", "content-length", "6"];
    mockReq.url = "/webhook";
    mockReq.method = "POST";

    const promise = fromNodeRequest(mockReq);
    mockReq.emit("end");

    await expect(promise).rejects.toBeInstanceOf(InvalidContentLengthError);
  });

  it("delivers a Fetch request's raw (possibly comma-joined) header value to the handler", async () => {
    // The Fetch Headers object folds a repeated header into one comma-joined
    // string before the SDK ever sees it; verifying that duplicate signatures
    // are rejected as ambiguous is covered in request-verification.test.ts,
    // against the same comma-joined shape asserted here.
    const addon = new ClockifyAddon(mockManifest);
    let receivedSignature: string | string[] | undefined;
    addon.registerHandler("/component", "GET", (req) => {
      receivedSignature = req.headers["clockify-signature"];
      return { status: 200, body: "ok" };
    });

    const request = new Request("https://example.com/component", {
      headers: [
        ["clockify-signature", "jwt1.jwt1.jwt1"],
        ["clockify-signature", "jwt2.jwt2.jwt2"],
      ],
    });

    const response = await handleFetchRequest(addon, request);
    expect(response.status).toBe(200);
    expect(receivedSignature).toBe("jwt1.jwt1.jwt1, jwt2.jwt2.jwt2");
  });

  it("rejects Node HTTP requests that stream past maxBodyBytes without content-length", async () => {
    const mockReq = new IncomingMessage(new Socket());
    mockReq.headers = { host: "localhost" };
    mockReq.url = "/webhook";
    mockReq.method = "POST";

    const promise = fromNodeRequest(mockReq, { maxBodyBytes: 4 });
    mockReq.emit("data", Buffer.from("123"));
    mockReq.emit("data", Buffer.from("45"));
    mockReq.emit("end");

    await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeError);
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

  it.each(["GET", "HEAD"])(
    "returns 413 for an oversized declared length on %s without dispatching or reporting",
    async (method) => {
      const onError = vi.fn();
      const addon = new ClockifyAddon(mockManifest);
      const handler = vi.fn(() => ({ status: 204 }));
      addon.registerHandler("/component", "GET", handler);

      const response = await handleFetchRequest(
        addon,
        new Request("https://example.com/component", {
          method,
          headers: { "content-length": "5" },
        }),
        { maxBodyBytes: 4, onError },
      );

      expect(response.status).toBe(413);
      expect(handler).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for a malformed declared length on GET without dispatching or reporting", async () => {
    const onError = vi.fn();
    const addon = new ClockifyAddon(mockManifest);
    const handler = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/component", "GET", handler);

    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/component", {
        method: "GET",
        headers: { "content-length": "007" },
      }),
      { onError },
    );

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed Fetch content-length without dispatching", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const handler = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/webhook", "POST", handler);
    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/webhook", {
        method: "POST",
        headers: { "content-length": "invalid" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["10, 10", "5,5", " 10, 10"])(
    "explicitly rejects a folded duplicate Fetch content-length %j",
    async (contentLength) => {
      // The Fetch Headers object folds a client-repeated content-length
      // header into one comma-joined string instead of exposing it as a
      // list, matching how node-http.ts rejects a duplicate observed via
      // rawHeaders — reject it explicitly here too.
      const addon = new ClockifyAddon(mockManifest);
      const handler = vi.fn(() => ({ status: 204 }));
      addon.registerHandler("/webhook", "POST", handler);
      const response = await handleFetchRequest(
        addon,
        new Request("https://example.com/webhook", {
          method: "POST",
          headers: { "content-length": contentLength },
          body: "{}",
        }),
      );
      expect(response.status).toBe(400);
      expect(handler).not.toHaveBeenCalled();
    },
  );

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

  it("parses query params from req.url when Express-like req.query is unavailable", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const seen: string[] = [];
    addon.registerHandler("/component", "GET", (request) => {
      seen.push(request.path);
      seen.push(...request.query.getAll("auth_token"));
      seen.push(request.query.get("mode") ?? "");
      return { status: 204 };
    });
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/component?auth_token=abc&auth_token=def&mode=compact",
      headers: {},
    };

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq, mockRes);

    expect(seen).toEqual(["/component", "abc", "def", "compact"]);
  });

  it("preserves leading slashes when Express-like req.path is unavailable", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const route = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/component", "GET", route);
    const handler = createExpressAddonHandler(addon);
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler({ method: "GET", url: "/other-path", headers: {} }, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(route).not.toHaveBeenCalled();
  });

  it("rejects a //-prefixed request target with 400 instead of routing it as a literal path", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const route = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/component", "GET", route);
    const handler = createExpressAddonHandler(addon);
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler({ method: "GET", url: "//evil.example/component", headers: {} }, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith("Bad Request");
    expect(route).not.toHaveBeenCalled();
  });

  it("preserves array-valued Express query params", async () => {
    const addon = new ClockifyAddon(mockManifest);
    const seen: string[] = [];
    addon.registerHandler("/component", "GET", (request) => {
      seen.push(...request.query.getAll("auth_token"));
      seen.push(request.query.get("mode") ?? "");
      return { status: 204 };
    });
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/component",
      path: "/component",
      headers: {},
      query: {
        auth_token: ["abc", "def"],
        mode: "compact",
      },
    };

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq, mockRes);

    expect(seen).toEqual(["abc", "def", "compact"]);
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

  it("preserves array-valued response headers in Node HTTP responses", () => {
    const mockRes = new ServerResponse(new IncomingMessage(new Socket()));
    const endSpy = vi.spyOn(mockRes, "end").mockImplementation(() => mockRes);
    const headerSpy = vi.spyOn(mockRes, "setHeader").mockImplementation(() => mockRes);

    writeNodeResponse(mockRes, {
      status: 204,
      headers: { "set-cookie": ["a=1", "b=2"] },
    });

    expect(headerSpy).toHaveBeenCalledWith("set-cookie", ["a=1", "b=2"]);
    expect(endSpy).toHaveBeenCalled();
  });

  it("sets JSON content-type when Node HTTP writes object bodies", () => {
    const mockRes = new ServerResponse(new IncomingMessage(new Socket()));
    const endSpy = vi.spyOn(mockRes, "end").mockImplementation(() => mockRes);
    const headerSpy = vi.spyOn(mockRes, "setHeader").mockImplementation(() => mockRes);

    writeNodeResponse(mockRes, {
      status: 200,
      body: { ok: true },
    });

    expect(headerSpy).toHaveBeenCalledWith("content-type", "application/json");
    expect(endSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
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

  it("appends array-valued response headers in the Fetch adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/headers", "GET", () => ({
      status: 204,
      headers: { "x-clockify-trace": ["first", "second"] },
    }));

    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/headers", { method: "GET" }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("x-clockify-trace")).toBe("first, second");
  });

  it("rejects a malformed absolute-form Express request-target with 400, without reporting or calling next()", async () => {
    // A malformed request target is a client error, not a server fault: it
    // returns 400 directly without dispatch, matching the Node adapter's
    // InvalidRequestTargetError handling and the Fetch adapter's un-reported
    // 400/413 for malformed/oversized content-length above.
    const addon = new ClockifyAddon(mockManifest);
    const onError = vi.fn();
    const handler = createExpressAddonHandler(addon, { onError });

    const mockReq = {
      method: "GET",
      url: "http://evil.example/manifest",
      headers: {},
      query: {},
    };
    const next = vi.fn();
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq as any, mockRes as any, next);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith("Bad Request");
    expect(onError).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("reports an Express adapter error via onError before falling through to next()", async () => {
    // addon.handle() reports errors from inside the handler chain via its own
    // onError; this covers what happens for an error the router itself
    // surfaces after successful dispatch, while writing the response.
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/component", "GET", () => ({
      status: 204,
      headers: { "x-test": "1" },
    }));
    const onError = vi.fn();
    const handler = createExpressAddonHandler(addon, { onError });

    const mockReq = {
      method: "GET",
      url: "/component",
      headers: {},
      query: {},
    };
    const next = vi.fn();
    const failingError = new Error("res.set exploded");
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn(() => {
        throw failingError;
      }),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq as any, mockRes as any, next);

    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failingError,
      expect.objectContaining({ source: "express-adapter" }),
    );
    expect(onError.mock.calls[0]![1].nativeRequest).toBeUndefined();
    expect(next).toHaveBeenCalledExactlyOnceWith(failingError);
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

  it("sends primitive response bodies through the Express adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/text", "GET", () => ({
      status: 200,
      body: "plain text",
    }));
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/text",
      path: "/text",
      headers: {},
      query: {},
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

    await handler(mockReq, mockRes);

    expect(jsonSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith("plain text");
  });

  it("passes array-valued response headers through the Express adapter", async () => {
    const addon = new ClockifyAddon(mockManifest);
    addon.registerHandler("/headers", "GET", () => ({
      status: 204,
      headers: { "set-cookie": ["a=1", "b=2"] },
    }));
    const handler = createExpressAddonHandler(addon);

    const mockReq = {
      method: "GET",
      url: "/headers",
      path: "/headers",
      headers: {},
      query: {},
    };
    const setSpy = vi.fn().mockReturnThis();
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      set: setSpy,
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler(mockReq, mockRes);

    expect(setSpy).toHaveBeenCalledWith({ "set-cookie": ["a=1", "b=2"] });
  });
});
