# Changelog

All notable changes to this SDK are recorded here.

## Unreleased

## 1.1.0

- Kept documentation verification deterministic by excluding Git-ignored local memory, worktree,
  prompt, and upstream-reference Markdown from the active repository document set.
- Closed a webhook timing oracle by verifying the signed JWT before comparing the fixed expected
  token, and removed a redundant second verification on the lookup-token path.
- Split comma-joined duplicate header values before verification and rejected Node requests with a
  duplicate `Content-Length` header, closing a request-smuggling class of ambiguity.
- Rejected client path segments that decode to `.`/`..`, and rejected absolute-form
  (`scheme://...`) Node request targets.
- Redacted headers, query strings, and bodies before `onError` reporters see a request; added
  `onError` support to the Express adapter.
- Hardened installation-store base64 encode/decode with a `Buffer` fast path and an explicit guard
  when `globalThis.crypto.getRandomValues` is unavailable; added `createRotatingClockifyTokenCodec`
  for encryption-key rotation without a forced re-encrypt migration.
- Made manifest/webhook/lifecycle registration atomic: a route only appears in the manifest after
  it binds, and an identical re-registration is a no-op instead of a conflict.
- Moved `ajv`/`ajv-draft-04` to devDependencies; the packed SDK's production dependency tree is now
  `jose` alone.
- Memoized per-path allowed methods instead of rescanning every request; dropped an unnecessary
  Fetch body stream clone.
- Added `isJsonBody` narrowing that excludes `Map`/`Set`/`Date`/`RegExp` and other class instances
  from the JSON-body fast path.
- Added an `onRetry` observer hook to `ClockifyAddonClient` and an `AllowedMethodsByPath` cache
  cleared on registration.
- Deprecated the legacy `/adapters` aggregate export in favor of the runtime-specific subpaths.
- Added `ClockifyManifest.builder()` as a canonical alias for `v1_5Builder()`; the webhook wrapper
  now fails fast on misconfiguration at construction and reports lookup-token misses through
  `onError` before returning 401.
- Expanded `testing/index.ts` with request/payload builder helpers
  (`createTestComponentRequest`, `createTestLifecycleRequest`, `createTestWebhookRequest`,
  `buildInstalledPayload`).
- Added `isAddonInputError` and clarified the absolute-path validation error message.
- Fixed `applyClockifyLanguage`'s multi-underscore locale conversion and `formatClockifyDate`'s
  crash on a malformed locale; documented `createClockifyHtmlResponse`'s default
  `frame-ancestors 'none'` deny-all.
- Generated a Worker-runtime `wrangler.toml` (`main`, `compatibility_date`, project name) in the
  creator scaffold so `wrangler dev`/`wrangler deploy` work without extra flags.
- Aligned the engine floor to Node `>=22.13.0` across both packages and documentation.
- Documented deferred/out-of-scope findings instead of rushing unjustified changes: bundle-size
  debt, pagination/rate-limit guidance for `ClockifyAddonClient.request()`, and public-key rotation.
- Recorded documented Java/TypeScript SDK behavioral divergences in the parity checklist.
- `verify:dist` now walks the portable ESM entry's relative-import closure to catch a `node:*`
  leak into the runtime-neutral graph.
- Made `verifyClockifyLifecycleRequest` default `requireExpiration` to `false`: the `INSTALLED`
  payload's `authToken` does not expire per the Marketplace auth docs, and requiring `exp` by
  default rejected legitimate lifecycle requests. `verifyClockifyComponentRequest` keeps the
  strict default for interactive, short-lived tokens.
- Added an optional `onDecodeError` callback to `wrapClockifyInstallationStoreWithEncryption` so a
  corrupt-decode event (wrong key, tampering) is observable instead of looking identical to "no
  installation" — `load()` still fails closed to `null` either way.
- Documented why manifest validation stays opt-in via `createValidatedClockifyAddon` rather than
  running inside the `ClockifyAddon` constructor: forcing it broke two official Clockify example
  manifests that fail this SDK's own schema validator for reasons unrelated to routing.
- Added tunnel guidance (`ngrok`/`cloudflared`) to the getting-started guide and SDK README
  quick-start — Clockify cannot reach `localhost`, and neither doc previously said so.
- Warned on the three insecure examples (`express-basic`, `fetch-basic`, `custom-settings`) that
  skip verifying Clockify's signed `auth_token`, and switched `expense-webhook` from the internal
  `generated.v1_5.*` accessors to the canonical `ClockifyWebhook.v1_5Builder()` export.
- Added `jose`'s MIT notice to `THIRD_PARTY_NOTICES.md` — the SDK's one runtime dependency was
  undocumented there — and extended the packed-consumer check to assert it ships.
- Added a commented `runClockifyIdempotentWebhook` recipe to the generated all-features webhook
  handler, and a liveness/readiness/`SIGTERM`-drain recipe to the deployment guide.
