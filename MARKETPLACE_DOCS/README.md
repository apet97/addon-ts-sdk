# Captured Marketplace Documentation

The numbered files in this directory are captured upstream snapshots, not repository-authored
builder documentation. Their source URLs and content hashes are recorded in
[`provenance.json`](provenance.json).

Run `npm run verify:marketplace-docs` to check every captured file against that provenance. The
implementation is [`scripts/verify-marketplace-docs.mjs`](../scripts/verify-marketplace-docs.mjs).
Do not edit a numbered snapshot without an intentional upstream refresh and reviewed provenance
update.

For the current SDK journey and ownership model, read
[How an add-on works](../docs/how-an-addon-works.md).
