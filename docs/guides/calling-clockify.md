# Calling Clockify

## Mental model

Inbound verification and outbound authorization are different operations. Verify Clockify's
incoming lifecycle request, persist its installation credential and verified environment context,
then create an outbound client only on the server. Never turn the component query `auth_token` into
an installation credential.

`ClockifyAddonClient` owns the Marketplace-specific add-on endpoints and authenticated generic
transport. It is not the entity model for all Clockify REST resources.

## What Clockify sends

The verified `INSTALLED` payload supplies the installation `authToken`. Verified signed claims can
supply `backendUrl` for the installation's environment or region. Later component JWTs may also
carry service URLs, but their query token remains transient and must not be persisted or reused as
the outbound credential.

Clockify returns a user-scoped token from the add-on token-exchange endpoint and structured data
from the settings endpoints. Other REST responses depend on the path requested by the application.

## What the SDK does

`ClockifyAddonClient` accepts a nonblank token and a `backendUrl`, uses `X-Addon-Token` on every
request, and exposes:

- `exchangeUserToken(userId)` for Marketplace add-on user-token exchange.
- `getSettings(workspaceId)` and `updateSettings(workspaceId, updates)` for structured settings.
- `request(pathSegments, init)` for authenticated generic transport.

Every caller-supplied segment is encoded separately, so a workspace, user, or entity ID containing
`/`, `?`, `#`, or dot-like text cannot escape its segment. Empty, `.` and `..` segments are rejected
before a request is sent.

## What your application must do

Load the decrypted installation token only inside the server request or job that needs it. Pair it
with a `backendUrl` captured from verified claims for the same installation; do not hardcode a
production Clockify host. `ClockifyInstallationContext` stores the payload `apiUrl`, so an
application using the raw Marketplace `backendUrl` should retain that verified claim in its own
installation record alongside the SDK context.

Set an abort policy and a bounded timeout appropriate for the job. Treat outbound credential and
URL selection as installation-scoped data: do not mix the token from one workspace/add-on record
with a URL from another.

Use the separate `clockify-ts-sdk` for entity-specific Clockify resources, typed project/time-entry
operations, CLI behavior, or MCP behavior. Keep `ClockifyAddonClient` at the add-on token exchange,
settings, and generic authenticated transport boundary.

## Smallest correct path

After loading one application-owned installation record, construct `new ClockifyAddonClient({
token: storedInstallation.authToken, backendUrl: storedInstallation.backendUrl })` on the server.
Then choose only the operation you need:

1. Call `exchangeUserToken(userId)` when Clockify requires a user-scoped add-on token.
2. Call `getSettings(workspaceId)` or `updateSettings(workspaceId, updates)` for add-on settings.
3. Call `request(["workspaces", workspaceId, "resource", resourceId], init)` only when the generic
   transport is the intended boundary; pass unencoded segments and let the client encode each one.

Do not serialize the client, token, or response request metadata into component state.

## Failure behavior

- Construction rejects a blank token, credential-bearing `backendUrl`, insecure non-loopback HTTP,
  noncanonical loopback spellings, invalid timeout bounds, and invalid attempt counts.
- A non-success HTTP response becomes `ClockifyAddonHttpError` with its status and response body.
- Safe `GET` and `HEAD` reads may retry network errors, timeouts, HTTP 5xx, and confirmed `429`
  responses up to `maxAttempts`.
- A mutation is replayed only after a confirmed `429`. Network errors, timeouts, and 5xx responses
  are ambiguous and are not retried for mutation methods.
- A caller abort is terminal. Discarded retry response bodies are cancelled before backoff, and
  cancellation cleanup failures do not replace the intended retry.
- Pass `onRetry` to observe a retry for metrics or logging: it receives `{attempt, delayMs}` plus
  either `status` (a status-based retry) or `error` (a network-error retry). It never affects retry
  behavior, even if it throws.
- An invalid generic path segment fails before fetch; accepted dynamic segments remain within one
  encoded path segment.

## Pagination and rate limits

`request(pathSegments, init)` reaches any Clockify REST resource behind the verified
`backendUrl`, including paginated ones. This SDK does not model pagination — it stays at the
transport boundary. When calling a paginated resource:

- Follow Clockify's own `page`/`page-size` query parameters for that resource; check the entity's
  API reference, since page-size limits and defaults are resource-specific and subject to change.
- Keep fetching pages until a page returns fewer than `page-size` results.
- `ClockifyAddonClient` already retries a confirmed `429` per [Failure behavior](#failure-behavior)
  above; a pagination loop does not need its own retry logic on top of that.
- Prefer the separate `clockify-ts-sdk` for typed, paginated entity operations (time entries,
  projects, reports) — it is the entity model this client intentionally is not.

## Prove it

Run the complete client contract suite:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/addon-client.test.ts
```

In an integration environment, capture only redacted request metadata and prove that the request
uses the verified installation's origin, contains `X-Addon-Token`, does not use `Authorization`,
encodes hostile-looking IDs as one segment, retries a read, and does not replay a mutation after an
ambiguous failure.

## Reference

- [How an add-on works: routes and credentials](../how-an-addon-works.md#routes-and-credentials)
- [`ClockifyAddonClient` API](../../addon-sdk/src/client/index.ts)
- [Token and environment validation](../../addon-sdk/docs/token-validation.md)
- [Secure server recipe](../../addon-sdk/docs/secure-server-recipe.md)
- [Marketplace coverage boundary](../maintainers/marketplace-coverage.md)
