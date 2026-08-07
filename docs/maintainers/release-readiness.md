# Release Readiness

This maintainer record owns exact published versions, release procedures, and evidence receipts.
Historical receipts below prove only the source SHA and environment they name.

## Published versions

The latest registry publication is:

- `@apet97/clockify-addon-sdk@1.0.5`
- `create-clockify-addon@1.0.5`

Install the SDK with `npm install @apet97/clockify-addon-sdk` or create a project with
`npm create clockify-addon@latest`. npm versions are immutable: every future release requires a
version change and explicit npm-owner approval for that exact publish attempt.

## Documentation-only maintenance boundary

When a documentation-only pass leaves the already published workspace versions unchanged, run the
deterministic gate and the live schema check separately:

```bash
npm run ci:verify
npm run verify:schema-live
```

Do not run `npm run release:verify` for that pass. It ends with `release:dry-run`, whose registry
check must reject immutable versions that are already published. Documentation verification does
not create a new release candidate, registry receipt, authenticated Clockify receipt, or Marketplace
submission evidence.

## 1.1.0 release candidate

Workspace versions `@apet97/clockify-addon-sdk@1.1.0` and `create-clockify-addon@1.1.0` are prepared
on branch `perfect-state-2026-08-06`. Publication requires explicit npm-owner approval for the exact
packages and versions; until that approval and the publish itself complete, the "Published versions"
section above remains the accurate record of what the registry currently serves.

`npm run release:preflight` confirmed both exact versions are absent from the registry.
`npm run release:verify` (`ci:verify && verify:schema-live && release:dry-run`) now **passes end to
end**:

- `ci:verify` passes with 480 tests, thresholded coverage, lint, format, build, the public API
  snapshot, `verify:dist`, `pack:dry-run`, package-lint, package-consumer, all four packed
  Node/Worker scaffolds (including real `workerd` routes), and both `npm audit --omit=dev` and the
  full-tree `npm audit` (0 vulnerabilities each; the production dependency tree remains `jose`
  alone). The three pre-existing transitive dev-tooling advisories (`brace-expansion`, `fast-uri`,
  `postcss`) were resolved by `npm audit fix`: each moved by a patch version within its existing
  major (confirmed against `package-lock.json`), touching neither `typescript` nor `@types/node`.
- `verify:schema-live` passes: Clockify's live schema endpoint serves a genuine, distinct schema
  `1.6` (own `$schema`/`definitions`, not an echo of `1.5`). Structural diff against vendored `1.5`
  showed it is additive-only — one new webhook event (`TIME_OFF_REQUEST_STARTED`) and one new
  component type (`timeentries.action.uiblocks`), no required/removed/changed fields. `1.6` is now
  vendored with provenance, and the generated builders/validators cover it; the unsupported-version
  probe moved to `1.7` (confirmed HTTP 400 against the live endpoint).
- `npm run release:dry-run` passed for both packages; both tarball contents matched the "Expected
  package shape" section below.

Any future `src/**` change (as opposed to a documentation-only pass) requires a fresh live receipt
— an authenticated install exercising installation, component authentication, webhook delivery, and
uninstall cleanup — before that release counts as Marketplace-proven; see the Future release
checklist below. This candidate does not yet have a 1.1.0 live receipt.

A later pass on the same branch added `withClockifyHandler()` (a unified additive alternative to
the `withClockify*` wrappers, P2.6), narrowed generated `Record<string, any>` `options` fields to
`Record<string, unknown>` across schema versions 1.2–1.6 (P2.11), added `@deprecated`
`verifyComponentToken`/`verifyLifecycleToken`/`verifyWebhookToken` naming aliases (P2.12), and
renamed `addon-sdk/examples/` to `addon-sdk/snippets/` with README documentation as copy-in
reference code rather than runnable projects (P4.1). All four are additive or documentation-only;
none change a canonical export's name or signature. `npm run release:verify` was re-run and passed
end to end after this pass, confirmed twice in a row to rule out a flake.

A further documentation-only pass refreshed all 13 `MARKETPLACE_DOCS/` snapshots from a 2026-08-07
re-scrape of Clockify's developer docs, added the previously-uncaptured `14-manifest.md`, fixed a
wire-header naming defect in `addon-sdk/docs/api-reference.md`'s P2.6 mapping table introduced by
the prior pass, and removed `docs/superpowers/**` and an orphaned stale `docs/product-surface.json`
that were not customer-facing. No `src/**` change; `npm run ci:verify` passed end to end
afterward.

## 1.0.5 release evidence

Release source commit `d46723956b9b5ff7fb5587bdc03fc8858c90113f` reorganizes the active
documentation around the builder journey, replaces runtime AJV compilation with generated
standalone validators, and executes all four packed Node/Worker scaffolds, including real `workerd`
routes. It also hardens detached-process cleanup and syntax-aware runtime inspection.

