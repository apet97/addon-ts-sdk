# Release Readiness

This package remains source-only and is not published to the npm registry. Use this checklist only
to prove that the package is ready for an intentional future release.

Do not run a real npm publish from this repository unless the project owner explicitly decides to
release the package and gives explicit npm-owner approval for that exact publish attempt.

## Dry-run checklist

Run these commands from the repository root:

```bash
npm ci
npm run release:verify
```

`npm run release:verify` runs the canonical `npm run ci:verify` gate, including the public API
snapshot check, the manual `npm run verify:schema-live` freshness check, and the dry-run publish
check. `verify:schema-live` depends on Clockify's live manifest schema endpoint, so keep it out of
deterministic CI. The final publish step is a dry run only: it should print the package contents and
registry checks without uploading anything.

The final dry-run publish commands remain separate for the SDK and creator packages:

```bash
npm publish --dry-run -w @apet97/clockify-addon-sdk --access public
npm publish --dry-run -w create-clockify-addon --access public
```

## Real publish boundary

Before a real first publish, confirm all of these are true:

- The working tree is clean after `npm run release:verify`.
- `addon-sdk/public-api.snapshot.md` matches the built declarations.
- The package owner with npm publish rights has approved the exact package name, version, and
  publish command.
- The person publishing understands that the SDK supports ESM and CommonJS consumers while the
  creator's programmatic export is ESM-only.
- A fresh authenticated developer-workspace pass has accepted the generated manifest and exercised
  installation, component authentication, webhook delivery, and uninstall cleanup before any
  Marketplace-readiness claim.

Only after a real publish succeeds, smoke-test the registry artifact from a temporary consumer
outside this repository:

```bash
npm view @apet97/clockify-addon-sdk version
```

Then install the just-published version in a fresh ESM/CJS/TypeScript consumer and import the root,
`/clockify`, `/adapters`, `/testing`, and schema JSON subpaths. Do not treat a dry-run publish as
registry installation proof.

Only after `create-clockify-addon` is actually present in the registry should documentation promote
`npm create clockify-addon`; until then, use the repository-local creator entrypoint.

## Historical manual checkpoint

On 2026-07-12, an authenticated Firefox developer-workspace pass at
`bbaff21e494d5d92cd2da1e11d21938f61417d18` accepted a packed Node all-features scaffold, delivered
the `INSTALLED` lifecycle and `NEW_TIME_ENTRY` webhook, rendered the signed component with the exact
developer parent origin, and delivered `DELETED` during uninstall. The disposable entry,
installation, tunnel, server, and temporary files were cleaned up. See
`docs/marketplace-coverage.md` for the sanitized route/status receipt. This historical evidence
predates the current request-target, registration, Worker-start, and packed-creator changes. Repeat
the pass before any new Marketplace-readiness or release claim.

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
