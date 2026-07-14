# Components and UI

## Mental model

A component crosses two security boundaries. The server must verify the Clockify-signed user context
before returning content, and the browser must restrict framing and messaging to the exact Clockify
parent. Passing one boundary does not weaken the other.

The component `auth_token` is transient request input. It is not the installation credential used
for webhooks or outbound API calls.

## What Clockify sends

Clockify loads the registered component path in an iframe and adds `auth_token` to the query URL.
After verification, handlers can receive claims such as `workspaceId`, `addonId`, `user`,
`workspaceRole`, `language`, `theme`, `backendUrl`, and other environment URLs when Clockify includes
them.

Clockify also sends browser messages from the embedding parent window. Those messages are separate
from the HTTP component request and must pass both origin and source checks.

## What the SDK does

`withClockifyVerifiedComponentRequest()` reads the single `auth_token` query value, verifies its
RS256 signature, issuer, subject, type, and required expiration, and passes the verified claims to
the handler. Missing, duplicate, expired, invalid, or context-mismatched tokens produce
`401 Unauthorized` before the handler runs.

`createClockifyHtmlResponse()` adds a no-store HTML content type, a restrictive CSP, referrer and
MIME protections, and the configured `frame-ancestors`. `createClockifyBridge()` accepts only an
exact HTTPS parent origin outside canonical loopback development, checks both `event.origin` and
`event.source`, and targets that same origin for outbound messages.

`applyClockifyTheme()` and `applyClockifyLanguage()` normalize verified theme and language values for
a document root. They do not verify a token themselves.

## What your application must do

Set `CLOCKIFY_PARENT_ORIGIN` to the exact origin that actually embeds the component, such as the
developer-workspace origin during development and the production app origin in production. Never
use `*`, add a path, or widen the CSP to make an iframe error disappear.

Use only verified claims for authorization or personalization. If the browser needs theme,
language, or non-secret identity context, pass a minimal escaped or serialized projection; do not
re-emit the token. The query `auth_token` must not enter logs, persistence, HTML, links, redirects,
analytics, or browser storage.

Installation tokens, webhook tokens, and outbound credentials remain server-side. A component
request does not replace the installation-storage flow.

## Smallest correct path

The generated component handler fails closed when parent-origin wiring is absent:

```typescript
import {
  createClockifyHtmlResponse,
  withClockifyVerifiedComponentRequest,
} from "@apet97/clockify-addon-sdk";

addon.registerComponent(
  component,
  withClockifyVerifiedComponentRequest(parser, async () => {
    const parentOrigin = environment.CLOCKIFY_PARENT_ORIGIN;
    if (!parentOrigin) {
      return { status: 503, body: "CLOCKIFY_PARENT_ORIGIN is not configured." };
    }
    return createClockifyHtmlResponse(
      "<!doctype html><html><body><main>Clockify add-on ready.</main></body></html>",
      { frameAncestors: [parentOrigin] },
    );
  }),
);
```

Create the browser bridge with that same exact parent origin, subscribe only to messages your UI
understands, and call `dispose()` when the component is torn down. Apply theme and language from the
verified, non-secret context supplied by your server.

## Failure behavior

- `401 Unauthorized` means component verification failed; the handler did not run. Check the
  missing/duplicate `auth_token`, expiration, manifest key, and any expected workspace/add-on
  context.
- `503 Service Unavailable` in the generated route means verification succeeded but
  `CLOCKIFY_PARENT_ORIGIN` was not configured. It is a setup failure, not an authentication result.
- A syntactically invalid, path-bearing, wildcard, or insecure non-loopback parent origin is
  rejected by the security helper. If that happens inside a route, the router contains the throw as
  `500`; validate configuration at startup where possible.
- If the configured origin is valid but does not match the actual Clockify parent, the CSP or bridge
  rejects the iframe interaction. Keep the origin exact instead of broadening it.

## Prove it

Run the verification, UI, and browser-response suites:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/request-verification.test.ts tests/ui.test.ts tests/perfect-foundations.test.ts
```

In a developer workspace, confirm that a valid component loads, a request without `auth_token`
returns `401`, missing parent-origin wiring returns `503` only after a valid token, messages from a
different origin/source are ignored, and no request URL or credential appears in logs.

## Reference

- [How an add-on works: routes and credentials](../how-an-addon-works.md#routes-and-credentials)
- [Token signature verification](../../addon-sdk/docs/token-validation.md)
- [Browser response security](../../addon-sdk/src/clockify/clockify-security.ts)
- [Component request wrapper](../../addon-sdk/src/clockify/clockify-request-handlers.ts)
- [UI bridge and preference helpers](../../addon-sdk/src/ui/index.ts)
