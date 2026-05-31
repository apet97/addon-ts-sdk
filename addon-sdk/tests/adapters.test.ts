import { describe, it, expect, vi } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";
import { handleFetchRequest, createExpressAddonHandler, fromNodeRequest, writeNodeResponse } from "../src/adapters";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

describe("Adapters", () => {
  const mockManifest = ClockifyManifest.v1_4Builder()
    .key("my-addon")
    .name("My Addon")
    .baseUrl("https://example.com/addon")
    .requireBasicPlan()
    .build();

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
});
