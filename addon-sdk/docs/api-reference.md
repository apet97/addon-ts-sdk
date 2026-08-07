# API Reference

This page maps the public entry points exported by `@apet97/clockify-addon-sdk`. The package is a
layered SDK for Clockify add-ons. It includes Marketplace token/settings transport, storage
contracts, secure UI messaging, and runtime manifest validation without duplicating the separate
Clockify entity REST SDK.

The SDK is published on npm and installs with `npm install @apet97/clockify-addon-sdk`. This page
highlights the stable boundaries and commonly used symbols; the generated
[public API snapshot](../public-api.snapshot.md) is the exhaustive declaration record.

## Entry Points

| Import path                                   | Purpose                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `@apet97/clockify-addon-sdk`                  | Runtime-neutral shared routing, Clockify, client, and `testing` namespace |
| `@apet97/clockify-addon-sdk/clockify`         | Clockify-only builders, models, lifecycle types, and verification         |
| `@apet97/clockify-addon-sdk/adapters`         | Legacy Node-oriented aggregate of all adapters and body-limit helpers     |
| `@apet97/clockify-addon-sdk/adapters/node`    | Node `http` adapter only                                                  |
| `@apet97/clockify-addon-sdk/adapters/express` | Structurally typed Express adapter                                        |
| `@apet97/clockify-addon-sdk/adapters/fetch`   | Fetch/Worker adapter only                                                 |
| `@apet97/clockify-addon-sdk/client`           | Add-on token exchange, settings, and authenticated transport              |
| `@apet97/clockify-addon-sdk/ui`               | Exact-origin browser bridge and preference helpers                        |
| `@apet97/clockify-addon-sdk/testing`          | RS256 test-key and token-signing helpers                                  |

## Core Runtime

- `ClockifyAddon` registers manifest, component, lifecycle, webhook, and custom settings routes.
- `AddonRequest`, `AddonResponse`, `RequestHandler`, and `AddonMiddleware` define the framework-free
  request/response contract used by all adapters.
- `ValidationException` and `IllegalArgumentException` mirror the Java SDK's registration errors.
- `AddonErrorReporter` and `AddonOptions` let host apps observe handled router/adapter errors without
  changing the SDK's quiet default response policy.
- Return a plain object or array from a handler's `body` to get an `application/json` response.
  `isJsonBody` recognizes only `{}`-prototype objects and arrays; a class instance — `Map`, `Set`,
  `Date`, `RegExp`, or your own class — is not JSON-serialized, since `JSON.stringify` silently
  discards a `Map`'s or `Set`'s entries instead of erroring. Convert to a plain object first, e.g.
  `Object.fromEntries(myMap)`.

## Manifest Builders and Models

- `ClockifyManifest`, `ClockifyComponent`, `ClockifyWebhook`, `ClockifyLifecycleEvent`,
  `ClockifySetting`, `ClockifySettingsHeader`, `ClockifySettingsGroup`, `ClockifySettingsTab`, and
  `ClockifySettings` expose versioned builder factories such as `v1_5Builder()`.
- Root model aliases default to schema 1.4 for Java parity. Version-specific types and enums remain
  available under `generated.v1_2`, `generated.v1_3`, `generated.v1_4`, and `generated.v1_5`.
- `ClockifyScope` and `ClockifyMinimalSubscriptionPlan` are root convenience enum objects for the
  default schema version.

## Request Verification

- `createClockifySignatureParser(addonKey, options?)` creates a JWT parser using Clockify's published
  RS256 public key by default.
- `ClockifyCryptoKey`, `ClockifyPublicKeyInput`, and `ClockifyPrivateKeyInput` are the public key
  input aliases for parser overrides and testing helpers.
- `CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM` and `CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256` expose the non-secret
  platform key and pinned fingerprint.
- `verifyClockifyWebhookRequest()`, `verifyClockifyComponentRequest()`,
  `verifyClockifyLifecycleRequest()`, and `verifyClockifyToken()` return typed result objects instead
  of throwing for normal authentication failures. Raw webhook verification requires a fixed stored
  `expectedWebhookAuthToken` and nonblank signed `workspaceId` plus `addonId` context.
- `withClockifyVerifiedComponentRequest()`, `withClockifyVerifiedLifecycleRequest()`,
  `withClockifyInstalledLifecycleRequest()`, and `withClockifyVerifiedWebhookRequest()` wrap route
  handlers and return `401 Unauthorized` before application code runs when verification fails. The
  webhook wrapper requires exactly one token source: fixed `expectedWebhookAuthToken` or
  `getExpectedWebhookAuthToken`, never neither or both.
