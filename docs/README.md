# Documentation

## Start here

- [Getting started](getting-started.md)
- [How an add-on works](how-an-addon-works.md)

## Builder task guides

- [Manifest and registration](guides/manifest-and-registration.md)
- [Installation and storage](guides/installation-and-storage.md)
- [Components and UI](guides/components-and-ui.md)
- [Webhooks and idempotency](guides/webhooks-and-idempotency.md)
- [Calling Clockify](guides/calling-clockify.md)
- [Deployment and operations](guides/deployment-and-operations.md)
- [Troubleshooting](guides/troubleshooting.md)

## Package entry points

- [SDK package README](../addon-sdk/README.md) — installation, imports, runtime adapters, testing,
  schemas, and package reference navigation.
- [Creator package README](../create-clockify-addon/README.md) — CLI options, all four scaffold
  variants, generated layout, configuration, and first-run commands.
- [API reference](../addon-sdk/docs/api-reference.md) — public entry points and exported contracts.

Every generated project also includes a runtime- and feature-aware README with its local commands,
configuration, request flow, and production storage checklist.

## Contributing and security

- [Contributor guide](../CONTRIBUTING.md) — setup, focused verification, generated-file boundaries,
  documentation ownership, commit scope, and publication restrictions.
- [Security policy](../SECURITY.md) — private reporting, supported releases, application-owned
  controls, and security guidance.

## Maintainers

- [Maintainer documentation](maintainers/README.md) — architecture, product boundaries, quality
  gates, release and Marketplace evidence, migration history, and Java parity.

## Upstream, generated, and historical material

- [`MARKETPLACE_DOCS/`](../MARKETPLACE_DOCS/README.md) is the preserved upstream Marketplace
  snapshot and provenance source. It is not authored builder documentation.
- `addon-sdk/public-api.snapshot.md` is generated API-surface evidence checked by repository gates;
  do not edit it by hand.
- Ignored local working notes such as `GOAL.md` and `verification_report.md` are not repository
  documentation, are not tracked in Git, and are not part of this index. Past session planning and
  design records are kept out of the shipped repository rather than tracked as historical material.

Run `npm run verify:docs` after active authored Markdown changes. It checks local links and anchors,
required builder navigation, documentation ownership contracts, and configured stale claims without
treating upstream snapshots, generated evidence, historical material, or ignored local notes as
active documentation.
