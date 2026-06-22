# @apet97/clockify-addon-sdk

TypeScript SDK for the server side of a Clockify add-on — typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification.

- [`addon-sdk/`](./addon-sdk) — the package. See its [README](./addon-sdk/README.md) for installation and usage.
- [`docs/`](./docs) — product surface and quality gates for the package.
- [`addon-sdk/schemas/clockify-manifests/`](./addon-sdk/schemas/clockify-manifests) — vendored
  manifest schemas 1.2–1.5 plus provenance hashes used by `npm run verify:generated`.
- [`MARKETPLACE_DOCS/`](./MARKETPLACE_DOCS) — Clockify's published add-on documentation, kept for reference.

Primary package gate from `addon-sdk/`:

```bash
npm run type-check && npm run verify:generated && npm run test && npm run build && npm run verify:dist
npm pack --dry-run
npm audit --omit=dev --json
```

Independent, unofficial project — not affiliated with, endorsed by, or supported by Clockify or CAKE.com.
