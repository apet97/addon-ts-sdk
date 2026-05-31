# Parity Checklist

This document tracks implementation status of Java parity requirements and modern TypeScript adaptations.

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

## TS Extensions / Adaptations
- [x] Support schema version 1.5 in addition to 1.2, 1.3, and 1.4
- [x] Type-safe step builders for required vs optional fields
- [x] Express middleware adapter
- [x] Fetch API request/response adapter (Hono/Cloudflare compatibility)
- [x] Node HTTP createServer adapter
