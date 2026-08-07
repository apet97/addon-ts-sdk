import { describe, it, expect } from "vitest";
import {
  ClockifyAddon,
  ClockifyManifest,
  IllegalArgumentException,
  createValidatedClockifyAddon,
} from "../src";
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

    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/new-project")
      .build();

    addon.registerWebhook(webhook, () => ({ status: 200 }));

    expect(addon.getManifest().webhooks).toHaveLength(1);
    expect(addon.getManifest().webhooks).toContainEqual(webhook);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "POST", path: "/hooks/new-project" });
  });

  it("should register lifecycle and push to manifest.lifecycle", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const lifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/install")
      .onInstalled()
      .build();

    addon.registerLifecycleEvent(lifecycle, () => ({ status: 200 }));

    expect(addon.getManifest().lifecycle).toHaveLength(1);
    expect(addon.getManifest().lifecycle).toContainEqual(lifecycle);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "POST", path: "/lifecycle/install" });
  });

  it("should register component and push to manifest.components", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const component = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/sidebar")
      .label("My Sidebar")
      .build();

    addon.registerComponent(component, () => ({ status: 200 }));

    expect(addon.getManifest().components).toHaveLength(1);
    expect(addon.getManifest().components).toContainEqual(component);
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "GET", path: "/ui/sidebar" });
  });

  it("registers routes against schema-valid manifests with absent optional arrays", () => {
    const manifest: ClockifyManifest<"1.4"> = {
      schemaVersion: "1.4",
      key: "raw-valid-addon",
      name: "Raw Valid Addon",
      baseUrl: "https://example.com/addon",
      minimalSubscriptionPlan: "BASIC",
    };
    const addon = createValidatedClockifyAddon(manifest);
    const component = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowEveryone()
      .path("/component/raw")
      .label("Raw component")
      .build();
    const lifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/raw")
      .onInstalled()
      .build();
    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/webhooks/raw")
      .build();

    addon.registerComponent(component, () => ({ status: 204 }));
    addon.registerLifecycleEvent(lifecycle, () => ({ status: 204 }));
    addon.registerWebhook(webhook, () => ({ status: 204 }));

    expect(addon.getManifest().components).toEqual([component]);
    expect(addon.getManifest().lifecycle).toEqual([lifecycle]);
    expect(addon.getManifest().webhooks).toEqual([webhook]);
  });

  it("binds handlers to identical predeclared descriptors without duplicating them", () => {
    const component = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/predeclared")
      .label("Predeclared sidebar")
      .build();
    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/predeclared")
      .build();
    const lifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/predeclared")
      .onInstalled()
      .build();
    const manifest = ClockifyManifest.v1_4Builder()
      .key("predeclared-addon")
      .name("Predeclared Addon")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .lifecycle([lifecycle])
      .webhooks([webhook])
      .components([component])
      .build();
    const addon = new ClockifyAddon(manifest);

    const matchingComponent = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/predeclared")
      .label("Predeclared sidebar")
      .build();
    const matchingWebhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/predeclared")
      .build();
    const matchingLifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/predeclared")
      .onInstalled()
      .build();

    addon.registerComponent(matchingComponent, () => ({ status: 200 }));
    addon.registerWebhook(matchingWebhook, () => ({ status: 200 }));
    addon.registerLifecycleEvent(matchingLifecycle, () => ({ status: 200 }));

    expect(addon.getManifest().components).toEqual([component]);
    expect(addon.getManifest().webhooks).toEqual([webhook]);
    expect(addon.getManifest().lifecycle).toEqual([lifecycle]);
    expect(addon.getRegisteredRequests()).toEqual(
      expect.arrayContaining([
        { method: "GET", path: "/ui/predeclared" },
        { method: "POST", path: "/hooks/predeclared" },
        { method: "POST", path: "/lifecycle/predeclared" },
      ]),
    );
  });

  it("rejects conflicting predeclared descriptors before registering their routes", () => {
    const component = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/conflict")
      .label("Original sidebar")
      .build();
    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/conflict")
      .build();
    const lifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/conflict")
      .onInstalled()
      .build();
    const manifest = ClockifyManifest.v1_4Builder()
      .key("conflicting-addon")
      .name("Conflicting Addon")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .lifecycle([lifecycle])
      .webhooks([webhook])
      .components([component])
      .build();
    const addon = new ClockifyAddon(manifest);
    const conflictingComponent = generated.v1_4
      .ClockifyComponentBuilder()
      .type("widget")
      .allowEveryone()
      .path("/ui/conflict")
      .label("Different component")
      .build();
    const conflictingWebhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_TIME_ENTRY")
      .path("/hooks/conflict")
      .build();
    const conflictingLifecycle = generated.v1_4
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/conflict")
      .onDeleted()
      .build();

    expect(() => addon.registerComponent(conflictingComponent, () => ({ status: 200 }))).toThrow(
      /conflicting component/i,
    );
    expect(() => addon.registerWebhook(conflictingWebhook, () => ({ status: 200 }))).toThrow(
      /conflicting webhook/i,
    );
    expect(() =>
      addon.registerLifecycleEvent(conflictingLifecycle, () => ({ status: 200 })),
    ).toThrow(/conflicting lifecycle event/i);

    expect(addon.getManifest().components).toEqual([component]);
    expect(addon.getManifest().webhooks).toEqual([webhook]);
    expect(addon.getManifest().lifecycle).toEqual([lifecycle]);
    expect(addon.getRegisteredRequests()).not.toEqual(
      expect.arrayContaining([
        { method: "GET", path: "/ui/conflict" },
        { method: "POST", path: "/hooks/conflict" },
        { method: "POST", path: "/lifecycle/conflict" },
      ]),
    );
  });

  it("should register custom settings and set manifest.settings to path", async () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    addon.registerCustomSettings("/settings/custom", () => ({ status: 200 }));

    expect(addon.getManifest().settings).toBe("/settings/custom");
    const requests = addon.getRegisteredRequests();
    expect(requests).toContainEqual({ method: "GET", path: "/settings/custom" });
  });

  it("should treat an identical registerCustomSettings redeclaration as a no-op", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);
    const firstHandler = () => ({ status: 200 });

    addon.registerCustomSettings("/settings/custom", firstHandler);
    expect(() =>
      addon.registerCustomSettings("/settings/custom", () => ({ status: 200 })),
    ).not.toThrow();

    expect(addon.getManifest().settings).toBe("/settings/custom");
    expect(addon.getRegisteredRequests()).toEqual(
      expect.arrayContaining([{ method: "GET", path: "/settings/custom" }]),
    );
  });

  it("should throw and leave the router and manifest unchanged when registerCustomSettings conflicts with a prior structured settings object", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);
    const structuredSettings = { tabs: [] } as unknown as string;
    (addon.getManifest() as { settings?: unknown }).settings = structuredSettings;

    expect(() => addon.registerCustomSettings("/settings/custom", () => ({ status: 200 }))).toThrow(
      IllegalArgumentException,
    );

    expect(addon.getManifest().settings).toBe(structuredSettings);
    expect(addon.getRegisteredRequests()).not.toContainEqual({
      method: "GET",
      path: "/settings/custom",
    });
  });

  it("should throw and leave the router and manifest unchanged when registerCustomSettings conflicts with a different path", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    addon.registerCustomSettings("/settings/custom", () => ({ status: 200 }));
    expect(() => addon.registerCustomSettings("/settings/other", () => ({ status: 200 }))).toThrow(
      IllegalArgumentException,
    );

    expect(addon.getManifest().settings).toBe("/settings/custom");
    expect(addon.getRegisteredRequests()).not.toContainEqual({
      method: "GET",
      path: "/settings/other",
    });
  });

  it("should not mutate manifest if hook registration fails due to duplicate path", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const component1 = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/dup")
      .label("Tab 1")
      .build();

    const component2 = generated.v1_4
      .ClockifyComponentBuilder()
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

  it("allows an identical webhook redeclaration without throwing, still rejects a conflicting one", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const webhook = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_PROJECT")
      .path("/hooks/p")
      .build();
    const handler = () => ({ status: 200 });

    addon.registerWebhook(webhook, handler);
    // Re-declaring the exact same webhook (e.g. a module re-evaluated during
    // hot reload) must be a no-op, not throw "Handler has already been
    // registered" from the underlying router.
    expect(() => addon.registerWebhook(webhook, handler)).not.toThrow();
    expect(addon.getManifest().webhooks).toHaveLength(1);
    expect(addon.getRegisteredRequests().filter((r) => r.path === "/hooks/p")).toHaveLength(1);

    const conflicting = generated.v1_4
      .ClockifyWebhookBuilder()
      .event("NEW_TASK")
      .path("/hooks/p")
      .build();
    expect(() => addon.registerWebhook(conflicting, handler)).toThrow(IllegalArgumentException);
    expect(addon.getManifest().webhooks).toHaveLength(1);
    expect(addon.getManifest().webhooks?.[0]).toEqual(webhook);
  });
});
