# @apet97/clockify-addon-sdk

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification.

> Independent, unofficial project. Not affiliated with, endorsed by, or supported by Clockify or
> CAKE.com. "Clockify" is referenced only to describe what this library is compatible with.

It builds and serves an add-on manifest and routes the requests Clockify sends to it — components,
lifecycle events, and webhooks — and verifies the signature on each webhook. It is not a client for
the Clockify REST API.

## Install

This SDK is source-only for now and is not published to the npm registry. Use the repository as the
source of truth until a release is intentionally published.

Supported source workflows:

```bash
# Clone the source repository.
git clone https://github.com/apet97/addon-ts-sdk.git
cd addon-ts-sdk
npm ci

# Verify and inspect the package contents without leaving a tarball.
npm run ci:verify
npm pack --dry-run -w @apet97/clockify-addon-sdk

# When another local project needs the package, create and install a tarball intentionally.
cd addon-sdk
npm pack
npm install /absolute/path/to/apet97-clockify-addon-sdk-1.0.0.tgz
```

Do not use the repo-root Git URL as an npm package dependency: npm installs the private workspace
root rather than this SDK package. Pack a tarball from `addon-sdk/` when another project needs to
consume it.

Node 22+. Ships ESM and CommonJS builds with type declarations.

## Quick start

```typescript
import {
  ClockifyAddon,
  ClockifyManifest,
  ClockifyComponent,
  createClockifySignatureParser,
  isClockifyAdminRole,
  verifyClockifyComponentRequest,
} from "@apet97/clockify-addon-sdk";
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters";

// 1. Build the manifest using the versioned builder
const manifest = ClockifyManifest.v1_4Builder()
  .key("my-clockify-addon")
  .name("My Add-on")
  .baseUrl("https://example.com/addon")
  .requireBasicPlan()
  .build();

// 2. Initialize the addon
const addon = new ClockifyAddon(manifest);
const parser = createClockifySignatureParser("my-clockify-addon");

// 3. Register a component and verify Clockify's signed auth_token on every request
addon.registerComponent(
  ClockifyComponent.v1_4Builder()
    .activityTab()
    .allowAdmins()
    .path("/component")
    .label("Activity Tab")
    .build(),
  async (request) => {
    const verification = await verifyClockifyComponentRequest(parser, request);
    if (!verification.ok) {
      return { status: 401, body: "Unauthorized" };
    }
    if (!isClockifyAdminRole(verification.claims.workspaceRole)) {
      return { status: 403, body: "Admins only" };
    }

    return {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html><body>Hello Clockify!</body></html>",
    };
  },
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
- **Clockify token helpers** — built-in platform public key, parser factory, RS256 JWT
  verification, component `auth_token` and lifecycle-header helpers, admin-role checks, and
  environment URL normalization.
- **Verified handler wrappers** that compose the token helpers into small route handlers returning
  `401 Unauthorized` for failed component, lifecycle, installed lifecycle, and webhook checks.
- **Lifecycle payload guards** that validate documented lifecycle bodies and narrow verified claims
  before persisting installation or webhook-token data.
- **Structured setting helpers** for common setting types, keeping value types paired with
  `TXT`, `NUMBER`, `CHECKBOX`, `LINK`, dropdown, and user dropdown settings.
- **Adapters** for Node `http`, Express, and the Fetch API (Hono, Cloudflare Workers, Bun, Deno).

## Testing helpers

The `@apet97/clockify-addon-sdk/testing` subpath exports `generateTestKeys()` and `signTestToken()`
for signing RS256 add-on JWTs in your own tests, so you can exercise the verification helpers without
a live Clockify environment:

```typescript
import { ClockifySignatureParser } from "@apet97/clockify-addon-sdk";
import { generateTestKeys, signTestToken } from "@apet97/clockify-addon-sdk/testing";

const { privateKey, publicKey } = await generateTestKeys();
const token = await signTestToken(privateKey, "my-addon-key", { workspaceId: "w-1" });

const claims = await new ClockifySignatureParser("my-addon-key", publicKey).parseClaims(token);
```

## Schema versions

1.2–1.4 are ported from the Clockify add-on Java SDK; 1.5 is taken from the live schema endpoint
(`GET https://api.clockify.me/api/addons/manifest-schema?version=1.5`). The copies vendored under
`schemas/clockify-manifests/` are structurally identical to those sources, and the generated builders
are reproducible from them. Run `npm run verify:schema-live` manually when you want to compare the
vendored schemas against Clockify's live endpoint.

## Documentation

- [Java Migration Guide](./docs/java-migration.md)
- [API Reference](./docs/api-reference.md)
- [Manifest Builders](./docs/manifest-builders.md)
- [Routing and Middleware](./docs/routing.md)
- [Token Signature Validation](./docs/token-validation.md)
- [Dependency Strategy](./docs/dependency-strategy.md)
