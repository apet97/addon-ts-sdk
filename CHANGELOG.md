# Changelog

All notable changes to this source-only SDK are recorded here.

## Unreleased

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