- `ClockifyHeaders`, `ClockifyQueryParams`, `getClockifyHeader()`, and `getClockifyQueryParam()`
  centralize Marketplace wire names.
- `getClockifyEnvironmentContext()`, `resolveClockifyApiBaseUrl()`, and
  `resolveClockifyReportsBaseUrl()` keep region/environment URL handling claim-driven.

## Lifecycle Helpers

- `ClockifyInstalledLifecyclePayload`, `ClockifyStatusChangedLifecyclePayload`,
  `ClockifySettingsUpdatedLifecyclePayload`, `ClockifyDeletedLifecyclePayload`, and
  `ClockifyLifecyclePayload` describe documented lifecycle bodies.
- `ClockifyLifecycleMatchedClaims` is the claim shape after a lifecycle body has been matched to a
  verified token's `workspaceId` and `addonId`.
- `isClockifyInstalledLifecyclePayload()`, `isClockifyStatusChangedLifecyclePayload()`,
  `isClockifySettingsUpdatedLifecyclePayload()`, and `isClockifyDeletedLifecyclePayload()` are narrow
  runtime guards for those body shapes.
- `clockifyLifecyclePayloadMatchesClaims(payload, claims)` verifies that a lifecycle body matches the
  already verified token `workspaceId` and `addonId`, and narrows `claims` for safe persistence.

## Structured Setting Helpers

- `createClockifyTextSetting()`, `createClockifyNumberSetting()`,
  `createClockifyCheckboxSetting()`, and `createClockifyLinkSetting()` create plain
  schema-compatible setting objects with matching value types.
- `createClockifyDropdownSingleSetting()` and `createClockifyDropdownMultipleSetting()` require
  `allowedValues` alongside the dropdown value.
- `createClockifyUserDropdownSingleSetting()` and `createClockifyUserDropdownMultipleSetting()`
  cover user dropdown values without adding a manifest validator or API client.

## Adapters

- `createNodeHttpAddonServer(addon, options?)` creates a Node `http` server and enforces
  `DEFAULT_MAX_BODY_BYTES` before dispatch.
- `handleFetchRequest(addon, request, options?)` adapts Fetch-compatible runtimes such as Hono,
  Cloudflare Workers, Bun, and Deno.
- `createExpressAddonHandler(addon)` accepts structurally typed Express-like `req`, `res`, and `next`
  objects; Express remains an optional peer dependency.
- `resolveMaxBodyBytes()`, `PayloadTooLargeError`, and `isPayloadTooLargeError()` support adapter
  configuration and error handling.

## Testing

- `generateTestKeys()` creates an RS256 key pair for tests.
- `signTestToken(privateKey, addonKey, claims?, expiresIn?)` signs add-on JWTs that exercise the same
  verification path as Clockify-signed requests.
- `createTestComponentRequest(token, overrides?)`, `createTestLifecycleRequest(token, payload, overrides?)`,
  and `createTestWebhookRequest(token, eventType, payload, overrides?)` build ready-to-verify
  `AddonRequest` values around a signed token, so a handler test does not hand-assemble headers and
  query params.
- `buildInstalledPayload(overrides?)` returns a documented `INSTALLED` lifecycle payload with every
  required field defaulted.

## Validation, Security, Storage, and Client

- `validateClockifyManifest()` and `assertClockifyManifest()` use the embedded draft-04 schema named
  by `schemaVersion`. Validation dispatches to generated static validators for 1.2-1.6; it does
  not compile AJV schemas or generate code at request time, so the same path runs under Workers.
- `buildClockifySecurityHeaders()`, `createClockifyHtmlResponse()`, and
  `createClockifyJsonResponse()` supply no-store browser response defaults.
- `resolveClockifyPublicOrigin()` requires configured HTTPS except for explicit localhost opt-in.
- `ClockifyInstallationStore`, `InMemoryClockifyInstallationStore`, and
  `wrapClockifyInstallationStoreWithEncryption()` cover encrypted credential persistence. Passing
  `installedAt` to `delete()` enables the generation guard; omitting it requests unconditional
  deletion. Clockify's documented `DELETED` payload does not itself provide that generation.
- `ClockifyIdempotencyLeaseStore` and `runClockifyIdempotentWebhook()` define owner-specific webhook
  processing.
- `ClockifyAddonClient` uses `X-Addon-Token`, encoded path segments, abort/timeout handling,
  safe-read retries, and mutation replay only after confirmed HTTP 429. Its public operations are
  `exchangeUserToken()`, `getSettings()`, `updateSettings()`, and generic `request()`.
- `/ui` exports `createClockifyBridge()`, preference application, and locale-aware date formatting.
