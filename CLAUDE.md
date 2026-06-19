# CLAUDE.md

Quick reference for Claude Code in this repo. [AGENTS.md](./AGENTS.md) holds the full conventions
(layout, schemas, scope boundary, token/auth rules); this file keeps the non-negotiables, the gates,
and the gotchas worth re-reading before you touch anything.

## What this is

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification. The package lives in `addon-sdk/`
— run all commands from there. Independent, unofficial project, not affiliated with Clockify or
CAKE.com.

## Non-negotiables

- **Never hand-edit `addon-sdk/src/clockify/generated/**`.** It is generated from
  `addon-sdk/schemas/clockify-manifests/*.json`; change the schema or generator, then
  `npm run generate`. Builder step order follows each schema's `required` array.
- **Keep it lean.** No REST client, token-exchange client, UI/window-event framework, persistence
  layer, or custom manifest validator without an explicit ask.
- **Tokens:** verify `RS256` only, with `iss=clockify`, `type=addon`, `sub=<manifest key>`. Webhooks
  assert `clockify-signature` + `clockify-webhook-event-type`; lifecycle uses `X-Addon-Lifecycle-Token`;
  Clockify API calls use `X-Addon-Token`.
- **Hosts:** never hardcode them. Read `backendUrl`/`reportsUrl`/`locationsUrl`/`screenshotsUrl` from
  verified claims, or `getClockifyEnvironmentContext()`.

## Before claiming done — all gates green (from `addon-sdk/`)

```bash
npm run type-check        # compiles the type-state probes; a weakened builder must fail this
npm run verify:generated  # regenerates from schemas, fails on drift
npm run test
npm run build && npm run verify:dist   # build alone does NOT prove the package imports — verify:dist does
npm pack --dry-run        # tarball is dist + LICENSE + README
```

## Gotchas (learned the hard way)

- A green `type-check` means nothing unless the probe files are actually in the program. The probes
  live in `tests/types/*.probe.ts`; `tests/typecheck-gate.test.ts` guards that they are compiled.
- A green `build` does not mean the published package works. `verify:dist` imports the **built** ESM
  and CJS and boots the README quick-start; it is wired into `prepack`.
- Webhook signature verification alone is incomplete for Marketplace parity. Tests also cover
  event-header mismatches, lifecycle-token headers, workspace/add-on claim mismatches, and
  no-hardcoded-fallback environment URL behavior.
