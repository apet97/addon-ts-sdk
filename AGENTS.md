# AGENTS.md

Conventions for anyone (human or agent) working in this repository.

## Layout

- `addon-sdk/` — the published package (`@apet97/clockify-addon-sdk`). All SDK code, schemas,
  examples, and tests live here. Run package commands from this directory.

## Source of truth

- Behaviour mirrors the upstream Clockify add-on Java SDK; the TypeScript port stays faithful to it.
- Manifest schemas are vendored under `addon-sdk/schemas/clockify-manifests/*.json`: 1.2–1.4 are
  byte-identical to the Clockify add-on Java SDK's bundled resources, 1.5 is taken verbatim from the
  live schema endpoint (modulo a trailing newline), and all are structurally identical to the live
  API (which serves them minified). Supported versions: **1.2, 1.3, 1.4, 1.5**.
- `addon-sdk/src/clockify/generated/**` is generated from those schemas. **Never edit it by hand** —
  change the schema or the generator, then `npm run generate`.
- Builder step order follows each schema's `required` array (matching the upstream processor).
- Marketplace docs coverage is intentionally small and runtime-focused: request verification helpers,
  lifecycle payload types, token/header constants, and environment/region claim extraction. Do not add
  a REST client, token exchange client, UI/window-event framework, persistence layer, or custom
  manifest validator unless explicitly requested.
- Clockify-signed tokens are verified as `RS256` JWTs with `iss=clockify`, `type=addon`, and
  `sub=<manifest key>`. Webhooks should assert `clockify-webhook-event-type`; lifecycle routes should
  use `X-Addon-Lifecycle-Token`; Clockify API calls use `X-Addon-Token`.
- Do not hardcode Clockify API/report/location/screenshot hosts. Use verified token claims such as
  `backendUrl`, `reportsUrl`, `locationsUrl`, and `screenshotsUrl`.

## Gates (from `addon-sdk/`)

| Command | Checks |
|---|---|
| `npm run type-check` | `src`, generator, examples, and the type-state probes. A weakened builder must fail this. |
| `npm run verify:generated` | Regenerates from the schemas; fails on drift. |
| `npm run test` | vitest suite. |
| `npm run build` | ESM + CJS output. |
| `npm run verify:dist` | Imports the **built** ESM and CJS and boots the quick-start. A green `build` alone does not prove the package imports. |
| `npm pack --dry-run` | Tarball contents (`dist` + README only). |

## Notes

- Independent, unofficial project — not affiliated with Clockify or CAKE.com.
