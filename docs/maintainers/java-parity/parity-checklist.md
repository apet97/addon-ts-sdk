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
- [x] Method Not Allowed (405) returned on unmatched routes or methods
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

## Latest Manifest 1.5 Proof

- [x] v1.5 webhook builders expose latest events such as `TIME_ENTRY_SPLIT`
- [x] v1.5 lifecycle builders expose `STATUS_CHANGED`
- [x] v1.5 component builders expose `invoices.action`
- [x] v1.5 manifest settings accept both self-hosted settings paths and structured settings objects
- [x] Compile-time probes cover 1.5-only differences so schema drift fails `npm run type-check`
