# @apet97/clockify-addon-sdk

TypeScript SDK for the server side of a Clockify add-on — typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification.

- [`addon-sdk/`](./addon-sdk) — the source-only package. See its [README](./addon-sdk/README.md) for local installation and usage.
- [`docs/`](./docs) — product surface and quality gates for the package.
- [`addon-sdk/schemas/clockify-manifests/`](./addon-sdk/schemas/clockify-manifests) — vendored
  manifest schemas 1.2–1.5 plus provenance hashes used by `npm run verify:generated`.
- [`MARKETPLACE_DOCS/`](./MARKETPLACE_DOCS) — Clockify's published add-on documentation, kept for reference.

Runtime support starts at Node 22. The GitHub Actions matrix verifies Node 22.x and 24.x.

Primary repo gate from the root:

```bash
npm run ci:verify
```

Manual live schema freshness check:

```bash
npm run verify:schema-live
```

The package is not published to the npm registry yet; use this repository as the source of truth and
pack a local tarball when you need to install it into another project.

Independent, unofficial project — not affiliated with, endorsed by, or supported by Clockify or CAKE.com.
