# Release Readiness

This package remains source-only and is not published to the npm registry. Use this checklist only
to prove that the package is ready for an intentional future release.

Do not run a real npm publish from this repository unless the project owner explicitly decides to
release the package.

## Dry-run checklist

Run these commands from the repository root:

```bash
npm ci
npm run release:verify
```

`npm run release:verify` runs the canonical `npm run ci:verify` gate, the manual
`npm run verify:schema-live` freshness check, and the dry-run publish check. `verify:schema-live`
depends on Clockify's live manifest schema endpoint, so keep it out of deterministic CI. The final
publish step is a dry run only: it should print the package contents and registry checks without
uploading anything.

The final dry-run publish command remains:

```bash
npm publish --dry-run -w @apet97/clockify-addon-sdk --access public
```

## Expected package shape

The dry-run package should include only:

- `dist`
- `docs`
- `schemas/clockify-manifests`
- `LICENSE`
- `README.md`

The package should not include `node_modules`, `coverage`, temporary tarballs, workspace root files,
or generated proof artifacts.
