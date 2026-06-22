# API Reference

This page maps the public entry points exported by `@apet97/clockify-addon-sdk`. The package is a
server runtime SDK for Clockify add-ons; it does not include a Clockify REST client, token exchange
client, persistence layer, UI event framework, or custom manifest validator.

## Entry Points

| Import path                           | Purpose                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `@apet97/clockify-addon-sdk`          | Root surface: shared request/response types, Clockify helpers, adapters |
| `@apet97/clockify-addon-sdk/clockify` | Clockify-only builders, models, lifecycle types, and verification       |
| `@apet97/clockify-addon-sdk/adapters` | Node `http`, Express-like, Fetch, and body-limit adapter helpers        |
| `@apet97/clockify-addon-sdk/testing`  | RS256 test-key and token-signing helpers                                |

## Core Runtime

- `ClockifyAddon` registers manifest, component, lifecycle, webhook, and custom settings routes.
- `AddonRequest`, `AddonResponse`, `RequestHandler`, and `AddonMiddleware` define the framework-free
  request/response contract used by all adapters.
- `ValidationException` and `IllegalArgumentException` mirror the Java SDK's registration errors.
- `AddonErrorReporter` and `AddonOptions` let host apps observe handled router/adapter errors without
  changing the SDK's quiet default response policy.

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
- `CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM` and `CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256` expose the non-secret
  platform key and pinned fingerprint.
- `verifyClockifyWebhookRequest()`, `verifyClockifyComponentRequest()`,
  `verifyClockifyLifecycleRequest()`, and `verifyClockifyToken()` return typed result objects instead
  of throwing for normal authentication failures.
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
