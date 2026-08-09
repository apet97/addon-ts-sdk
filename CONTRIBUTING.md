# Contributing

## Prerequisites and setup

Use Node 22.13.0 or newer for source development and published-package use. Make changes on a topic
branch or isolated worktree, then install the locked workspace exactly:

```bash
npm ci
```

The SDK and creator are separate npm workspaces. Run commands from the repository root unless a
guide says otherwise.

## Work in focused loops

Start with the narrowest test that covers the behavior you are changing:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/<file>.test.ts
```

Run `npm run verify:docs` after authored Markdown changes. Run `npm run ci:verify` before requesting
review; it is the canonical deterministic repository gate and includes type-checking, generated
drift, documentation checks, coverage, lint, formatting, builds, package and scaffold proof, and
audits.

## Generated and public surfaces

- Never edit `addon-sdk/src/clockify/generated/**` directly. Change the vendored schema or generator,
  update provenance deliberately, run `npm run generate -w @apet97/clockify-addon-sdk`, and review
  the generated diff.
- Update `addon-sdk/public-api.snapshot.md` only for an intentional public declaration change by
  building first, then running
  `npm run verify:public-api -w @apet97/clockify-addon-sdk -- --update` and reviewing the snapshot.
- Preserve `addon-sdk/THIRD_PARTY_NOTICES.md` when static validator generation changes. The packed
  consumer gate verifies that the required notices ship.
- Do not edit numbered `MARKETPLACE_DOCS/**` snapshots as if they were authored documentation.

## Documentation ownership

- Builder work belongs in `docs/getting-started.md`, `docs/how-an-addon-works.md`, and
  `docs/guides/**`.
- Package and API reference belongs in `addon-sdk/README.md`, `addon-sdk/docs/**`, and
  `create-clockify-addon/README.md`.
- Architecture, quality, publication, live evidence, migration, and parity records belong in
  `docs/maintainers/**`.
- Generated project README changes belong in the creator template source, not temporary scaffold
  output. Historical and ignored local execution notes are not active repository documentation.

Keep `AGENTS.md` and `CLAUDE.md` identical after their distinct four-line introductions. The docs
gate checks that contract, local links and anchors, required builder navigation, and configured stale
claims.

## Commit and publication boundaries

Keep commits scoped to one concern and include focused regression coverage plus user-visible docs
when behavior changes. Do not commit build output, coverage, tarballs, credentials, private keys,
tokens, live Clockify payloads, or unrelated working-tree changes. Run `git diff --check` before
committing.

Contribution verification does not authorize a push or release. Do not change package versions,
publication settings, release credentials, or run `npm publish` without explicit npm-owner approval
for the exact packages and versions. Do not run `release:verify` against unchanged published
versions; its publish dry-run must enforce npm's immutable-version boundary.
