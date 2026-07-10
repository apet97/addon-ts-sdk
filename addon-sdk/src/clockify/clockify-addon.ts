import { Addon, AddonOptions } from "../shared/addon";
import { RequestHandler } from "../shared/handler";
import { ClockifyManifest, ClockifySchemaVersion } from "./clockify-manifest";
import { ClockifyWebhook, ClockifyLifecycleEvent, ClockifyComponent } from "./clockify-models";
import { assertClockifyManifest } from "./clockify-manifest-validation";

/**
 * A Clockify add-on server.
 *
 * The manifest's schema version is INFERRED from the manifest object, so a manifest of any
 * supported version constructs without an explicit type parameter:
 *
 *   new ClockifyAddon(ClockifyManifest.v1_5Builder()....build())  // M inferred as the v1.5 manifest
 *
 * The `register*` methods are then typed against that same version.
 */
export class ClockifyAddon<
  M extends { readonly schemaVersion: ClockifySchemaVersion } = ClockifyManifest<"1.4">,
> extends Addon<M> {
  constructor(manifest: M, manifestPath?: string, options?: AddonOptions) {
    super(manifest, manifestPath, options);
  }

  registerWebhook(webhook: ClockifyWebhook<M["schemaVersion"]>, handler: RequestHandler): void {
    this.registerHandler(webhook.path, Addon.HTTP_POST, handler);
    const m = this.manifest as unknown as { webhooks: ClockifyWebhook<M["schemaVersion"]>[] };
    m.webhooks.push(webhook);
  }

  registerLifecycleEvent(
    event: ClockifyLifecycleEvent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    this.registerHandler(event.path, Addon.HTTP_POST, handler);
    const m = this.manifest as unknown as {
      lifecycle: ClockifyLifecycleEvent<M["schemaVersion"]>[];
    };
    m.lifecycle.push(event);
  }

  registerComponent(
    component: ClockifyComponent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    this.registerHandler(component.path, Addon.HTTP_GET, handler);
    const m = this.manifest as unknown as { components: ClockifyComponent<M["schemaVersion"]>[] };
    m.components.push(component);
  }

  registerCustomSettings(path: string, handler: RequestHandler): void {
    this.registerHandler(path, Addon.HTTP_GET, handler);
    const m = this.manifest as { settings?: string };
    m.settings = path;
  }
}

/** Validates a manifest before creating a Clockify add-on server runtime. */
export function createValidatedClockifyAddon<
  M extends { readonly schemaVersion: ClockifySchemaVersion },
>(manifest: M, manifestPath?: string, options?: AddonOptions): ClockifyAddon<M> {
  assertClockifyManifest(manifest);
  return new ClockifyAddon(manifest, manifestPath, options);
}
