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

The final dry-run publish command remains:

```bash
npm publish --dry-run -w @apet97/clockify-addon-sdk --access public
```

## Real publish boundary

Before a real first publish, confirm all of these are true:

- The working tree is clean after `npm run release:verify`.
- `addon-sdk/public-api.snapshot.md` matches the built declarations.
- The package owner with npm publish rights has approved the exact package name, version, and
  publish command.
- The person publishing understands that the package currently has both ESM and CommonJS consumers.

Only after a real publish succeeds, smoke-test the registry artifact from a temporary consumer
outside this repository:

```bash
npm view @apet97/clockify-addon-sdk version
```

Then install the just-published version in a fresh ESM/CJS/TypeScript consumer and import the root,
`/clockify`, `/adapters`, `/testing`, and schema JSON subpaths. Do not treat a dry-run publish as
registry installation proof.

## Expected package shape

The dry-run package should include only:

- `dist`
- `docs`
- `schemas/clockify-manifests`
- `LICENSE`
- `README.md`

The package should not include `node_modules`, `coverage`, temporary tarballs, workspace root files,
or generated proof artifacts.
