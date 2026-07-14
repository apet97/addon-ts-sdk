# Changelog

All notable changes to this SDK are recorded here.

## Unreleased

- Reorganized active documentation into a builder-first journey with separate SDK reference and
  maintainer ownership boundaries.
- Added runtime- and feature-aware README output to generated creator projects.
- Added a repository documentation verifier for active links and anchors, required builder
  navigation, paired agent guidance, and configured stale claims.

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
