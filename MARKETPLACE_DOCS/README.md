# Captured Marketplace Documentation

The numbered files in this directory are captured upstream snapshots, not repository-authored
builder documentation. Their source URLs and content hashes are recorded in
[`provenance.json`](provenance.json).

Run `npm run verify:marketplace-docs` to check every captured file against that provenance. The
implementation is [`scripts/verify-marketplace-docs.mjs`](../scripts/verify-marketplace-docs.mjs).
Do not edit a numbered snapshot without an intentional upstream refresh and reviewed provenance
update.

Cross-links inside a snapshot use the upstream site's own un-prefixed filenames (for example
`manifest.md`), not this directory's numbered local filenames. Those links will not resolve inside
this repository; use `provenance.json` or this directory's file listing to find the matching local
file.

For the current SDK journey and ownership model, read
[How an add-on works](../docs/how-an-addon-works.md).
