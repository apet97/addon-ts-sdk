# Token Signature Verification

All tokens signed by Clockify are JWT tokens signed with the **RS256** algorithm. The signature
parser validates the token cryptographically, pins the accepted algorithm to `RS256`, and checks for
required claims.

## Example

```typescript
import {
  createClockifySignatureParser,
  getClockifyEnvironmentContext,
  verifyClockifyWebhookRequest,
} from "@apet97/clockify-addon-sdk";

const parser = createClockifySignatureParser("my-addon-key");

// In your webhook route handler:
const result = await verifyClockifyWebhookRequest(parser, request, {
  expectedEventType: "NEW_TIME_ENTRY",
  expectedWorkspaceId: "workspace-id-from-your-route-or-storage",
  expectedAddonId: "addon-id-from-installation",
  expectedWebhookAuthToken: "stored-token-for-this-webhook",
});

if (!result.ok) {
  return { status: 401, body: "Unauthorized" };
}

const env = getClockifyEnvironmentContext(result.claims);
console.log("Clockify API URL:", env.backendUrl);
```

## Validation Constraints

The signature parser checks that:

1. JWT `alg` is exactly `RS256`.
2. Issuer is exactly `clockify`.
3. Subject matches the manifest `key` / `addonKey`.
4. Type claim is exactly `addon`.
5. Token has not expired.

The parser verifies tokens only. It does not exchange installation tokens, call Clockify APIs, or
store secrets; add-on backends should keep installation tokens server-side and send API requests
with the `X-Addon-Token` header described in the Marketplace docs.

`createClockifySignatureParser(addonKey)` uses Clockify's published platform public key by default.
Pass `{ publicKey }` only when targeting a non-production Clockify environment with a different
signing key. The SDK also exports `CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM` and
`CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256` (the SHA-256 of the key's DER/SPKI encoding) for applications
that need to pin or inspect the key directly.

## Documented Token Locations

The SDK exports constants for the Marketplace wire names so routes do not hardcode subtly different
header spellings:

| Purpose                          | SDK constant                         | Wire name                     |
| -------------------------------- | ------------------------------------ | ----------------------------- |
| Webhook signature JWT            | `ClockifyHeaders.SIGNATURE`          | `clockify-signature`          |
| Webhook event type               | `ClockifyHeaders.WEBHOOK_EVENT_TYPE` | `clockify-webhook-event-type` |
| Lifecycle signature JWT          | `ClockifyHeaders.LIFECYCLE_TOKEN`    | `x-addon-lifecycle-token`     |
| Clockify API token               | `ClockifyHeaders.ADDON_TOKEN`        | `x-addon-token`               |
| Component user token query param | `ClockifyQueryParams.AUTH_TOKEN`     | `auth_token`                  |

Use `getClockifyHeader(headers, name)` for case-insensitive request header lookup and
`getClockifyQueryParam(query, name)` for component query tokens.

## Webhook and Lifecycle Requests

`verifyClockifyWebhookRequest()` validates the JWT and asserts the Marketplace invariants that are
easy to miss:

- webhook event header matches the expected event
- token `workspaceId` matches the request/installation context
- token `addonId` matches the stored add-on installation
- required stored webhook `authToken` matches the `clockify-signature` header

Use `verifyClockifyWebhookRequest()` for webhook routes because it requires `expectedEventType`.
The raw verifier also requires a fixed, nonblank `expectedWebhookAuthToken`; it rejects valid signed
tokens that do not contain nonblank `workspaceId` and `addonId` installation claims.
`verifyClockifyRequest()` remains available as a lower-level helper for advanced cases that need a
custom policy.
Plain JavaScript callers that omit `expectedEventType` or the fixed stored webhook token receive a
typed failure result rather than an accidentally permissive verification result.

Lifecycle and component routes are served by `verifyClockifyLifecycleRequest()` and
`verifyClockifyComponentRequest()`, which read the `x-addon-lifecycle-token` header and the
`auth_token` query parameter automatically (shown below). They reject duplicate lifecycle-token
headers or duplicate `auth_token` query parameters instead of accepting an arbitrary first value.

The helper returns a typed result instead of throwing, so applications can keep their own logging and
response policy. `withClockifyVerifiedRequest()` is a small convenience wrapper that returns `401`
for any failed verification.

For common route shapes, use the narrower wrappers:

- `withClockifyVerifiedComponentRequest()` reads `auth_token`, verifies the token, and passes the
  verified claims to the handler.
- `withClockifyVerifiedLifecycleRequest()` reads `X-Addon-Lifecycle-Token`, verifies the token, and
  passes the verified claims to the handler.
- `withClockifyInstalledLifecycleRequest()` also requires the installed lifecycle body shape and
  matches the payload `workspaceId`/`addonId` to the verified claims before the handler runs.
- `withClockifyVerifiedWebhookRequest()` requires `expectedEventType`; it can also call
  `getExpectedWebhookAuthToken({ workspaceId, addonId, eventType })` after the first JWT pass and
  installation-context check, then verify the resolved stored token before invoking the handler.
  Configure exactly one token source for every route: either a fixed `expectedWebhookAuthToken` or
  the lookup callback, never neither or both.

For component and lifecycle routes, use the narrower helpers when you only need to verify the
signed add-on JWT:

```typescript
import {
  clockifyLifecyclePayloadMatchesClaims,
  createClockifySignatureParser,
  isClockifyInstalledLifecyclePayload,
  isClockifyAdminRole,
  resolveClockifyApiBaseUrl,
  resolveClockifyReportsBaseUrl,
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
} from "@apet97/clockify-addon-sdk";

const parser = createClockifySignatureParser("my-addon-key");

const componentResult = await verifyClockifyComponentRequest(parser, request);
if (!componentResult.ok) {
  return { status: 401, body: "Unauthorized" };
}

if (!isClockifyAdminRole(componentResult.claims.workspaceRole)) {
  return { status: 403, body: "Admins only" };
}

const apiBase = resolveClockifyApiBaseUrl({ backendUrl: componentResult.claims.backendUrl });
const reportsBase = resolveClockifyReportsBaseUrl({
  reportsUrl: componentResult.claims.reportsUrl,
});

// verifyClockifyComponentRequest reads the "auth_token" query parameter.
// Capture hosts from verified claims, but keep installation authToken values server-side.

const lifecycleResult = await verifyClockifyLifecycleRequest(parser, request);
if (!lifecycleResult.ok) {
  return { status: 401, body: "Unauthorized" };
}

if (
  !isClockifyInstalledLifecyclePayload(request.body) ||
  !clockifyLifecyclePayloadMatchesClaims(request.body, lifecycleResult.claims)
) {
  return { status: 401, body: "Unauthorized" };
}
```

These request helpers expect an `AddonRequest` whose `query` is a `URLSearchParams` — the shape the
SDK's Node, Express, and Fetch adapters produce. If you already hold the raw token string (for
example, an Express route reading `req.query.auth_token` or `req.headers['x-addon-lifecycle-token']`
itself), call `verifyClockifyToken(parser, token, options)` directly; it returns the same typed
result without an `AddonRequest`.

