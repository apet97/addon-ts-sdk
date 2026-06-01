# Token Signature Verification

All tokens signed by Clockify are JWT tokens signed with the **RS256** algorithm. The signature
parser validates the token cryptographically, pins the accepted algorithm to `RS256`, and checks for
required claims.

## Example

```typescript
import {
  ClockifyHeaders,
  ClockifySignatureParser,
  getClockifyEnvironmentContext,
  verifyClockifyRequest,
} from "@apet97/clockify-addon-sdk";

// Clockify public key in PEM format
const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAubktufFNO/op+E5WBWL6
...
-----END PUBLIC KEY-----`;

const parser = new ClockifySignatureParser("my-addon-key", publicKeyPem);

// In your webhook route handler:
const result = await verifyClockifyRequest(parser, request, {
  expectedEventType: "TIME_ENTRY_CREATED",
  expectedWorkspaceId: "workspace-id-from-your-route-or-storage",
  expectedAddonId: "addon-id-from-installation",
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

## Documented Token Locations

The SDK exports constants for the Marketplace wire names so routes do not hardcode subtly different
header spellings:

| Purpose | SDK constant | Wire name |
|---|---|---|
| Webhook signature JWT | `ClockifyHeaders.SIGNATURE` | `clockify-signature` |
| Webhook event type | `ClockifyHeaders.WEBHOOK_EVENT_TYPE` | `clockify-webhook-event-type` |
| Lifecycle signature JWT | `ClockifyHeaders.LIFECYCLE_TOKEN` | `x-addon-lifecycle-token` |
| Clockify API token | `ClockifyHeaders.ADDON_TOKEN` | `x-addon-token` |
| Component user token query param | `ClockifyQueryParams.AUTH_TOKEN` | `auth_token` |

Use `getClockifyHeader(headers, name)` for case-insensitive request header lookup.

## Webhook and Lifecycle Requests

`verifyClockifyRequest()` validates the JWT and can additionally assert the Marketplace invariants
that are easy to miss:

- webhook event header matches the expected event
- token `workspaceId` matches the request/installation context
- token `addonId` matches the stored add-on installation
- lifecycle routes use `signatureHeader: ClockifyHeaders.LIFECYCLE_TOKEN`

The helper returns a typed result instead of throwing, so applications can keep their own logging and
response policy. `withClockifyVerifiedRequest()` is a small convenience wrapper that returns `401`
for any failed verification.

## Environments and Regions

Clockify can issue tokens for different environments and regions. Do not hardcode API, reports,
locations, or screenshots hosts. Read those URLs from the verified token claims, or use
`getClockifyEnvironmentContext(claims)` to collect them in one object. Missing claims stay
`undefined`; the SDK does not provide fallback production URLs.
