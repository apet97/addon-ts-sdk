# CLAUDE.md

Quick reference for Claude Code and other contributors working in this repository.

## Current hardening checkpoint (2026-07-14)

- The root SDK entrypoint is runtime-neutral. Import Node, Express, and Fetch integration from the
  granular adapter subpaths; never reintroduce `node:*` through the root.
- Browser-facing responses use the SDK security helpers. Production public origins require explicit
  HTTPS configuration, and the UI bridge requires an exact parent origin and source.
- Component and lifecycle JWTs require expiration. Raw webhook verification requires a fixed stored
  token plus nonblank signed workspace/add-on installation context; the wrapper requires exactly one
  fixed or lookup token source and checks signature, event, and context before any lookup.
- Installation credentials, including nested webhook copies, are encrypted at rest. The store's
  generation guard applies only when a delete caller supplies `installedAt`. Clockify's `DELETED`
  payload has no generation, so the generated unqualified uninstall cleanup is unconditional.
- Outbound mutations replay only a confirmed 429. Safe reads may retry transient failures; discarded
  retry response bodies are cancelled before backoff, missing or blank `Retry-After` values use the
  bounded exponential fallback, cancellation failures do not replace the intended retry, and caller
  aborts are terminal.
- `ClockifyAddonClient` accepts only integer `timeoutMs` values from 1 through 2,147,483,647 and
  rejects credential-bearing `backendUrl` values. Direct HTTP configuration accepts only exact
  canonical loopback spellings, and empty or dot-only path segments fail before fetch/retry logic.
- Draft-04 manifest validation covers vendored schema versions 1.2-1.5. The creator package emits
  fail-closed Node and Worker projects in minimal and all-feature modes; ephemeral installation
  storage is local-development-only.
- Registration accepts schema-valid manifests that omit optional component, lifecycle, or webhook
  arrays. A `register*` call initializes its missing array only after the route binds successfully;
  conflicts leave both the router and manifest unchanged.
- `verify:scaffolds` packs both packages, generates all four runtime/feature variants through the
  installed creator artifact, installs the packed SDK, executes Node and real `workerd` Worker
  routes, validates their exact manifests and failure paths, and separately compiles Worker entry
  points with a Wrangler dry-run. This is not a substitute for a fresh authenticated Clockify
  developer-workspace pass before release.
- The SDK and creator are public npm packages. Consumers install with
  `npm install @apet97/clockify-addon-sdk` or scaffold with `npm create clockify-addon@latest`;
  `docs/maintainers/release-readiness.md` is the canonical exact-version record.
- `release:preflight` and `verify:registry` read both workspace versions dynamically. The former
  fails unless exact versions are unpublished; the latter waits briefly for normal npm propagation,
  installs the exact published artifacts, and executes a generated Node minimal project. Both depend
  on registry state and stay outside deterministic `ci:verify`; run `release:verify` only before
  publication because its dry run correctly rejects immutable published versions.
- `docs/maintainers/release-readiness.md` is the canonical publication record and
  `docs/maintainers/marketplace-coverage.md` is the canonical live/Marketplace evidence record.
  Historical receipts prove only their recorded SHA; local, CI, and dry-run checks are not fresh
  live, registry, or Marketplace proof.

- Keep Node `http` and Fetch body-limit semantics aligned on every HTTP method: declared
  `content-length` values above `maxBodyBytes` must fail before routing, and streamed bodies must
  still fail once the byte counter crosses the limit. Malformed declared lengths return 400 without
  invoking `onError`. The Node adapter and the Express structural fallback must preserve leading
  slashes in origin-form request targets; `//host/path` is a path, not an alternate authority.
  Express body limits stay with the host app.
- Published-package runtime support starts at Node 22, while source development requires Node
  22.13.0 or newer. Keep `@types/node` on `^22` unless the runtime contract changes.
- The SDK-tooling Dependabot lane accepts minor and patch updates only. Keep TypeScript on major 6
  and Node ambient types on major 22 until each next major receives a deliberate compatibility pass.
- Discarded commit `623fbdc` was reviewed during the July 2026 plan pass. Do not restore its
  benchmark, scaffold, fuzz, or broad parity files wholesale; reintroduce only pieces that have
  current-code proof and a clear maintenance payoff.

## Layout

- `addon-sdk/` — the published SDK package workspace (`@apet97/clockify-addon-sdk`). All SDK code,
  schemas, examples, and tests live here. Run package commands from this directory.
- `create-clockify-addon/` — the published ESM-only creator package with a typed programmatic export. Its
  Node/Worker minimal/all projects must be generated through the packed creator, install the packed
  SDK, type-check, and execute without workspace-source imports.
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
- Marketplace coverage is tracked in `docs/maintainers/marketplace-coverage.md`. The SDK owns
  add-on-specific token/settings transport, storage contracts, secure UI messaging, and schema
  validation. The separate `clockify-ts-sdk` owns entity-specific REST APIs, CLI, and MCP behavior.
- Clockify-signed tokens are verified as `RS256` JWTs with `iss=clockify`, `type=addon`, and
  `sub=<manifest key>`. Raw webhook verification requires `expectedEventType`, a fixed
  `expectedWebhookAuthToken`, and nonblank signed `workspaceId`/`addonId`; the wrapper requires
  exactly one fixed token or `getExpectedWebhookAuthToken`. Lifecycle routes use
  `X-Addon-Lifecycle-Token`; Clockify API calls use `X-Addon-Token`.
- `jose@6` is ESM-only. Keep SDK runtime references to `jose` behind dynamic imports so the CommonJS
  build and installed CJS consumer smoke stay clean.
- Do not hardcode Clockify API/report/location/screenshot hosts. Claim-derived base URL resolvers
  accept only absolute HTTPS or canonical loopback HTTP URLs without credentials, query strings, or
  fragments; an invalid nonblank preferred `apiUrl` must not fall back to `backendUrl`.
