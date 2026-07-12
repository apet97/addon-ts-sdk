# Release Readiness

## Published versions

The public npm releases are:

- `@apet97/clockify-addon-sdk@1.0.0`
- `create-clockify-addon@1.0.0`

Install the SDK with `npm install @apet97/clockify-addon-sdk` or create a project with
`npm create clockify-addon@latest`. npm versions are immutable: every future release requires a
version change and explicit npm-owner approval for that exact publish attempt.

## Future release checklist

Run these commands from the repository root:

```bash
npm ci
npm run release:verify
```

`npm run release:verify` runs the canonical `npm run ci:verify` gate, including the public API
snapshot check, the manual `npm run verify:schema-live` freshness check, and the dry-run publish
checks. `verify:schema-live` depends on Clockify's live manifest schema endpoint, so keep it out of
deterministic CI. Dry runs print package contents and registry checks without uploading anything.

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
npm view @apet97/clockify-addon-sdk@1.0.0 version
npm view create-clockify-addon@1.0.0 version
```

Install the just-published SDK in fresh ESM/CJS/TypeScript consumers and import the root,
`/clockify`, `/adapters`, `/testing`, and schema JSON subpaths. Install the creator, import its ESM
API, run its help command, and generate a project that installs, type-checks, and executes. Do not
treat a dry-run publish as registry installation proof.

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
