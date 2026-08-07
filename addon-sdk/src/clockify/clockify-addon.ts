import { Addon, AddonOptions } from "../shared/addon";
import { RequestHandler } from "../shared/handler";
import { IllegalArgumentException } from "../shared/errors";
import { ClockifyManifest, ClockifySchemaVersion } from "./clockify-manifest";
import { ClockifyWebhook, ClockifyLifecycleEvent, ClockifyComponent } from "./clockify-models";
import { assertClockifyManifest } from "./clockify-manifest-validation";

function descriptorsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => descriptorsEqual(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        descriptorsEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function registerManifestRoute<T extends { readonly path: string }>(
  addon: {
    registerHandler(path: string, method: string, handler: RequestHandler): void;
    getRegisteredRequests(): Array<{ path: string; method: string }>;
  },
  kind: string,
  entries: T[] | undefined,
  descriptor: T,
  method: string,
  handler: RequestHandler,
): T[] {
  const manifestEntries = entries ?? [];
  const existing = manifestEntries.find((entry) => entry.path === descriptor.path);
  if (existing && !descriptorsEqual(existing, descriptor)) {
    throw new IllegalArgumentException(
      `Conflicting ${kind} is already declared for path ${descriptor.path}.`,
    );
  }

  // An identical redeclaration (e.g. a module re-evaluated during hot reload)
  // is a no-op: the router already holds this exact path+method, and the
  // underlying registerHandler unconditionally rejects any second call at
  // the same path+method regardless of whether the descriptor matches.
  const methodUpper = method.toUpperCase();
  const alreadyRouted = addon
    .getRegisteredRequests()
    .some((entry) => entry.path === descriptor.path && entry.method === methodUpper);
  if (existing && alreadyRouted) return manifestEntries;

  addon.registerHandler(descriptor.path, method, handler);
  if (!existing) manifestEntries.push(descriptor);
  return manifestEntries;
}

/**
 * A Clockify add-on server.
 *
 * The manifest's schema version is INFERRED from the manifest object, so a manifest of any
 * supported version constructs without an explicit type parameter:
 *
 *   new ClockifyAddon(ClockifyManifest.v1_5Builder()....build())  // M inferred as the v1.5 manifest
 *
 * The `register*` methods are then typed against that same version.
 *
 * This constructor does NOT validate the manifest against the Clockify schema — the manifest
 * builders already enforce required fields at the type level, and a router built from a manifest
 * that a downstream tool intentionally serves unvalidated (a captured example, a hand-authored
 * fixture) must still start. Use {@link createValidatedClockifyAddon} instead when the manifest's
 * shape is not statically known (built at runtime from configuration, deserialized JSON) and you
 * want a schema violation to fail fast at startup rather than surface later as a rejected install.
 */
export class ClockifyAddon<
  M extends { readonly schemaVersion: ClockifySchemaVersion } = ClockifyManifest<"1.4">,
> extends Addon<M> {
  constructor(manifest: M, manifestPath?: string, options?: AddonOptions) {
    super(manifest, manifestPath, options);
  }

  registerWebhook(webhook: ClockifyWebhook<M["schemaVersion"]>, handler: RequestHandler): void {
    const m = this.manifest as unknown as { webhooks?: ClockifyWebhook<M["schemaVersion"]>[] };
    m.webhooks = registerManifestRoute(
      this,
      "webhook",
      m.webhooks,
      webhook,
      Addon.HTTP_POST,
      handler,
    );
  }

  registerLifecycleEvent(
    event: ClockifyLifecycleEvent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    const m = this.manifest as unknown as {
      lifecycle?: ClockifyLifecycleEvent<M["schemaVersion"]>[];
    };
    m.lifecycle = registerManifestRoute(
      this,
      "lifecycle event",
      m.lifecycle,
      event,
      Addon.HTTP_POST,
      handler,
    );
  }

  registerComponent(
    component: ClockifyComponent<M["schemaVersion"]>,
    handler: RequestHandler,
  ): void {
    const m = this.manifest as unknown as { components?: ClockifyComponent<M["schemaVersion"]>[] };
    m.components = registerManifestRoute(
      this,
      "component",
      m.components,
      component,
      Addon.HTTP_GET,
      handler,
    );
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
