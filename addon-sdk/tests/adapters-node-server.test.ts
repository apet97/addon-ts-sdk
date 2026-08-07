import { describe, it, expect, afterEach, vi } from "vitest";
import type { Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { ClockifyAddon, ClockifyManifest, generated } from "../src";
import { createNodeHttpAddonServer } from "../src/adapters";

describe("Node HTTP server boot (integration)", () => {
  let server: Server | undefined;

  afterEach(async () => {
    const activeServer = server;
    server = undefined;
    if (activeServer) {
      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  const base = () =>
    ClockifyManifest.v1_4Builder()
      .key("k")
      .name("n")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  function listen(
    addon: ClockifyAddon,
    options?: Parameters<typeof createNodeHttpAddonServer>[1],
  ): Promise<number> {
    server = createNodeHttpAddonServer(addon, options);
    return new Promise((resolve) => {
      server!.listen(0, () => resolve((server!.address() as AddressInfo).port));
    });
  }

  function sendRawHttp(port: number, request: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port }, () => socket.end(request));
      let response = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        response += chunk;
      });
      socket.once("end", () => resolve(response));
      socket.once("error", reject);
    });
  }

  it("serves GET /manifest over the wire as JSON", async () => {
    const addon = new ClockifyAddon(base());
    const port = await listen(addon);
    const res = await fetch(`http://127.0.0.1:${port}/manifest`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = await res.json();
    expect(body.key).toBe("k");
  });

  it("returns 404 for an unknown route over the wire", async () => {
    const addon = new ClockifyAddon(base());
    const port = await listen(addon);
    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);
  });

  it("rejects a double-slash request target with 400 instead of treating it as a literal path", async () => {
    // A "//host/path" target is authority-form grammar, not origin-form. A
    // downstream proxy that forwards the raw target could interpret it as
    // absolute with host "host", so the server rejects it outright rather
    // than silently treating it as a literal, harmless path.
    const addon = new ClockifyAddon(base());
    const handler = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/component", "GET", handler);
    const port = await listen(addon);

    const response = await sendRawHttp(
      port,
      [
        "GET //other.example/component HTTP/1.1",
        "Host: localhost",
        "Connection: close",
        "",
        "",
      ].join("\r\n"),
    );

    expect(response).toMatch(/^HTTP\/1\.1 400 /);
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches a POST webhook handler over the wire", async () => {
    const addon = new ClockifyAddon(base());
    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/np")
      .build();
    let received: unknown = null;
    addon.registerWebhook(webhook, (req) => {
      received = req.body;
      return { status: 204 };
    });
    const port = await listen(addon);
    const res = await fetch(`http://127.0.0.1:${port}/hooks/np`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    expect(res.status).toBe(204);
    expect(received).toEqual({ ok: true });
  });

  it("returns 413 for oversized request bodies before dispatching", async () => {
    const addon = new ClockifyAddon(base());
    let dispatched = false;
    addon.registerHandler("/hooks/np", "POST", () => {
      dispatched = true;
      return { status: 204 };
    });

    const port = await listen(addon, { maxBodyBytes: 4 });
    const res = await fetch(`http://127.0.0.1:${port}/hooks/np`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    expect(res.status).toBe(413);
    expect(res.headers.get("connection")).toBe("close");
    expect(await res.text()).toBe("Payload Too Large");
    expect(dispatched).toBe(false);
  });

  it("returns 400 without reporting malformed parser-accepted content lengths", async () => {
    const onError = vi.fn();
    const handle = vi.fn(() => ({ status: 204 }));
    const addon = { handle } as unknown as ClockifyAddon;
    const port = await listen(addon, { onError });

    const response = await sendRawHttp(
      port,
      [
        "POST /manifest HTTP/1.1",
        "Host: localhost",
        "Content-Length: 007",
        "Connection: close",
        "",
        "1234567",
      ].join("\r\n"),
    );

    expect(response).toMatch(/^HTTP\/1\.1 400 /);
    expect(response).toContain("Bad Request");
    expect(handle).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("throws configuration errors before creating a server with an invalid body limit", () => {
    const addon = new ClockifyAddon(base());

    expect(() => createNodeHttpAddonServer(addon, { maxBodyBytes: 0 })).toThrow(/positive integer/);
  });

  it("reports Node HTTP adapter errors when dispatch throws outside the router", async () => {
    const error = new Error("server exploded");
    const onError = vi.fn();
    const addon = {
      handle: vi.fn().mockRejectedValue(error),
    } as unknown as ClockifyAddon;

    const port = await listen(addon, { onError });
    const res = await fetch(`http://127.0.0.1:${port}/manifest`);

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Internal Server Error");
    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        source: "node-http-adapter",
      }),
    );
  });
});
