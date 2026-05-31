import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest } from "../src";

describe("getRegisteredRequests", () => {
  const base = () =>
    ClockifyManifest.v1_4Builder()
      .key("k")
      .name("n")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .build();

  it("returns a path containing ':' intact", () => {
    const addon = new ClockifyAddon(base());
    addon.registerHandler("/oauth:callback", "GET", () => ({ status: 200 }));
    const reqs = addon.getRegisteredRequests();
    expect(reqs).toContainEqual({ method: "GET", path: "/oauth:callback" });
  });
});
