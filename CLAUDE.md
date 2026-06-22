# CLAUDE.md

Quick reference for Claude Code in this repo. [AGENTS.md](./AGENTS.md) holds the full conventions
(layout, schemas, scope boundary, token/auth rules); this file keeps the non-negotiables, the gates,
and the gotchas worth re-reading before you touch anything.

## What this is

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification. The package lives in
`addon-sdk/`, with root npm scripts proxying the package gates through workspaces. Runtime support
starts at Node 22. Independent, unofficial project, not affiliated with Clockify or CAKE.com.

## Non-negotiables

- **Never hand-edit `addon-sdk/src/clockify/generated/**`.** It is generated from
  `addon-sdk/schemas/clockify-manifests/*.json`; change the schema or generator, then
  `npm run generate`. Builder step order follows each schema's `required` array; required array
  setters must be called at runtime even when Java-parity defaults initialize arrays to `[]`.
- **Schema provenance is part of the source of truth.** `verify:generated` first runs
  `scripts/verify-schema-provenance.cjs`, which enforces exactly schema versions 1.2, 1.3, 1.4, and
  1.5, source labels, schema file presence, and raw SHA-256 hashes.
- **Keep it lean.** No REST client, token-exchange client, UI/window-event framework, persistence
  layer, or custom manifest validator without an explicit ask.
- **Tokens:** verify `RS256` only, with `iss=clockify`, `type=addon`, `sub=<manifest key>`. Webhooks
  should use `verifyClockifyWebhookRequest()` with an explicit `expectedEventType`; lifecycle uses `X-Addon-Lifecycle-Token`;
  Clockify API calls use `X-Addon-Token`.
- **Hosts:** never hardcode them. Read `backendUrl`/`reportsUrl`/`locationsUrl`/`screenshotsUrl` from
  verified claims, or `getClockifyEnvironmentContext()`.
- **Adapters:** Node `http` and Fetch bodies default to `DEFAULT_MAX_BODY_BYTES` (`1_048_576`) and
  return 413 before dispatch when exceeded. Express body limits belong to the host app
  (`express.json({ limit: "1mb" })`). Express is an optional peer; do not leak Express-specific types
  into root exports or shared adapter contracts.

## Before claiming done — root gate green

```bash
npm run ci:verify
```

This runs type-check, generated drift, tests, build, `verify:dist`, pack dry-run, production audit,
and full audit. GitHub Actions runs the same gate on Node 22.x and 24.x.

## Gotchas (learned the hard way)

- A green `type-check` means nothing unless the probe files are actually in the program. The probes
  live in `tests/types/*.probe.ts`; `tests/typecheck-gate.test.ts` guards that they are compiled.
- A green `build` does not mean the published package works. `verify:dist` imports the **built** ESM
  and CJS and boots the README quick-start; it is wired into `prepack`.
- Webhook signature verification alone is incomplete for Marketplace parity. Tests also cover
  event-header mismatches, lifecycle-token headers, workspace/add-on claim mismatches, and
  no-hardcoded-fallback environment URL behavior.
- `npm pack --dry-run` invokes `prepack`, so it re-runs the heavy gate chain. Use
  `find addon-sdk -maxdepth 1 -name '*.tgz' -print` afterward when checking for accidental artifacts.
- Linting and formatting are intentionally deferred. `npm run lint` and `npm run format:check` are
  no-op stubs until a focused check-only tooling pass is worth the dependency churn.
- If asked to push directly to `main`, commit on the work branch, `git fetch origin`, confirm
  `main` can fast-forward to the branch, then fast-forward `main` and push `origin main`. Do not open
  a PR when the user explicitly says to push to main. If the GitHub CLI is authenticated, watch the
  resulting main CI run before reporting completion.
