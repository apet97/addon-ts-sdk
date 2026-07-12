# Changelog

All notable changes to this source-only SDK are recorded here.

## Unreleased

- Made the root entrypoint runtime-neutral and added granular Node, Express, Fetch, client, and UI
  subpaths.
- Added draft-04 manifest validation, hardened browser responses, fail-closed public origins,
  encrypted installation storage with caller-qualified generation deletes, webhook idempotency
  leases, and stricter token profiles.
- Added Marketplace-specific add-on API transport and an exact-origin iframe bridge.
- Added `create-clockify-addon` with packed SDK Node/Worker scaffold verification and Marketplace
  coverage documentation.
- Prevented duplicate manifest descriptors by making registrations reuse identical predeclared
  entries and reject conflicting same-path declarations before router mutation.
- Added strict creator parsing for Node/Worker and minimal/all variants, split import-safe add-on
  construction from runtime bootstraps, and made the packed scaffold gate execute all four variants.
- Aligned malformed Node `Content-Length` handling with Fetch at HTTP 400 without error reporting,
  rejected custom overrides of SDK-managed CSP directives, and constructed JSON headers directly.
- Documented that Clockify `DELETED` payloads carry no installation generation, so unqualified
  uninstall cleanup is unconditional even though the store supports caller-qualified guards.
- Documented exact production versus developer-workspace iframe parent origins after a disposable
  authenticated install, component, webhook, and uninstall validation completed successfully.

- Added Express adapter coverage for array-valued query params and primitive response bodies.
- Removed unreachable manifest-array fallback branches from Clockify add-on registration helpers.
- Added Node `http` adapter preflight rejection for requests whose declared `content-length`
  exceeds `maxBodyBytes`, matching Fetch adapter body-limit behavior before routing.
- Added router coverage and docs for exact path matching: child paths such as `/hooks/abc` do not
  match a handler registered at `/hooks`.
- Updated SDK dev tooling for the accepted ESLint, Prettier, and Vite Dependabot lane.
- Added verified request wrapper helpers for component, lifecycle, installed lifecycle, and webhook
  handlers.
- Added typed structured-setting helper creators for the common Clockify setting types.
- Added dry-run release readiness documentation and package metadata checks.

## 1.0.0 Release Candidate

- Provides typed Clockify manifest builders for schema versions 1.2, 1.3, 1.4, and 1.5.
- Provides a framework-neutral add-on router plus Node `http`, Express-like, and Fetch adapters.
- Provides RS256 Clockify token verification helpers, lifecycle payload guards, vendored manifest
  schema provenance, generated-output drift checks, package consumer smoke tests, and source package
  docs.
