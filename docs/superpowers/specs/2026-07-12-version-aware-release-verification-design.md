# Version-Aware Release Verification Design

## Goal

Keep repository documentation truthful after the first npm publication and make the pre-publish
and post-publish registry checks executable for every future version without editing hard-coded
`1.0.0` commands.

## Scope

This change will:

- correct current repository documents that still describe the packages as unpublished or
  source-only;
- add a `release:preflight` root command that reads the SDK and creator names and versions directly
  from their workspace manifests and fails when either exact version already exists in the
  configured npm registry;
- add a `verify:registry` root command that reads the same manifest versions, confirms both exact
  versions exist, installs them from the configured registry into a temporary consumer, and proves
  the supported installed-package behavior;
- add deterministic tests for version discovery, registry-state classification, command wiring,
  and documentation truth;
- update maintainer and release documentation without changing the published `1.0.0` artifacts.

Publishing another npm version, creating a tag or GitHub Release, changing authentication or CI
permissions, submitting to Marketplace, and changing SDK runtime behavior remain out of scope.

## Command Contract

Two explicit root commands will own the release boundary:

```bash
npm run release:preflight
npm run verify:registry
```

Both commands derive package names and versions from `addon-sdk/package.json` and
`create-clockify-addon/package.json`. They do not accept a version that can drift from those
manifests. They honor `npm_config_registry` or `NPM_CONFIG_REGISTRY`, falling back to the public npm
registry, so tests and private mirrors can use the same code path.

`release:preflight` is intentionally not part of `ci:verify` or `release:verify`. The current
published `1.0.0` workspaces should make it fail until a maintainer intentionally bumps the relevant
package versions. A successful result means every exact workspace version is absent; registry
outages, malformed metadata, and unexpected HTTP statuses are errors rather than evidence that a
version is available.

`verify:registry` is also outside deterministic CI because it requires published artifacts and live
registry access. It succeeds only when both exact workspace versions are present and the complete
temporary-consumer probe passes.

## Registry State

`scripts/release-preflight.mjs` will own the small shared registry-state layer. It will export
version discovery and registry-query helpers for deterministic tests, and it will execute the
unpublished-version assertion only when invoked directly.

For each workspace package it will request package metadata from the configured registry and inspect
the `versions` object:

- HTTP 404 means no version of that package exists;
- HTTP 200 with the exact version absent means the workspace version is available;
- HTTP 200 with the exact version present means it is already published;
- any other status or invalid metadata fails closed with a package-specific error.

The preflight reports all conflicting package/version pairs in one failure so maintainers do not
have to fix them one at a time.

## Registry Consumer Proof

`scripts/verify-registry-consumer.mjs` will import the shared version and registry helpers, require
both exact versions to be published, and then work only inside a fresh operating-system temporary
directory. It will always remove that directory in `finally`.

The probe will:

1. create a private temporary ESM consumer;
2. install the exact SDK and creator versions, plus only the development tools required to
   type-check the consumer;
3. import the SDK root and a runtime subpath as ESM;
4. require the SDK root and Node adapter as CommonJS;
5. import the creator's ESM programmatic API;
6. type-check a consumer that references both packages;
7. run the installed creator's `--help` command;
8. invoke the canonical `npm create clockify-addon@<creator-version>` flow for a Node/minimal
   project;
9. install that project and assert it resolved the exact SDK version;
10. type-check and boot the generated runtime;
11. validate `/manifest`, its exact one-component/zero-lifecycle/zero-webhook counts, 404 handling,
    unsigned component rejection, and fail-closed missing production configuration.

No request headers, queries, bodies, credentials, or registry authentication details are persisted
by the probe.

## Documentation Corrections

The repository documentation will distinguish published state from historical migration context:

- `SECURITY.md` will identify the current npm `latest` release as the supported published version
  and ask reports to include an npm version or commit.
- `docs/pre-release-migration.md` will describe the adapter change as a historical step completed
  before `1.0.0`, rather than claiming publication has not happened.
- `docs/architecture.md` will call `/adapters` a legacy aggregate for package consumers, not source
  users.
- `docs/release-readiness.md` will retain the historical published-version section but replace
  hard-coded future `npm view ...@1.0.0` commands with `release:preflight` and `verify:registry`.
- `docs/quality-gates.md`, `README.md`, `AGENTS.md`, and `CLAUDE.md` will document the two manual
  commands and keep deterministic versus network-dependent proof explicit.
- `CHANGELOG.md` will gain an `Unreleased` section for these post-`1.0.0` repository changes.

`AGENTS.md` and `CLAUDE.md` remain identical except for their heading and introduction.

## Tests

Tests will be written before implementation and must first fail on the missing behavior.

- The distribution-documentation suite will read every current publication-status document named
  above and reject the stale unpublished/source-only claims.
- The same suite will require both root command names and version-aware release guidance.
- A focused registry-state suite will use a local HTTP server to prove absent package, absent exact
  version, existing exact version, registry failure, and malformed-metadata behavior without
  contacting npm.
- CLI-focused tests will prove that `release-preflight.mjs --help` is side-effect free and that an
  unsupported argument fails before any registry request.
- The existing creator, package-consumer, scaffold, API-snapshot, coverage, audit, and formatting
  gates remain unchanged.

After the focused tests pass, verification will run:

```bash
npm run ci:verify
npm run verify:schema-live
npm run release:dry-run
npm run verify:registry
npx madge@8 --extensions ts --circular addon-sdk/src
git diff --check
```

`npm run release:preflight` must fail at the current `1.0.0` manifests and explicitly report both
already-published versions. That expected failure is the proof that the guard is live; it is not a
red repository gate.

## Delivery

Implementation will use focused commits and leave the worktree clean. No remote push is implied by
this design; pushing, tagging, or publishing requires a separate explicit request.