Before publication, `npm run release:verify` passed with 46 test files and 435 tests, thresholded
coverage, package/scaffold execution, live schema parity, zero-vulnerability production and full
audits, and both publish dry runs. SDK CI run
[`29324693717`](https://github.com/apet97/addon-ts-sdk/actions/runs/29324693717) then passed on Node
22.13.0 and Node 24.x.

The exact artifacts were published in SDK-first order with these immutable registry digests:

- `@apet97/clockify-addon-sdk@1.0.5`: SHA-1
  `853a6701dfc53df18fa9086f04c08d5fda6904f8`; SHA-512
  `sha512-CeWpMkPPDvke9hGYc211Hol3l4tbTgBkK7OR/QPgYUitffLLBisEsZ0dbvL8e7L/4kcY4U5+gm7MSSd2ZxTB0Q==`
- `create-clockify-addon@1.0.5`: SHA-1
  `770f864ba8ed67d2954cd486ec4231c474d41e63`; SHA-512
  `sha512-gNaRwuek8M+sH0XI4fwwUcdXvNiqffmjOtCud8E8FvosIy0pgdkZfrs2JSOyFRPvArtoH+3YhG4kPRl404NDVQ==`

Post-publication `npm run verify:registry` passed from an isolated empty npm cache and executed both
exact public versions. Both `latest` tags resolve to 1.0.5. The authenticated 1.0.3
developer-workspace receipt remains historical evidence for that exact release source; 1.0.5 makes
no new Marketplace lifecycle claim. No Git tag or Marketplace submission was created.

## 1.0.4 release evidence

Release source commit `0e2fde5a49e8d6860961339b7945ba6d2a177c07` corrects direct-client retry
fallback when `Retry-After` is missing or blank, rejects empty and dot-only API path segments before
fetch/retry handling, and aligns direct HTTP loopback configuration with the SDK's canonical-host
policy while rejecting noncanonical raw spellings. The loopback hostname set is owned by one private
runtime-neutral helper. No public declaration or creator scaffold contract changed.

Before publication, `npm run release:verify` passed with 39 test files and 335 tests, thresholded
coverage, package/scaffold execution, live schema parity, zero-vulnerability production and full
audits, and both publish dry runs. SDK CI run `29305622131` then passed on Node 22.13.0 and Node 24.x.

The packages were published in SDK-first order and retained the SHA-1 values from the verified dry
runs:

- `@apet97/clockify-addon-sdk@1.0.4`: `3442f2cf37f1d058fba8f82ad051227f90647e0a`
- `create-clockify-addon@1.0.4`: `879475363645aaa534a60630285d6af3b8f378ee`

Post-publication `npm run verify:registry` passed from an isolated empty npm cache and executed both
exact public versions. Both `latest` tags resolve to 1.0.4. The authenticated 1.0.3
developer-workspace receipt remains historical evidence for that exact release source; 1.0.4 makes
no new Marketplace lifecycle claim. No Git tag or Marketplace submission was created.

## 1.0.3 release evidence

Release source commit `303f9c6a732707b572f418b592e75575811a7447` hardens webhook token/context
verification, client timeout and URL boundaries, and discarded retry-response cleanup, and includes
the `typescript-eslint` 8.64 maintenance update. TypeScript remains on major 6.

Before publication, `npm run release:verify` passed with 39 test files and 316 tests, thresholded
coverage, package/scaffold execution, live schema parity, zero-vulnerability production and full
audits, and both publish dry runs. SDK CI run `29299563485` then passed on Node 22.13.0 and Node 24.x.

The exact tarballs used for the authenticated developer-workspace pass were published in SDK-first
order and retained these npm SHA-1 values:

- `@apet97/clockify-addon-sdk@1.0.3`: `933248cf9f3b4cfc3b66391a61615dcd3518591b`
- `create-clockify-addon@1.0.3`: `c18c65a9ffcd4fc1003b86cfb7fd0d6d5c1531b7`

Post-publication `npm run verify:registry` installed and executed both exact public versions. The
fresh live receipt is recorded in `docs/maintainers/marketplace-coverage.md`. No Git tag or
Marketplace submission was created.

## Future release checklist

Run these commands from the repository root:

```bash
npm ci
npm run release:preflight
npm run release:verify
```

`npm run release:preflight` reads both workspace package versions and fails unless those exact
versions are absent from the configured npm registry. It is intentionally a one-shot, fail-fast
check and must run immediately before publishing.

Any release whose source changed under `src/**` since the last live receipt requires a fresh one —
an authenticated install exercising installation, component authentication, webhook delivery, and
uninstall cleanup — before that release counts as Marketplace-proven; see the Publish boundary
below. A documentation-only release (no `src/**` change) may stay registry-only and reuse the prior
live receipt as evidence for the underlying runtime.

Run `release:verify` only for unpublished workspace versions. After publication,
`release:dry-run` correctly fails when npm reaches its immutable-version registry check; use
`verify:registry` instead for post-publish proof. Run the preflight first so an accidental reused
version fails quickly, before the more expensive local release gates.

`npm run release:verify` runs the canonical `npm run ci:verify` gate, including the public API
snapshot check, the manual `npm run verify:schema-live` freshness check, and the dry-run publish
checks. `verify:schema-live` depends on Clockify's live manifest schema endpoint, so keep it out of
deterministic CI. Dry runs print package contents and registry checks without uploading anything.
The version-aware preflight is also network-dependent and remains a separate manual release-boundary
command rather than part of `ci:verify` or `release:verify`.

The final dry-run publish commands remain separate for the SDK and creator packages:

```bash
npm publish --dry-run -w @apet97/clockify-addon-sdk --access public
npm publish --dry-run -w create-clockify-addon --access public
```

## Publish boundary

Before publishing a new version, confirm all of these are true:

- The working tree is clean after `npm run release:verify`.
- `addon-sdk/public-api.snapshot.md` matches the built declarations.
- `npm whoami` identifies the intended owner account, and that owner has given explicit npm-owner
  approval for the exact package name, version, and publish command.
- The new versions do not already exist in the npm registry.
- The person publishing understands that the SDK supports ESM and CommonJS consumers while the
  creator's programmatic export is ESM-only.
- A fresh authenticated developer-workspace pass has accepted the generated manifest and exercised
  installation, component authentication, webhook delivery, and uninstall cleanup before any
  Marketplace-readiness claim.

When both packages change, publish the SDK first because generated projects depend on it. Publish
the creator only after the SDK upload succeeds. Do not retry a package whose publish already
succeeded.

After publishing, smoke-test both exact registry artifacts from a temporary consumer outside this
repository:

```bash
npm run verify:registry
```

`verify:registry` reads the exact versions from both workspace manifests and allows up to seven
registry visibility checks separated by five-second waits before installing those exact versions in
a disposable consumer. Progress lists only package names and versions still absent from valid npm
metadata. HTTP errors, timeouts, aborts, invalid JSON, and malformed metadata fail immediately; the
retry is only for normal post-publish propagation. The command then exercises SDK ESM, CommonJS, and
TypeScript imports; imports the creator API; runs the installed creator's help command; and uses the
version-pinned canonical `npm create` flow to generate a Node minimal project. The generated project
must resolve the exact SDK version, type-check, serve a schema-valid manifest with one component and
no lifecycle/webhook descriptors, return 404 for an unknown path, reject an unsigned component
request, and fail closed without a public origin. The command always removes its temporary files. Do
not treat a dry-run publish as registry installation proof.

## Final-SHA manual checkpoint

On 2026-07-12, an authenticated Firefox developer-workspace pass at final runtime commit
`e74e1f7c1b307791b485f0a25b10a0df0fe7e725` accepted a packed Node all-features scaffold, delivered
the `INSTALLED` lifecycle and `NEW_TIME_ENTRY` webhook, rendered the signed component with the exact
developer parent origin, and delivered `DELETED` during uninstall. The disposable two-hour entry,
installation, tunnel, server, proxy, and temporary files were removed. See
`docs/maintainers/marketplace-coverage.md` for the sanitized route/status receipt. This proves that
exact runtime SHA, not future changes or a Marketplace submission.

## Expected package shape

The SDK dry-run package should include only its npm-generated `package.json` plus:

- `dist`
- `docs`
- `schemas/clockify-manifests`
- `LICENSE`
- `README.md`

The creator dry-run package should include only its npm-generated `package.json` plus:

- `bin`
- `src` (including the programmatic declaration)
- `LICENSE`
- `README.md`

Neither package should include `node_modules`, `coverage`, temporary tarballs, workspace root files,
or generated proof artifacts.

## Historical 1.0.2 maintenance record

The deferred non-security maintenance queue was completed in the published 1.0.2 release:

- The canonical lint and format gates now cover every root release tool, with focused tests for
  registry behavior and command boundaries.
- Post-publish verification retries only exact-version absence for a bounded 30-second propagation
  window; preflight and registry failures remain fail-fast.
- Node and Express integration tests await server shutdown. Fifty consecutive focused suite runs
  did not reproduce the historical `/manifest` 404, so no unproven production cause is claimed.
- Compatible patch/minor tooling updates landed while TypeScript remains on major 6 and
  `@types/node` remains on major 22. Dependabot now excludes those unsupported majors.
- Active documentation is version-neutral except for this canonical published-version record, and
  tests derive both package versions independently from their workspace manifests.
