import { describe, it, expect, afterEach, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ClockifyAddon, ClockifyManifest, generated } from "../src";
import { createNodeHttpAddonServer } from "../src/adapters";

describe("Node HTTP server boot (integration)", () => {
  let server: Server | undefined;

  afterEach(() => {
    if (server) {
      server.close();
      server = undefined;
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
