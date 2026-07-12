# CLAUDE.md

Quick reference for Claude Code and other contributors working in this repository.

## Current hardening checkpoint (2026-07-12)

- The root SDK entrypoint is runtime-neutral. Import Node, Express, and Fetch integration from the
  granular adapter subpaths; never reintroduce `node:*` through the root.
- Browser-facing responses use the SDK security helpers. Production public origins require explicit
  HTTPS configuration, and the UI bridge requires an exact parent origin and source.
- Component and lifecycle JWTs require expiration. Webhook signatures may be non-expiring but still
  require RS256, issuer/type/subject, event, installation context, and stored-token checks.
- Installation credentials, including nested webhook copies, are encrypted at rest. The store's
  generation guard applies only when a delete caller supplies `installedAt`. Clockify's `DELETED`
  payload has no generation, so the generated unqualified uninstall cleanup is unconditional.
- Outbound mutations replay only a confirmed 429. Safe reads may retry transient failures; caller
  aborts are terminal.
- Draft-04 manifest validation covers vendored schema versions 1.2-1.5. The creator package emits
  fail-closed Node and Worker projects in minimal and all-feature modes; ephemeral installation
  storage is local-development-only.
- `verify:scaffolds` installs the packed SDK into all four runtime/feature variants, executes their
  runtime manifests, validates exact descriptor counts, and probes 404, component-auth failure, and
  production configuration failure. This is not a substitute for a fresh authenticated Clockify
  developer-workspace pass before Marketplace release.
- A sanitized 2026-07-12 authenticated Firefox pass installed the packed Node all-features
  scaffold, observed successful `INSTALLED`, `NEW_TIME_ENTRY`, component, and `DELETED` requests,
  and confirmed exact-origin iframe enforcement in the developer workspace. That receipt applies
  to this checkpoint only; rerun it after relevant manifest, request, scaffold, or security changes.
- CodeRabbit was unavailable for that pass. Local package, cycle, API-surface, security-boundary,
  and diff reviews were used; do not describe this as a CodeRabbit-reviewed release.

- Keep Node `http` and Fetch body-limit semantics aligned: declared `content-length` values above
  `maxBodyBytes` must fail before routing, and streamed bodies must still fail once the byte counter
  crosses the limit. Malformed declared lengths return 400 without invoking `onError`. Express body
  limits stay with the host app.
- Runtime support starts at Node 22, so `@types/node` stays on `^22` unless the runtime support
  contract changes. Do not accept Node 26 ambient types as a routine Dependabot bump.
- The SDK-tooling Dependabot lane can move ESLint, Prettier, and Vite together, but rerun
  `npm run format:check` after applying it because Prettier changes may require source wrapping.
- Discarded commit `623fbdc` was reviewed during the July 2026 plan pass. Do not restore its
  benchmark, scaffold, fuzz, or broad parity files wholesale; reintroduce only pieces that have
  current-code proof and a clear maintenance payoff.

## Layout

- `addon-sdk/` — the published package (`@apet97/clockify-addon-sdk`). All SDK code, schemas,
  examples, and tests live here. Run package commands from this directory.
- `create-clockify-addon/` — the creator package. Its Node/Worker minimal/all projects must install,
  type-check, and execute against the packed SDK, not workspace source.
- Root npm scripts proxy the package gates through npm workspaces; use `npm run ci:verify` from the
  repo root for the full local/CI verification chain.

## Source of truth

- Behaviour mirrors the upstream Clockify add-on Java SDK; the TypeScript port stays faithful to it.
- Manifest schemas are vendored under `addon-sdk/schemas/clockify-manifests/*.json`: 1.2–1.4 are
  byte-identical to the Clockify add-on Java SDK's bundled resources, 1.5 is taken verbatim from the
  live schema endpoint (modulo a trailing newline), and all are structurally identical to the live
  API (which serves them minified). Supported versions: **1.2, 1.3, 1.4, 1.5** (`?version=1.6`
  returns HTTP 400).
- `addon-sdk/schemas/clockify-manifests/provenance.json` records the supported schema list, source
  labels, and raw SHA-256 hashes. `npm run verify:generated` must fail if a supported schema is
  missing, changed without updating provenance, if the supported version set drifts, or if a fresh
  temporary generation differs from committed generated output.
- `addon-sdk/src/clockify/generated/**` is generated from those schemas. **Never edit it by hand** —
  change the schema or the generator, then `npm run generate`. Public generated interfaces include
  schema descriptions as JSDoc; keep that documentation in the generator, not in generated files.
- Builder step order follows each schema's `required` array (matching the upstream processor).
  Required array fields keep Java-parity empty-array defaults but must still throw at runtime when
  their setter was never called.
- Marketplace coverage is tracked in `docs/marketplace-coverage.md`. The SDK owns add-on-specific
  token/settings transport, storage contracts, secure UI messaging, and schema validation. The
  separate `clockify-ts-sdk` owns entity-specific REST APIs, CLI, and MCP behavior.
