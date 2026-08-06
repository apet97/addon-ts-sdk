# Parity Checklist

This maintainer checklist records verified Java-parity requirements and intentional TypeScript
extensions. It is evidence for contributors, not an end-user feature guide.

This document tracks implementation status of Java parity requirements and modern TypeScript adaptations.

## Source Baseline

- [x] Official Java SDK source checked against `clockify/addon-java-sdk` main commit `1b3a60d17a12adf28ae37ede687558fd50e0a33c`
- [x] Local `addon-java-sdk-main/` snapshot matches the official Java SDK snapshot
- [x] Java schema resources 1.2, 1.3, and 1.4 are byte-identical to the TS vendored schemas
- [x] TS schema 1.5 matches the live Clockify manifest schema endpoint, ignoring only trailing whitespace

## Core Shared Engine

- [x] Auto-register GET `/manifest` in `Addon` constructor
- [x] Reject registered paths ending in slash or without leading slash (matches `ValidationUtils.isValidManifestPath`)
- [x] Return 404 Not Found for an unknown path
- [x] Return 405 Method Not Allowed with `Allow` when the exact path exists for another method
- [x] Internal Server Error (500) on exceptions inside handlers
- [x] Trim trailing slash on incoming requests during dispatch
- [x] Prevent duplicate route registration by throwing an error
- [x] Run filter/middleware chain before executing handler

## Clockify Layer

- [x] Webhook registration registers POST route and pushes to `manifest.webhooks`
- [x] Lifecycle event registration registers POST route and pushes to `manifest.lifecycle`
- [x] Component registration registers GET route and pushes to `manifest.components`
- [x] Custom settings route registration registers GET route and sets `manifest.settings` to path
- [x] Duplicate registration failure leaves manifest unmutated
- [x] JWT verification matches RSA signature parser (with claims issuer=clockify, type=addon, sub=addonKey)
- [x] JWT verification pins the accepted signing algorithm to RS256, matching Marketplace token guidance
- [x] Request helpers expose documented auth wire names (`clockify-signature`, `clockify-webhook-event-type`, `X-Addon-Lifecycle-Token`, `X-Addon-Token`, `auth_token`)
- [x] Webhook verification can reject missing/mismatched event headers and workspace/add-on claim mismatches
- [x] Lifecycle verification can use `X-Addon-Lifecycle-Token` with the same signature and claim checks
- [x] Environment/region URL handling is claim-driven, with no hardcoded fallback hosts

## TS Extensions / Adaptations

- [x] Support schema version 1.5 in addition to 1.2, 1.3, and 1.4
- [x] Type-safe step builders for required vs optional fields
- [x] Express middleware adapter
- [x] Fetch API request/response adapter (Hono/Cloudflare compatibility)
- [x] Node HTTP createServer adapter

## Documented Behavioral Divergences From Java

Each row: what Java does, what TS does, and why the TS behavior is deliberate rather than drift.

| Area | Java | TS | Why TS is deliberate |
|---|---|---|---|
| Unknown path | `Addon.java` returns 405 for any unregistered path | `shared/addon.ts` returns 404 when no method is registered for the path at all, 405 only when the path exists for a different method | 404 is the RFC 9110-correct response for a genuinely unknown resource; a port from Java must check for 404, not assume 405, on an unknown path |
| Empty request path | Java's trailing-slash trim throws on an empty string (`StringIndexOutOfBoundsException`) | `trimTrailingSlash("")` guards `path.length > 0` first and returns `""` without throwing | Fixes a latent Java crash on an empty URI; TS is strictly safer, not merely different |
| Webhook token check order | Not specified by the platform; left to the application | `verifyClockifyWebhookRequest` verifies the JWT before comparing the stored token (see the P0 security fixes above) | Closes a token-probing oracle a naive Java-parity port would reproduce |
| Middleware `next()` called twice | Silently allowed | Throws `"Middleware next() called multiple times."` | Hardens over a Java gap: a double-next in Java corrupts response state without an error to point at |
| `component.settings` field setter | `DefinitionProcessor.java`'s generic model setter hardcodes its parameter name as `settings` while its generated body statement references the field's own name — reading the annotation processor source, this shape would not compile for a field literally named anything other than `settings` | `clockify-addon.ts`'s `registerCustomSettings` assigns `m.settings = path` directly, unconditionally correct for any field | Not independently reproduced by compiling the Java generator; documented from reading the generator source, not asserted as a confirmed runtime failure |
| `DELETED` lifecycle guard | Not specified; left to the application | `InMemoryClockifyInstallationStore.delete()` is unconditional unless the caller supplies `installedAt` | The `DELETED` payload carries no installation generation; an application that wants to guard against a stale delete must retain its own `installedAt` and pass it explicitly (see the installation-and-storage guide) |
| `AddonResponse` JSON boundary | N/A (Java's typed model has no equivalent ambiguity) | `isJsonBody()` treats only plain objects and arrays as JSON; a class instance (`Map`, `Set`, `Date`, `RegExp`, or a custom class) falls to the non-JSON path instead of silently serializing to `{}` | See the `isJsonBody` fix above; documented here so a Java-to-TS port doesn't assume every object-shaped body round-trips through JSON |
| `UNINSTALLED` event | Not a Marketplace lifecycle term | Not implemented; `DELETED` is the documented deletion event | No migration needed — `UNINSTALLED` was never part of either SDK's supported surface |

## Latest Manifest 1.5 Proof

- [x] v1.5 webhook builders expose latest events such as `TIME_ENTRY_SPLIT`
- [x] v1.5 lifecycle builders expose `STATUS_CHANGED`
- [x] v1.5 component builders expose `invoices.action`
- [x] v1.5 manifest settings accept both self-hosted settings paths and structured settings objects
- [x] Compile-time probes cover 1.5-only differences so schema drift fails `npm run type-check`
