# CLAUDE.md

Quick reference for Claude Code in this repo. [AGENTS.md](./AGENTS.md) holds the full conventions
(layout, schemas, scope boundary, token/auth rules); this file keeps the non-negotiables, the gates,
and the gotchas worth re-reading before you touch anything.

## What this is

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification. The package lives in
`addon-sdk/`, with root npm scripts proxying the package gates through workspaces. Runtime support
starts at Node 22. Independent, unofficial project, not affiliated with Clockify or CAKE.com.
Source-build tooling uses TypeScript 6, Vitest 4, and Vite 8; Vite 8 requires Node 22.12+ within the
supported Node 22 line, but package runtime support remains `>=22`.

## Non-negotiables

- **Generated output:** never hand-edit `addon-sdk/src/clockify/generated/**`. It is generated from
  `addon-sdk/schemas/clockify-manifests/*.json`; change the schema or generator, then
  `npm run generate`. Public generated interfaces carry schema descriptions as JSDoc; private
  builder implementations should not duplicate those comments. Builder step order follows each
  schema's `required` array; required array setters must be called at runtime even when Java-parity
  defaults initialize arrays to `[]`.
- **Schema provenance is part of the source of truth.** `verify:generated` enforces exactly schema
  versions 1.2, 1.3, 1.4, and 1.5, source labels, schema file presence, raw SHA-256 hashes, and a
  check-only fresh generation that must match committed output without rewriting tracked files.
- **Keep it lean.** No REST client, token-exchange client, UI/window-event framework, persistence
  layer, or custom manifest validator without an explicit ask.
- **Tokens:** verify `RS256` only, with `iss=clockify`, `type=addon`, `sub=<manifest key>`. Webhooks
  should use `verifyClockifyWebhookRequest()` with an explicit `expectedEventType`; lifecycle uses
  `X-Addon-Lifecycle-Token`; Clockify API calls use `X-Addon-Token`.
- **`jose@6`:** it is ESM-only. Keep SDK runtime use behind dynamic `import("jose")` so the CJS build
  and installed CJS consumer smoke do not rely on `require("jose")`.
- **Lifecycle bodies:** use the exported payload guards plus
  `clockifyLifecyclePayloadMatchesClaims()`. The matcher narrows claims to required
  `workspaceId`/`addonId`, so examples should not need installation-claim casts.
- **Hosts:** never hardcode them. Read `backendUrl`/`reportsUrl`/`locationsUrl`/`screenshotsUrl` from
  verified claims, or `getClockifyEnvironmentContext()`.
- **Adapters:** Node `http` and Fetch bodies default to `DEFAULT_MAX_BODY_BYTES` (`1_048_576`) and
  return 413 before dispatch when exceeded. Express body limits belong to the host app
  (`express.json({ limit: "1mb" })`). Express is an optional peer; do not leak Express-specific types
  into root exports or shared adapter contracts.
- **Handled errors stay quiet by default.** Router, Fetch, and Node adapter 500 paths report only
  through the optional `onError(error, context)` hook. Middleware `next()` is single-use so a bad
  middleware cannot dispatch the handler twice.

## Before claiming done — root gate green

```bash
npm run ci:verify
```

This runs workspace dependency resolution, type-check, generated drift, tests, lint, format check,
build, `verify:public-api`, `verify:dist`, pack dry-run, installed-package consumer smoke,
package lint, production audit, and full audit. GitHub Actions runs the same gate on Node 22.x and
24.x.

For coverage visibility:

```bash
npm run test:coverage
```

This is advisory and excludes generated Clockify models.

## Gotchas (learned the hard way)

- A green `type-check` means nothing unless the probe files are actually in the program. The probes
  live in `tests/types/*.probe.ts`; `tests/typecheck-gate.test.ts` guards that they are compiled.
- A green `build` does not mean the published package works. `verify:dist` imports the **built** ESM
  and CJS and boots the README quick-start; it is wired into `prepack`.
- `verify:public-api` compares the built ESM declaration surface for root, `/clockify`, `/adapters`,
  and `/testing` against `addon-sdk/public-api.snapshot.md`. Intentional public API changes must
  update that snapshot after `npm run build`.
- Webhook signature verification alone is incomplete for Marketplace parity. Tests also cover
  event-header mismatches, lifecycle-token headers, workspace/add-on claim mismatches, and
  no-hardcoded-fallback environment URL behavior.
- `npm pack --dry-run` invokes `prepack`, so it re-runs the heavy gate chain. Use
  `find addon-sdk -maxdepth 1 -name '*.tgz' -print` afterward when checking for accidental artifacts.
- `verify:package-consumer` stays outside `prepack`: it packs the already-built package with scripts
  ignored, installs that tarball into temporary runtime ESM/CJS and TypeScript ESM/CJS consumers,
  imports public subpaths from the installed dependency, signs/verifies test tokens from ESM and CJS,
  and catches declaration leaks such as non-optional Express types or static `jose` ESM/CJS mistakes.
- `verify:package-lint` also stays outside `prepack` because it packs the tarball. It runs
  `publint --strict` and Are The Types Wrong with the Node16 profile, which matches this Node 22+
  SDK's supported modern package resolution story; Node10 findings are not release blockers.
- `npm run lint` and `npm run format:check` are real check-only gates. The package configs ignore
  vendored Marketplace docs, schema/provenance files, generated Clockify models, `dist`, `coverage`,
  `node_modules`, and dry-run tarballs.
- If asked to push directly to `main`, commit on the work branch, `git fetch origin`, confirm
  `main` can fast-forward to the branch, then fast-forward `main` and push `origin main`. Do not open
  a PR when the user explicitly says to push to main. If the GitHub CLI is authenticated, watch the
  resulting main CI run before reporting completion.