Lifecycle body helpers are intentionally small runtime guards. They verify the documented payload
shape and let you bind a lifecycle body to already verified `workspaceId` and `addonId` claims before
persisting installation data or webhook `authToken` values. After
`clockifyLifecyclePayloadMatchesClaims()` returns true, TypeScript treats the claims as carrying
required `workspaceId` and `addonId` strings.

## Environments and Regions

Clockify can issue tokens for different environments and regions. Do not hardcode API, reports,
locations, or screenshots hosts. Read those URLs from the verified token claims, or use
`getClockifyEnvironmentContext(claims)` to collect them in one object. Missing claims stay
`undefined`; the SDK does not provide fallback production URLs.

Use `resolveClockifyApiBaseUrl({ apiUrl, backendUrl })` when you have the installed lifecycle
payload available: a nonblank `apiUrl` wins over `backendUrl`, trailing path slashes are trimmed,
and `/v1` is appended only when missing. The resolvers accept absolute HTTPS URLs, plus HTTP only
for URL-parser-canonical `localhost`, `127.0.0.1`, and `[::1]` loopback hosts. They return
`undefined` for malformed or relative values, credentials, query strings, fragments, unsupported
schemes, and non-loopback HTTP; an invalid preferred `apiUrl` does not fall back to `backendUrl`.
Use `resolveClockifyReportsBaseUrl({ reportsUrl })` for the reports claim; do not derive reports
hosts from the API host.

These helpers produce the versioned `/v1` REST base only. Backend paths that do not live under `/v1`
(for example, the add-on user-token endpoints under `{backendUrl}/addon/...`) should be built from
the raw `backendUrl`/`apiUrl` claim instead. `getClockifyEnvironmentContext()` also surfaces the
`ptoUrl` claim alongside the hosts listed above when Clockify includes it.
