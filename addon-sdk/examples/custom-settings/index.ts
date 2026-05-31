import { ClockifyAddon, ClockifyManifest } from "../../src";
import { createNodeHttpAddonServer } from "../../src/adapters/node-http";

const manifest = ClockifyManifest.v1_4Builder()
  .key("custom-settings-addon")
  .name("Custom Settings Example")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .build();

const addon = new ClockifyAddon(manifest);

// Register a custom settings endpoint
addon.registerCustomSettings("/settings/custom", async (req) => {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { ok: true, message: "Settings page rendered" },
  };
});

const server = createNodeHttpAddonServer(addon);

server.listen(3000, () => {
  console.log("Custom settings addon server listening on http://localhost:3000");
});
