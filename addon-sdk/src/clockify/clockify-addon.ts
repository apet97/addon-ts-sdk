import { Addon } from "../shared/addon";
import { RequestHandler } from "../shared/handler";
import { ClockifyManifest, ClockifySchemaVersion } from "./clockify-manifest";
import { ClockifyWebhook, ClockifyLifecycleEvent, ClockifyComponent } from "./clockify-models";

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
  constructor(manifest: M, manifestPath?: string) {
    super(manifest, manifestPath);
  }

  registerWebhook(webhook: ClockifyWebhook<M["schemaVersion"]>, handler: RequestHandler): void {
    this.registerHandler(webhook.path, Addon.HTTP_POST, handler);
    const m = this.manifest as any;
    if (!m.webhooks) {
      m.webhooks = [];
    }
    m.webhooks.push(webhook);
  }

  registerLifecycleEvent(
    event: ClockifyLifecycleEvent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    this.registerHandler(event.path, Addon.HTTP_POST, handler);
    const m = this.manifest as any;
    if (!m.lifecycle) {
      m.lifecycle = [];
    }
    m.lifecycle.push(event);
  }

  registerComponent(
    component: ClockifyComponent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    this.registerHandler(component.path, Addon.HTTP_GET, handler);
    const m = this.manifest as any;
    if (!m.components) {
      m.components = [];
    }
    m.components.push(component);
  }

  registerCustomSettings(path: string, handler: RequestHandler): void {
    this.registerHandler(path, Addon.HTTP_GET, handler);
    const m = this.manifest as any;
    m.settings = path;
  }
}
