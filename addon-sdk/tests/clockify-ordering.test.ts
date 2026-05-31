import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest, generated } from "../src";

describe("Clockify ordering & response middleware", () => {
  const base = () =>
    ClockifyManifest.v1_4Builder()
      .key("k")
      .name("n")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  it("stores multiple lifecycle events in registration order", () => {
    const addon = new ClockifyAddon(base());

    const e1 = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lc/install")
      .onInstalled()
      .build();
    const e2 = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lc/delete")
      .onDeleted()
      .build();

    addon.registerLifecycleEvent(e1, () => ({ status: 200 }));
    addon.registerLifecycleEvent(e2, () => ({ status: 200 }));

    const lifecycle = addon.getManifest().lifecycle!;
    expect(lifecycle.length).toBe(2);
    expect(lifecycle[0]).toEqual(e1);
    expect(lifecycle[1]).toEqual(e2);
  });

  it("lets middleware augment the outgoing response headers", async () => {
    const addon = new ClockifyAddon(base());
    addon.use(async (req, next) => {
      const res = await next(req);
      return {
        ...res,
        headers: { ...(res.headers || {}), "x-powered-by": "clockify-addon-sdk" },
      };
    });

    const res = await addon.handle({ method: "GET", path: "/manifest", headers: {} });
    expect(res.headers?.["x-powered-by"]).toBe("clockify-addon-sdk");
    expect(res.headers?.["content-type"]).toBe("application/json");
  });
});