- Recorded the remaining Java-parity rows (lifecycle-token expiration, `scopes` and
  `component.label` requiredness drift across schema versions) and expanded the previously thin
  "TS Extensions" list.
- Vendored Clockify manifest schema 1.6 (additive over 1.5: the `TIME_OFF_REQUEST_STARTED` webhook
  event and the `timeentries.action.uiblocks` component type). Added `ClockifyManifest.v1_6Builder()`
  and the matching per-model `v1_6Builder()` factories alongside the existing 1.2–1.5 versions; the
  canonical `.builder()` alias stays on 1.5. `npm run verify:schema-live` now passes against the
  live Clockify endpoint.
- Applied `npm audit fix` for three pre-existing transitive dev-only advisories (`brace-expansion`,
  `fast-uri`, `postcss`): all three moved by a patch version within their existing majors. The
  packed production dependency tree (`jose` alone) already had 0 vulnerabilities.
- Added `withClockifyHandler()` as an additive unified alternative to the `withClockify*` wrappers:
  it normalizes every verification kind (`verified`, `component`, `lifecycle`, `installed`,
  `statusChanged`, `settingsUpdated`, `deleted`, `webhook`) to one `(request, context)` handler
  signature. No existing wrapper's signature changed. `ClockifyHandlerContext<Kind>` is
  parameterized on the discriminant, so the four lifecycle-payload kinds keep required
  `claims.workspaceId`/`claims.addonId` and their exact matched `payload` type instead of widening
  to the union a naive unification would produce. Documented the wire → header → wrapper → handler
  mapping in `addon-sdk/docs/api-reference.md`.
- Narrowed generated `Record<string, any>` component `options` fields to `Record<string, unknown>`
  across schema versions 1.2–1.6 by fixing the emitter in `generate-clockify-manifest.ts`. Added a
  runtime `typeof` guard to `createClockifyTextSetting` so a JavaScript (non-TS-checked) caller
  passing a non-string `value` gets a `ValidationException` instead of a silently malformed
  manifest.
- Added `@deprecated` naming aliases `verifyComponentToken`, `verifyLifecycleToken`, and
  `verifyWebhookToken` for `verifyClockifyComponentRequest`, `verifyClockifyLifecycleRequest`, and
  `verifyClockifyWebhookRequest`. Additive only — each alias is a direct reference to its canonical
  function, and no call site in this package switched to an alias. Documented the wire → header →
  helper table in `addon-sdk/docs/token-validation.md`.
- Renamed `addon-sdk/examples/` to `addon-sdk/snippets/` and documented the directory as copy-in
  reference code rather than standalone runnable projects — each file imports `../../src` directly
  and has no `package.json` of its own. The packed tarball's `files` array never listed this
  directory, so publication is unaffected.
- Refreshed all 13 captured `MARKETPLACE_DOCS/` snapshots from a 2026-08-07 re-scrape of Clockify's
  developer docs and added `MARKETPLACE_DOCS/14-manifest.md` for a previously-uncaptured upstream
  page. Documented that Clockify's live schema endpoint now also serves an intermediate `1.5.1`
  schema this SDK does not vendor a dedicated builder for.
- Fixed `addon-sdk/docs/api-reference.md`'s wire → header → wrapper → handler table, which named
  headers that do not exist on the wire (`X-Clockify-Signature`, `X-Clockify-Lifecycle-Token`,
  `X-Clockify-Webhook-Event-Token`); the real names are `clockify-signature`,
  `clockify-webhook-event-type`, and `x-addon-lifecycle-token`.
- Removed `docs/superpowers/**` (past-session planning records, not customer-facing) and the
  orphaned, stale `docs/product-surface.json`.

## 1.0.5 - 2026-07-14

- Reorganized active documentation into a builder-first journey with separate SDK reference and
  maintainer ownership boundaries.
- Added runtime- and feature-aware README output to generated creator projects.
- Added a repository documentation verifier for active links and anchors, required builder
  navigation, paired agent guidance, and configured stale claims.
- Replaced runtime AJV compilation with deterministic standalone Draft-04 validators so generated
  Worker projects execute under real `workerd` without string code generation.
- Executed all four packed Node/Worker scaffold variants, hardened detached Wrangler process-group
  cleanup, and expanded syntax-aware bundle inspection for indirect and aliased code generation.
- Corrected builder, lifecycle, client, routing, storage, migration, publication, and maintainer
  guidance against current source, package contents, and executable behavior.

## 1.0.4 - 2026-07-14

- Accept `http://127.0.0.1` and `http://[::1]` `backendUrl` values in
  `ClockifyAddonClient`, matching the canonical loopback policy used by the claim-derived URL
  resolvers while rejecting noncanonical raw spellings.