- Clockify-signed tokens are verified as `RS256` JWTs with `iss=clockify`, `type=addon`, and
  `sub=<manifest key>`. Webhooks should use `verifyClockifyWebhookRequest()` with
  `expectedEventType`; lifecycle routes should use `X-Addon-Lifecycle-Token`; Clockify API calls use
  `X-Addon-Token`.
- `jose@6` is ESM-only. Keep SDK runtime references to `jose` behind dynamic imports so the CommonJS
  build and installed CJS consumer smoke stay clean.
- Do not hardcode Clockify API/report/location/screenshot hosts. Use verified token claims such as
  `backendUrl`, `reportsUrl`, `locationsUrl`, and `screenshotsUrl`.
- Encode every caller-provided URL path segment. Use `X-Addon-Token`, never `Authorization`, and do
  not log outbound query strings or credentials.
- Node `http` and Fetch adapters enforce `DEFAULT_MAX_BODY_BYTES` (`1_048_576`) before dispatch and
  return 413 for oversized bodies. Invalid `maxBodyBytes` values should throw configuration errors.
  Express body limits are configured by the host app, not the SDK.
- Express remains an optional peer. Keep the adapter structurally typed so root imports and non-Express
  consumers do not need Express types installed.
- Runtime support starts at Node 22. CI verifies Node 22.x and 24.x.
- Source-build tooling uses TypeScript 6, Vitest 4, and Vite 8. Vite 8 requires Node 22.12+ within
  the supported Node 22 line; do not raise package runtime support beyond `>=22` just for tooling.

## Gates

| Command                                    | Checks                                                                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ci:verify`                        | Canonical root gate: workspace dependency tree, type-check, generated drift, thresholded coverage, lint, format check, build, public API snapshot, dist import smoke, pack dry-run, package lint, installed-consumer and scaffold smokes, and audits. |
| `npm run verify:deps`                      | Confirms the npm workspace dependency tree resolves at depth 0 before the heavier package gates.                                                                                                                                                      |
| `npm run type-check`                       | `src`, generator, examples, and the type-state probes. A weakened builder must fail this.                                                                                                                                                             |
| `npm run verify:generated`                 | Checks schema provenance, generates to a temporary directory, compares against committed generated files, and leaves tracked files untouched.                                                                                                         |
| `npm run test`                             | vitest suite.                                                                                                                                                                                                                                         |
| `npm run test:coverage`                    | Enforced Vitest V8 coverage over handwritten `src/**/*.ts`, excluding generated models: 97% statements, 92% branches, 98% functions, and 98% lines.                                                                                                   |
| `npm run lint`                             | Check-only ESLint over the package.                                                                                                                                                                                                                   |
| `npm run format:check`                     | Check-only Prettier over the package.                                                                                                                                                                                                                 |
| `npm run build`                            | ESM + CJS output.                                                                                                                                                                                                                                     |
| `npm run verify:public-api`                | Compares built declaration surfaces for root, Clockify, adapters, client, UI, and testing entrypoints against `addon-sdk/public-api.snapshot.md`.                                                                                                     |
| `npm run verify:dist`                      | Imports the **built** ESM and CJS and boots the quick-start. A green `build` alone does not prove the package imports.                                                                                                                                |
| `npm run pack:dry-run`                     | SDK tarball contents (`dist` + `docs` + schemas + license/readme) and the separate creator tarball (`bin` + `src` + license/readme).                                                                                                                  |
| `npm run verify:package-lint`              | Packs the already-built package with scripts ignored, then runs `publint --strict` and Are The Types Wrong with the Node16 profile. Node10 findings are intentionally outside this Node 22+ package's support policy.                                 |
| `npm run verify:package-consumer`          | Packs the already-built package with scripts ignored, installs it into temporary runtime ESM/CJS and TypeScript ESM/CJS consumers, imports public subpaths, signs/verifies test tokens, type-checks declarations, and serves `/manifest`.             |
| `npm run verify:scaffolds`                 | Packs the SDK; installs, type-checks, and executes Node/Worker minimal/all projects; validates `/manifest` and exact descriptor counts; probes 404, component auth failure, and fail-closed production configuration.                                 |
| `npm run audit:prod` / `npm run audit:all` | Production and full dependency audits; both should report 0 vulnerabilities.                                                                                                                                                                          |

GitHub Actions runs `npm run ci:verify` on Node 22.x and 24.x for pushes to `main` and `codex/**`,
pull requests, and manual dispatches. A separate scheduled/manual `Live Schema Drift` workflow runs
`npm run verify:schema-live` on Node 24.x so normal PR CI stays deterministic.

Linting and formatting are check-only CI gates. ESLint and Prettier intentionally ignore
`node_modules`, `dist`, `coverage`, `*.tgz`, vendored Marketplace docs, manifest schemas, and
generated Clockify models.

## Git / publish workflow

- For direct `main` publishes, first run `npm run ci:verify`, then `git fetch origin`, confirm ancestry,
  commit the branch, fast-forward `main`, and push `origin main`.
- Do not open a PR when the user explicitly asks to push to `main`.
- Do not push generated drift, a stale `dist/`, or a dry-run `.tgz` artifact.

## Notes

- Independent, unofficial project — not affiliated with Clockify or CAKE.com.
