# API Surface Map: Java to TypeScript

This file documents the API translation from Java classes/methods to TypeScript types/functions.

## Core Runtime

| Java Class / Interface | TypeScript Type / Class |
|---|---|
| `Addon<M>` | `Addon<M>` (Abstract class) |
| `AddonServlet` / `EmbeddedServer` | Adapters under `src/adapters/`: `createNodeHttpAddonServer`, `createExpressAddonHandler`, `handleFetchRequest` |
| `RequestHandler` | `RequestHandler` type signature |
| `Filter` / `FilterChain` | `AddonMiddleware` type signature |
| `Addon.Request` | `AddonRequest` type interface |
| `HttpResponse` | `AddonResponse` type interface |

## Clockify Product Layer

| Java Class / Interface | TypeScript Type / Class |
|---|---|
| `ClockifyAddon` | `ClockifyAddon` |
| `ClockifyManifest` | `ClockifyManifest` |
| `ClockifyResource` | `ClockifyResource` |
| `ClockifySignatureParser` | `ClockifySignatureParser` |
| `ClockifySignatureParser.CLAIM_*` | `ClockifySignatureClaims` enum const |
| `ClockifySignatureParser.ISSUER` | `CLOCKIFY_JWT_ISSUER` constant |
| `ClockifySignatureParser.ADDON` | `CLOCKIFY_JWT_ADDON_TYPE` constant |
