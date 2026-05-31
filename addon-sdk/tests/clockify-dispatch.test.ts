import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest, generated } from "../src";

describe("Clockify dispatch through handle()", () => {
  const base = () =>
    ClockifyManifest.v1_4Builder()
      .key("k")
      .name("n")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  it("routes component (GET), webhook (POST), lifecycle (POST) to their own handlers", async () => {
    const addon = new ClockifyAddon(base());

    const component = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui")
      .label("UI")
      .build();
    addon.registerComponent(component, () => ({ status: 200, body: "component-body" }));

    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/np")
      .build();
    addon.registerWebhook(webhook, () => ({ status: 200, body: "webhook-body" }));

    const lifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lc/install")
      .onInstalled()
      .build();
    addon.registerLifecycleEvent(lifecycle, () => ({ status: 200, body: "lifecycle-body" }));

    const c = await addon.handle({ method: "GET", path: "/ui", headers: {} });
    expect(c.status).toBe(200);
    expect(c.body).toBe("component-body");

    const w = await addon.handle({ method: "POST", path: "/hooks/np", headers: {} });
    expect(w.status).toBe(200);
    expect(w.body).toBe("webhook-body");

    const l = await addon.handle({ method: "POST", path: "/lc/install", headers: {} });
    expect(l.status).toBe(200);
    expect(l.body).toBe("lifecycle-body");

    // A component is GET-only: POSTing to it must be 405 (method mapping is enforced).
    const wrong = await addon.handle({ method: "POST", path: "/ui", headers: {} });
    expect(wrong.status).toBe(405);
  });
});
