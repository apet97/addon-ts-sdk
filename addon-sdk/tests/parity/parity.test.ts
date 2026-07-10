import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../../src";
import { generated } from "../../src";

describe("Parity Checks", () => {
  const getCleanManifest = () =>
    ClockifyManifest.v1_4Builder()
      .key("parity-addon")
      .name("Parity Addon")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  it("should match exact error messages for route path validation", () => {
    const addon = new ClockifyAddon(getCleanManifest());

    // Path without leading slash
    expect(() => {
      addon.registerHandler("endpoint", "GET", () => ({ status: 200 }));
    }).toThrowError("Url should be an absolute path and not end with a slash.");

    // Path with trailing slash
    expect(() => {
      addon.registerHandler("/endpoint/", "GET", () => ({ status: 200 }));
    }).toThrowError("Url should be an absolute path and not end with a slash.");
  });

  it("should match duplicate path registration error message", () => {
    const addon = new ClockifyAddon(getCleanManifest());
    addon.registerHandler("/test", "GET", () => ({ status: 200 }));

    expect(() => {
      addon.registerHandler("/test", "GET", () => ({ status: 200 }));
    }).toThrowError("Handler has already been registered.");
  });

  it("should distinguish unmatched paths from unsupported methods", async () => {
    const addon = new ClockifyAddon(getCleanManifest());

    // Unregistered path
    const resPath = await addon.handle({
      method: "GET",
      path: "/non-existent",
      headers: {},
    });
    expect(resPath.status).toBe(404);
    expect(resPath.body).toBe("Not Found");

    // Unregistered method
    const resMethod = await addon.handle({
      method: "POST",
      path: "/manifest",
      headers: {},
    });
    expect(resMethod.status).toBe(405);
    expect(resMethod.body).toBe("Method Not Allowed");
  });

  it("should return strict 500 Internal Server Error when handler throws", async () => {
    const addon = new ClockifyAddon(getCleanManifest());
    addon.registerHandler("/fail", "GET", () => {
      throw new Error("Some internal crash");
    });

    const res = await addon.handle({
      method: "GET",
      path: "/fail",
      headers: {},
    });
    expect(res.status).toBe(500);
    expect(res.body).toBe("Internal Server Error");
  });

  it("should preserve mutation order and NOT mutate manifest if hook registration fails due to duplicate path", () => {
    const manifest = getCleanManifest();
    const addon = new ClockifyAddon(manifest);

    const component1 = generated.v1_4
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowAdmins()
      .path("/ui/test-mutation-order")
      .label("Tab 1")
      .build();

    const component2 = generated.v1_4
      .ClockifyComponentBuilder()
      .type("widget")
      .allowEveryone()
      .path("/ui/test-mutation-order") // duplicate path
      .label("Tab 2")
      .build();

    addon.registerComponent(component1, () => ({ status: 200 }));
    expect(addon.getManifest().components?.length).toBe(1);

    // This should fail to register route and throw before mutating manifest.components
    expect(() => {
      addon.registerComponent(component2, () => ({ status: 200 }));
    }).toThrowError("Handler has already been registered.");

    expect(addon.getManifest().components?.length).toBe(1);
    expect(addon.getManifest().components?.[0]).toEqual(component1);
  });

  it("should trim exactly one trailing slash at dispatch time", async () => {
    const addon = new ClockifyAddon(getCleanManifest());
    addon.registerHandler("/endpoint", "GET", () => ({ status: 200, body: "ok" }));

    const resSingle = await addon.handle({
      method: "GET",
      path: "/endpoint/",
      headers: {},
    });
    expect(resSingle.status).toBe(200);
    expect(resSingle.body).toBe("ok");

    // Multiple trailing slashes should not match if they evaluate to "/endpoint/" (since we only trim one slash)
    // Wait, trimTrailingSlash("/endpoint//") -> "/endpoint/" which has a trailing slash and thus won't match GET:/endpoint
    const resDouble = await addon.handle({
      method: "GET",
      path: "/endpoint//",
      headers: {},
    });
    expect(resDouble.status).toBe(404);
  });
});
