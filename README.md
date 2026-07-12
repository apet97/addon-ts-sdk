# @apet97/clockify-addon-sdk

TypeScript SDK for the server side of a Clockify add-on — typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification.

- [`addon-sdk/`](./addon-sdk) — the public `@apet97/clockify-addon-sdk` package. See its
  [README](./addon-sdk/README.md) for installation and usage.
- [`create-clockify-addon/`](./create-clockify-addon) — the public creator for executable
  Node/Worker minimal/all scaffolds.
- [`docs/`](./docs) — product surface and quality gates for the package.
- [`docs/release-readiness.md`](./docs/release-readiness.md) — future-release procedure and
  current publication evidence.
- [`addon-sdk/schemas/clockify-manifests/`](./addon-sdk/schemas/clockify-manifests) — vendored
  manifest schemas 1.2–1.5 plus provenance hashes used by `npm run verify:generated`.
- [`MARKETPLACE_DOCS/`](./MARKETPLACE_DOCS) — Clockify's published add-on documentation, kept for reference.

Runtime support starts at Node 22. The GitHub Actions matrix verifies Node 22.x and 24.x.

Install the SDK or create a project from npm:

```bash
npm install @apet97/clockify-addon-sdk
npm create clockify-addon@latest ./my-addon -- --runtime node --features all
```

Primary repo gate from the root:

```bash
npm run ci:verify
```

Release readiness check from the root:

```bash
npm run release:verify
```

This runs the canonical `ci:verify` gate, the manual live schema freshness check, and both dry-run
publish checks. The repository remains the source of truth for development and unreleased changes.

Independent, unofficial project — not affiliated with, endorsed by, or supported by Clockify or CAKE.com.