- Reject empty, `.`, and `..` client path segments that previously collapsed into a different
  endpoint during URL normalization, before fetch or retry handling begins.
- Apply the bounded exponential backoff when a retryable response omits or blanks the `Retry-After`
  header instead of retrying immediately; preserve an explicit numeric zero delay.

## 1.0.3 - 2026-07-14

- Fail closed when raw webhook verification lacks a fixed stored token or nonblank signed
  installation context, and require wrappers to configure exactly one fixed or lookup token source.
  Callers that previously omitted a token source must now pass `expectedWebhookAuthToken` to the raw
  verifier or configure one fixed/lookup source on the wrapper.
- Validate `ClockifyAddonClient` `timeoutMs` as an integer from 1 through 2,147,483,647.
- Accept claim-derived API/report URLs only when they are absolute HTTPS URLs or canonical loopback
  HTTP URLs without credentials, query strings, or fragments; reject embedded credentials in direct
  client `backendUrl` configuration.
- Cancel discarded retry response bodies before backoff without letting cleanup failures replace the
  intended retry.
- Refresh `typescript-eslint` to 8.64 while retaining TypeScript 6 and Node 22 ambient types.

## 1.0.2 - 2026-07-13

- Add deterministic root release-tool lint, formatting, and focused registry verification tests.
- Tolerate bounded npm propagation delay after publication while keeping release preflight and
  registry failures fail-fast.
- Await Node and Express integration-test server shutdown and verify the focused suites repeatedly.
- Refresh compatible development tooling, keep TypeScript 6 and Node 22 ambient types, and pin the
  source-development floor to Node 22.13.0.
- Derive current release documentation checks from the two workspace manifests and synchronize
  maintainer guidance. This maintenance release does not change the public runtime API.

## 1.0.1 - 2026-07-12

- Correct post-publication security, architecture, and migration guidance.
- Add version-aware npm release preflight and exact-registry consumer verification.

## 1.0.0 - 2026-07-12

- Published `@apet97/clockify-addon-sdk` and `create-clockify-addon` as public npm packages.

- Made the root entrypoint runtime-neutral and added granular Node, Express, Fetch, client, and UI
  subpaths.
- Added draft-04 manifest validation, hardened browser responses, fail-closed public origins,
  encrypted installation storage with caller-qualified generation deletes, webhook idempotency
  leases, and stricter token profiles.
- Added Marketplace-specific add-on API transport and an exact-origin iframe bridge.
- Added `create-clockify-addon` with packed creator/SDK Node/Worker scaffold verification and
  Marketplace coverage documentation.
- Prevented duplicate manifest descriptors by making registrations reuse identical predeclared
  entries, initialize omitted schema-optional arrays, and reject conflicting same-path declarations
  before router or manifest mutation.
- Added strict creator parsing for Node/Worker and minimal/all variants, split import-safe add-on
  construction from runtime bootstraps, shipped typed ESM declarations and a real workspace test,
  and made the packed scaffold gate execute all four variants plus Worker Wrangler dry-runs.
- Aligned malformed Node and Fetch `Content-Length` handling at HTTP 400 without error reporting,
  applied declared-length checks to every Fetch method, preserved repeated leading slashes through
  Node and Express-fallback request parsing, rejected custom overrides of SDK-managed CSP
  directives, and constructed JSON headers directly.
- Documented that Clockify `DELETED` payloads carry no installation generation, so unqualified
  uninstall cleanup is unconditional even though the store supports caller-qualified guards.
- Recorded the final-SHA `e74e1f7` authenticated install, component, webhook, and uninstall receipt,
  including exact developer-workspace iframe-origin enforcement and complete disposable cleanup.

- Added Express adapter coverage for array-valued query params and primitive response bodies.
- Added Clockify add-on registration coverage for schema-valid manifests whose optional descriptor
  arrays are absent.
- Added Node `http` adapter preflight rejection for requests whose declared `content-length`
  exceeds `maxBodyBytes`, matching Fetch adapter body-limit behavior before routing.
- Added router coverage and docs for exact path matching: child paths such as `/hooks/abc` do not
  match a handler registered at `/hooks`.
- Updated SDK dev tooling for the accepted ESLint, Prettier, and Vite Dependabot lane.
- Added verified request wrapper helpers for component, lifecycle, installed lifecycle, and webhook
  handlers.
- Added typed structured-setting helper creators for the common Clockify setting types.
- Added release readiness documentation and package metadata checks.

- Provides typed Clockify manifest builders for schema versions 1.2, 1.3, 1.4, and 1.5.
- Provides a framework-neutral add-on router plus Node `http`, Express-like, and Fetch adapters.
- Provides RS256 Clockify token verification helpers, lifecycle payload guards, vendored manifest
  schema provenance, generated-output drift checks, package consumer smoke tests, and source package
  docs.
