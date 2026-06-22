# Release Readiness

This package remains source-only and is not published to the npm registry. Use this checklist only
to prove that the package is ready for an intentional future release.

Do not run a real npm publish from this repository unless the project owner explicitly decides to
release the package.

## Dry-run checklist

Run these commands from the repository root:

```bash
npm ci
npm run ci:verify
npm run verify:schema-live
npm publish --dry-run -w @apet97/clockify-addon-sdk --access public
```

`npm run ci:verify` remains the canonical local and CI gate. `npm run verify:schema-live` is manual
because it depends on Clockify's live manifest schema endpoint. The final command is a dry run only:
it should print the package contents and registry publish checks without uploading anything.

## Expected package shape

The dry-run package should include only:

- `dist`
- `docs`
- `schemas/clockify-manifests`
- `LICENSE`
- `README.md`

The package should not include `node_modules`, `coverage`, temporary tarballs, workspace root files,
or generated proof artifacts.
