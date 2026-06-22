import { ClockifyAddon, ClockifyComponent, ClockifyManifest } from "../../src";
import { handleFetchRequest } from "../../src/adapters";

export function createFetchBasicAddon(): ClockifyAddon<ClockifyManifest<"1.5">> {
  const manifest = ClockifyManifest.v1_5Builder()
    .key("fetch-basic-addon")
    .name("Fetch Basic Add-on")
    .baseUrl("https://example.com/addon")
    .requireBasicPlan()
    .build();

  const addon = new ClockifyAddon(manifest);
  addon.registerComponent(
    ClockifyComponent.v1_5Builder()
      .activityTab()
      .allowAdmins()
      .path("/component")
      .label("Fetch component")
      .build(),
    () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html><body>Hello from Fetch.</body></html>",
    }),
  );

  return addon;
}

export function handleFetchBasicRequest(addon: ClockifyAddon, request: Request): Promise<Response> {
  return handleFetchRequest(addon, request);
}
