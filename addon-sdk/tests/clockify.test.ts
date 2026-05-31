import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";
import { generated } from "../src";

describe("Clockify Addon Hooks", () => {
  const getCleanManifest = () =>
    ClockifyManifest.v1_4Builder()
      .key("my-addon")
      .name("My Addon")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  it("should register webhook and push to manifest.webhooks", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const webhook = generated.v1_4.ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/new-project")
      .build();

    addon.registerWebhook(webhook, () => ({ status: 200 }));

    expect(addon.getManifest().webhooks).toContainEqual(webhook);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "POST", path: "/hooks/new-project" });
  });

  it("should register lifecycle and push to manifest.lifecycle", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const lifecycle = generated.v1_4.ClockifyLifecycleEventBuilder()
      .path("/lifecycle/install")
      .onInstalled()
      .build();

    addon.registerLifecycleEvent(lifecycle, () => ({ status: 200 }));

    expect(addon.getManifest().lifecycle).toContainEqual(lifecycle);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "POST", path: "/lifecycle/install" });
  });

  it("should register component and push to manifest.components", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const component = generated.v1_4.ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/sidebar")
      .label("My Sidebar")
      .build();

    addon.registerComponent(component, () => ({ status: 200 }));

    expect(addon.getManifest().components).toContainEqual(component);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "GET", path: "/ui/sidebar" });
  });

  it("should register custom settings and set manifest.settings to path", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    addon.registerCustomSettings("/settings/custom", () => ({ status: 200 }));

    expect(addon.getManifest().settings).toBe("/settings/custom");
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "GET", path: "/settings/custom" });
  });

  it("should not mutate manifest if hook registration fails due to duplicate path", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const component1 = generated.v1_4.ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/dup")
      .label("Tab 1")
      .build();

    const component2 = generated.v1_4.ClockifyComponentBuilder()
      .type("widget")
      .allowEveryone()
      .path("/ui/dup")
      .label("Tab 2")
      .build();

    addon.registerComponent(component1, () => ({ status: 200 }));
    expect(addon.getManifest().components?.length).toBe(1);

    expect(() => {
      addon.registerComponent(component2, () => ({ status: 200 }));
    }).toThrow();

    // Check manifest components list was NOT mutated to include the duplicate
    expect(addon.getManifest().components?.length).toBe(1);
    expect(addon.getManifest().components?.[0]).toEqual(component1);
  });
});
