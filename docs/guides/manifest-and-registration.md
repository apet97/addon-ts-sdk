# Manifest and Registration

## Mental model

The manifest is Clockify's contract with the running add-on. A component, lifecycle event, or
webhook is usable only when the same descriptor appears in the manifest and an executable handler
is bound to its exact path and method. Prefer register-only descriptors: build the base manifest,
then let `registerComponent`, `registerLifecycleEvent`, and `registerWebhook` add each descriptor as
they bind its route.

## What Clockify sends

Clockify first requests `GET /manifest` from the public base URL submitted in the developer
workspace. It then calls the component, lifecycle, and webhook paths declared in that response.
Those requests use the method owned by the descriptor: components are `GET`; lifecycle events and
webhooks are `POST`.

## What the SDK does

`ClockifyManifest.v1_5Builder()` and the matching `v1_5Builder()` descriptor factories produce
schema 1.5 objects. `createValidatedClockifyAddon()` validates the base manifest against the
embedded draft-04 schema and automatically registers `GET /manifest`.

Registration is atomic with respect to the manifest and router:

- A descriptor absent from the manifest is appended only after its route binds successfully.
- An identical predeclared descriptor binds its handler without adding a duplicate.
- A different descriptor already using the same path is rejected before either the route or the
  manifest is mutated.

The router matches concrete paths, not prefixes or parameter patterns. It trims one trailing slash
from an incoming request, but `/hooks/item` does not match a handler registered at `/hooks`.

## What your application must do

Resolve an explicit production origin from `PUBLIC_BASE_URL`, use the same schema version for the
manifest and every descriptor, and register every handler before serving traffic. Registered paths
must begin with `/` and must not end with `/`. Do not maintain a second hand-written list of
descriptors unless you are deliberately binding handlers to identical predeclared entries.

Treat a manifest change as an API change: inspect the served JSON, validate it, and confirm that the
public deployment exposes every declared route.

## Smallest correct path

This is the registration shape emitted by the creator, reduced to one component:

```typescript
import {
  ClockifyComponent,
  ClockifyManifest,
  createValidatedClockifyAddon,
  resolveClockifyPublicOrigin,
} from "@apet97/clockify-addon-sdk";

export function createAddon(environment: {
  readonly PUBLIC_BASE_URL?: string;
}) {
  const origin = resolveClockifyPublicOrigin({
    publicBaseUrl: environment.PUBLIC_BASE_URL,
  });
  const component = ClockifyComponent.v1_5Builder()
    .sidebar()
    .allowEveryone()
    .path("/component")
    .label("Clockify Add-on")
    .build();
  const manifest = ClockifyManifest.v1_5Builder()
    .key("replace-with-your-unique-addon-key")
    .name("Clockify Add-on")
    .baseUrl(origin)
    .requireBasicPlan()
    .build();
  const addon = createValidatedClockifyAddon(manifest);

  addon.registerComponent(component, async () => ({ status: 204 }));
  return addon;
}
```

## Failure behavior

- Missing or invalid `PUBLIC_BASE_URL` fails configuration instead of inventing a production
  origin.
- A schema-invalid base manifest makes `createValidatedClockifyAddon()` throw before the runtime is
  created.
- Invalid paths and duplicate method/path registrations throw during setup.
- Conflicting predeclared descriptors throw without leaving a partial route or manifest entry.
- An unknown path returns `404`; a known path with the wrong method returns `405` and an `Allow`
  header.

## Prove it

With the application running, inspect the actual contract:

```bash
curl --fail-with-body "${PUBLIC_BASE_URL}/manifest"
```

In this repository, the focused registration proof is:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/clockify.test.ts tests/router.test.ts tests/perfect-foundations.test.ts
```

For a generated project, run `npm run typecheck` and then exercise `/manifest` through the public
origin, not only through localhost.

## Reference

- [Getting started](../getting-started.md)
- [How an add-on works](../how-an-addon-works.md)
- [Manifest builders](../../addon-sdk/docs/manifest-builders.md)
- [Routing and middleware](../../addon-sdk/docs/routing.md)
- [`ClockifyAddon` registration source](../../addon-sdk/src/clockify/clockify-addon.ts)
- [Runtime manifest validation](../../addon-sdk/src/clockify/clockify-manifest-validation.ts)
