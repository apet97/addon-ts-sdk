// Minimal Cloudflare Worker that hosts the SDK through its standards-based
// Fetch adapter. Exists to prove the published package shape imports,
// instantiates, and bundles for the Workers runtime.
import {
  ClockifyAddon,
  ClockifyComponent,
  ClockifyManifest,
  createClockifySignatureParser,
  verifyClockifyComponentRequest,
} from "@apet97/clockify-addon-sdk";
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";

export const ADDON_KEY = "workers-compat";

export function buildAddon(publicKeyPem) {
  const manifest = ClockifyManifest.v1_5Builder()
    .key(ADDON_KEY)
    .name("Workers Compat")
    .baseUrl("https://workers-compat.example.com")
    .requireBasicPlan()
    .build();

  const addon = new ClockifyAddon(manifest);
  const parser = createClockifySignatureParser(
    ADDON_KEY,
    publicKeyPem ? { publicKey: publicKeyPem } : undefined,
  );

  addon.registerComponent(
    ClockifyComponent.v1_5Builder()
      .activityTab()
      .allowEveryone()
      .path("/component")
      .label("Workers Compat")
      .build(),
    async (request) => {
      const verification = await verifyClockifyComponentRequest(parser, request);
      if (!verification.ok) {
        return { status: 401, body: "Unauthorized" };
      }
      return { status: 200, body: { workspaceId: verification.claims.workspaceId } };
    },
  );

  return addon;
}

export default {
  fetch(request) {
    return handleFetchRequest(buildAddon(), request);
  },
};
