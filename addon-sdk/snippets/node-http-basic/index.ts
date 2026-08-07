import { ClockifyAddon, ClockifyManifest, ClockifyScope } from "../../src";
import { createNodeHttpAddonServer } from "../../src/adapters/node-http";

const manifest = ClockifyManifest.v1_4Builder()
  .key("node-http-addon")
  .name("Node HTTP Addon Example")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .scopes([ClockifyScope.PROJECT_READ])
  .build();

const addon = new ClockifyAddon(manifest);

const server = createNodeHttpAddonServer(addon);

server.listen(3000, () => {
  console.log("Basic Node HTTP addon server listening on http://localhost:3000");
});
