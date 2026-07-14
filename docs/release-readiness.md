# Release Readiness

## Published versions

The latest registry publication is:

- `@apet97/clockify-addon-sdk@1.0.3`
- `create-clockify-addon@1.0.3`

Install the SDK with `npm install @apet97/clockify-addon-sdk` or create a project with
`npm create clockify-addon@latest`. npm versions are immutable: every future release requires a
version change and explicit npm-owner approval for that exact publish attempt.

## 1.0.4 release candidate

The workspace release candidates are:

- `@apet97/clockify-addon-sdk@1.0.4`
- `create-clockify-addon@1.0.4`

This patch corrects direct-client retry fallback when `Retry-After` is missing or blank, rejects
empty and dot-only API path segments before fetch/retry handling, and aligns direct HTTP loopback
configuration with the SDK's canonical-host policy while rejecting noncanonical raw spellings. The
loopback hostname set is now owned by one private runtime-neutral helper. No public declaration or
creator scaffold contract changes.

The authenticated 1.0.3 developer-workspace receipt remains historical evidence for that exact
release source. This candidate makes no new Marketplace lifecycle claim; npm publication evidence
must be recorded only after the exact registry artifacts are uploaded and executed.

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
fresh live receipt is recorded in `docs/marketplace-coverage.md`. No Git tag or Marketplace
submission was created.

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
`docs/marketplace-coverage.md` for the sanitized route/status receipt. This proves that exact
runtime SHA, not future changes or a Marketplace submission.

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
