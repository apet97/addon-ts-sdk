import express from "express";
import { ClockifyAddon, ClockifyManifest, ClockifyComponent } from "../../src";
import { createExpressAddonHandler } from "../../src/adapters/express";

const manifest = ClockifyManifest.v1_4Builder()
  .key("express-addon")
  .name("Express Addon Example")
  .baseUrl("https://example.com/addon")
  .requireProPlan()
  .build();

const addon = new ClockifyAddon(manifest);

// Register a component
addon.registerComponent(
  ClockifyComponent.v1_4Builder()
    .activityTab()
    .allowAdmins()
    .path("/tab")
    .label("My Express Tab")
    .build(),
  async () => {
    return {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<h1>Welcome to the Express Component!</h1>",
    };
  }
);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Bind the addon handler
app.use(createExpressAddonHandler(addon));

app.listen(3000, () => {
  console.log("Express addon server listening on http://localhost:3000");
});
