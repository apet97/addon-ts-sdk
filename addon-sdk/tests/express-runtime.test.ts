import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createRequire } from "node:module";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ClockifyAddon, ClockifyManifest } from "../src";
import { createExpressAddonHandler } from "../src/adapters";

const require = createRequire(import.meta.url);
const expressVersion = require("express/package.json").version as string;

describe("Express runtime adapter", () => {
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

  function manifest() {
    return ClockifyManifest.v1_4Builder()
      .key("express-runtime")
      .name("Express Runtime")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();
  }

  function listen(addon: ClockifyAddon): Promise<number> {
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(createExpressAddonHandler(addon));
    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(599).send(err.message);
      },
    );
    server = app.listen(0);
    return new Promise((resolve) => {
      server!.on("listening", () => resolve((server!.address() as AddressInfo).port));
    });
  }

  it("runs against Express 5 in the SDK compatibility fixture", () => {
    expect(expressVersion.startsWith("5.")).toBe(true);
  });

  it("serves the manifest and dispatches JSON POST bodies", async () => {
    const addon = new ClockifyAddon(manifest());
    let received: unknown = null;
    addon.registerHandler("/webhook", "POST", (request) => {
      received = request.body;
      return { status: 202, body: { accepted: true } };
    });

    const port = await listen(addon);

    const manifestResponse = await fetch(`http://127.0.0.1:${port}/manifest`);
    expect(manifestResponse.status).toBe(200);
    expect((await manifestResponse.json()).key).toBe("express-runtime");

    const webhookResponse = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "NEW_PROJECT" }),
    });
    expect(webhookResponse.status).toBe(202);
    expect(await webhookResponse.json()).toEqual({ accepted: true });
    expect(received).toEqual({ event: "NEW_PROJECT" });
  });

  it("delegates adapter errors to Express error middleware", async () => {
    const addon = new ClockifyAddon(manifest());
    addon.handle = async () => {
      throw new Error("adapter exploded");
    };
    const port = await listen(addon);

    const response = await fetch(`http://127.0.0.1:${port}/boom`);

    expect(response.status).toBe(599);
    expect(await response.text()).toBe("adapter exploded");
  });
});
