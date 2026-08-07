# Architecture

This maintainer reference describes internal runtime and package boundaries. Builder flow belongs
in [How an add-on works](../how-an-addon-works.md).

## Request and host boundaries

```text
Clockify request
  -> Node / Fetch / Express adapter
  -> shared request normalization and body limits
  -> exact router
  -> Clockify verification wrapper
  -> application handler
  -> AddonResponse
```

Adapters normalize host input and serialize the final `AddonResponse`. Node and Fetch enforce SDK
body limits; Express leaves parsing and limits with the host. The exact router selects the route,
then Clockify wrappers verify signature, event, and installation context before application code.

Generated projects preserve a shared `createAddon` versus host bootstrap split. `src/addon.ts`
builds the manifest and registers routes; runtime-specific `src/index.ts` starts Node with
`createNodeHttpAddonServer` or exports Worker `fetch()` through `handleFetchRequest`.

## Package subpath boundary

`@apet97/clockify-addon-sdk` is layered so a runtime never imports code for another runtime.

- The root entrypoint aggregates shared routing contracts plus the `/clockify` and `/client`
  surfaces for consumers that prefer one import.
- `/clockify` exports Clockify add-on modules only: manifests, verification, security, lifecycle,
  and storage primitives.
- `/adapters/node`, `/adapters/express`, and `/adapters/fetch` isolate host integration. The legacy
  `/adapters` aggregate remains available for package consumers but is Node-oriented.
- `/client` exports the Fetch-based `ClockifyAddonClient` for Marketplace-specific token exchange,
  settings, and generic authenticated transport. Entity-specific Clockify REST APIs remain in the
  separate `clockify-ts-sdk` project.
- `/ui` is browser-only and fails closed unless the exact Clockify parent origin is supplied.
- `/testing` contains local RS256 keys and token signing only.

The root entrypoint must continue to bundle for browser/Worker targets without `node:*` imports.
Persistent implementations may adapt the store and lease interfaces, but distributed claims must be
atomic; an unguarded read-then-write is not a valid distributed adapter.

## Known bundle-size debt

`clockify-manifest-validation.ts` statically imports all five generated per-schema-version
validators (`manifest-validators.ts`, ~600 KB unminified in `dist/esm`) so `validateClockifyManifest`
and `assertClockifyManifest` stay fully synchronous — every consumer pays for validating versions
1.2–1.4 and 1.6 even when they only ever build a 1.5 manifest. `generated/manifest-schemas.ts` (~48 KB) is
also always reachable through the root barrel (`generated` namespace), though nothing in the
runtime validation path reads it.

A real fix needs one of: an async validation API (a breaking change, so a major version), or
splitting the generator's per-version output into separate subpath exports a consumer can import
selectively. Both are real design work, not a one-line trim, and were deliberately deferred rather
than rushed into a minor release. Do not "fix" this by hand-editing `generated/manifest-schemas.ts`
or `generated/index.ts` — change `scripts/generate-clockify-manifest.ts`, the schema, or the
validation API surface, then run `npm run generate` and the generated-drift verification.