- Direct `ClockifyAddonClient` configuration rejects credentials in `backendUrl` and noncanonical
  HTTP loopback spellings. Reject empty, `.`, and `..` caller-provided path segments before retry
  handling; encode every accepted segment, use `X-Addon-Token` rather than `Authorization`, and do
  not log outbound query strings or credentials.
- Node `http` and Fetch adapters enforce `DEFAULT_MAX_BODY_BYTES` (`1_048_576`) before dispatch and
  return 413 for oversized bodies. Invalid `maxBodyBytes` values should throw configuration errors.
  Express body limits are configured by the host app, not the SDK.
- Express remains an optional peer. Keep the adapter structurally typed so root imports and non-Express
  consumers do not need Express types installed.
- Published-package runtime support starts at Node 22. CI verifies the source-development floor at
  Node 22.13.0 and the current Node 24 line.
- Source-build tooling uses TypeScript 6, Vitest 4, Vite 8, and ESLint 10. Keep package runtime
  support at `>=22` even though the accepted source toolchain has a narrower patch-level floor.

## Gates

| Command                                    | Checks                                                                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ci:verify`                        | Canonical root gate: workspace dependency tree, type-check, generated drift, thresholded coverage, lint, format check, build, public API snapshot, dist import smoke, pack dry-run, package lint, installed-consumer and scaffold smokes, and audits. |
| `npm run verify:deps`                      | Confirms the npm workspace dependency tree resolves at depth 0 before the heavier package gates.                                                                                                                                                      |
| `npm run type-check`                       | `src`, generator, examples, and the type-state probes. A weakened builder must fail this.                                                                                                                                                             |
| `npm run verify:generated`                 | Checks schema provenance, generates to a temporary directory, compares against committed generated files, and leaves tracked files untouched.                                                                                                         |
| `npm run test`                             | vitest suite.                                                                                                                                                                                                                                         |
| `npm run test:coverage`                    | Enforced Vitest V8 coverage over handwritten `src/**/*.ts`, excluding generated models: 97% statements, 92% branches, 98% functions, and 98% lines.                                                                                                   |
| `npm run lint`                             | Check-only ESLint over the package and every root release tool through the shared configuration.                                                                                                                                                      |
| `npm run format:check`                     | Check-only Prettier over the package and root release tools.                                                                                                                                                                                          |
| `npm run build`                            | ESM + CJS output.                                                                                                                                                                                                                                     |
| `npm run verify:public-api`                | Compares built declaration surfaces for root, Clockify, adapters, client, UI, and testing entrypoints against `addon-sdk/public-api.snapshot.md`.                                                                                                     |
| `npm run verify:dist`                      | Imports the **built** ESM and CJS and boots the quick-start. A green `build` alone does not prove the package imports.                                                                                                                                |
| `npm run pack:dry-run`                     | SDK tarball contents (`dist` + `docs` + schemas + license/readme) and the separate creator tarball (`bin` + `src` + license/readme).                                                                                                                  |
| `npm run verify:package-lint`              | Packs both artifacts with scripts ignored, then runs `publint --strict` and Are The Types Wrong: Node16 for the dual-format SDK and `esm-only` for the creator. Node10 findings are outside the supported runtime policy.                             |
| `npm run verify:package-consumer`          | Packs the already-built package with scripts ignored, installs it into temporary runtime ESM/CJS and TypeScript ESM/CJS consumers, imports public subpaths, signs/verifies test tokens, type-checks declarations, and serves `/manifest`.             |
| `npm run verify:scaffolds`                 | Packs installed creator/SDK; generates, installs, and type-checks Node/Worker minimal/all; executes Node and real `workerd` routes; validates manifests/failures; Wrangler-dry-runs Worker entries.                                                   |
| `npm run release:preflight`                | Manual one-shot network gate: fails unless both exact workspace versions are absent from the configured npm registry.                                                                                                                                 |
| `npm run verify:registry`                  | Manual post-publish gate: waits up to 30 seconds only for absent exact versions, then installs them into a disposable consumer and checks ESM/CJS/TypeScript/creator plus a generated Node minimal project.                                           |
| `npm run audit:prod` / `npm run audit:all` | Production and full dependency audits; both should report 0 vulnerabilities.                                                                                                                                                                          |

GitHub Actions runs `npm run ci:verify` on Node 22.13.0 and 24.x for pushes to `main` and `codex/**`,
pull requests, and manual dispatches. A separate scheduled/manual `Live Schema Drift` workflow runs
`npm run verify:schema-live` on Node 24.x so normal PR CI stays deterministic.

Linting and formatting are check-only CI gates. ESLint and Prettier intentionally ignore
`node_modules`, `dist`, `coverage`, `*.tgz`, vendored Marketplace docs, manifest schemas, and
generated Clockify models.

## Git / publish workflow

- npm versions are immutable. Every future publish requires a version change, a successful
  `npm run release:preflight`, `npm run release:verify`, a successful `npm whoami`, and explicit
  npm-owner approval for the exact packages and versions.
- When both packages change, publish the SDK first. Publish the creator only after the SDK succeeds,
  then run `npm run verify:registry` to smoke-test both exact versions from the public registry in a
  fresh temporary consumer.
- For direct `main` publishes, run the full gate, fetch `origin`, confirm `origin/main` is an ancestor,
  commit the branch, push `origin main` without force, and verify `origin/main...main` is `0 0`.
- Do not open a PR when the user explicitly asks to push to `main`.
- Do not push generated drift, a stale `dist/`, or a dry-run `.tgz` artifact.

## Notes

- Independent, unofficial project — not affiliated with Clockify or CAKE.com.
