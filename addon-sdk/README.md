# clockify-addon-sdk-ts-115

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RSA signature verification for incoming webhooks.

> Independent, unofficial project. Not affiliated with, endorsed by, or supported by Clockify or
> CAKE.com. "Clockify" is referenced only to describe what this library is compatible with.

It builds and serves an add-on manifest and routes the requests Clockify sends to it — components,
lifecycle events, and webhooks — and verifies the signature on each webhook. It is not a client for
the Clockify REST API.

## Install

```bash
npm install clockify-addon-sdk-ts-115
```

Node 18+. Ships ESM and CommonJS builds with type declarations.

## Quick start

```typescript
import {
  ClockifyAddon,
  ClockifyManifest,
  ClockifyComponent,
  ClockifyScope,
} from "clockify-addon-sdk-ts-115";
import { createNodeHttpAddonServer } from "clockify-addon-sdk-ts-115/adapters";

// 1. Build the manifest using the versioned builder
const manifest = ClockifyManifest.v1_4Builder()
  .key("my-clockify-addon")
  .name("My Add-on")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .scopes([ClockifyScope.PROJECT_READ, ClockifyScope.PROJECT_WRITE])
  .build();

// 2. Initialize the addon
const addon = new ClockifyAddon(manifest);

// 3. Register a component
addon.registerComponent(
  ClockifyComponent.v1_4Builder()
    .activityTab()
    .allowAdmins()
    .path("/component")
    .label("Activity Tab")
    .build(),
  async (request) => {
    return {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html><body>Hello Clockify!</body></html>",
    };
  }
);

// 4. Start the server
const server = createNodeHttpAddonServer(addon);
server.listen(8080, () => {
  console.log("Addon server running on port 8080");
});
```

## What it does

- **Manifest builders** for schema versions 1.2–1.5. Required fields are enforced at the type
  level: the chain will not expose `.build()` until every required step is set.
- **Router** that serves `/manifest`, trims a trailing slash before matching, returns 405 for an
  unmatched route, and 500 when a handler throws.
- **`ClockifySignatureParser`** — verifies the RS256 `Clockify-Signature` JWT (issuer, subject,
  type, signature, expiry).
- **Adapters** for Node `http`, Express, and the Fetch API (Hono, Cloudflare Workers, Bun, Deno).

## Schema versions

1.2–1.4 are ported from the Clockify add-on Java SDK; 1.5 is taken from the live schema endpoint
(`GET https://api.clockify.me/api/addons/manifest-schema?version=1.5`). The copies vendored under
`schemas/clockify-manifests/` are byte-identical to those sources, and the generated builders are
reproducible from them.

## Documentation

- [Java Migration Guide](./docs/java-migration.md)
- [Manifest Builders](./docs/manifest-builders.md)
- [Routing and Middleware](./docs/routing.md)
- [Token Signature Validation](./docs/token-validation.md)
