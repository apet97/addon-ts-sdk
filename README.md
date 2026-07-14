<div align="center">

# Clockify Add-on SDK for TypeScript

A server-side SDK and executable Node/Worker scaffold for Clockify manifests, lifecycle events,
components, webhooks, and Marketplace-specific API calls.

<p>
  <a href="https://www.npmjs.com/package/@apet97/clockify-addon-sdk"><img alt="SDK npm version" src="https://img.shields.io/npm/v/%40apet97%2Fclockify-addon-sdk?label=SDK"></a>
  <a href="https://www.npmjs.com/package/create-clockify-addon"><img alt="Creator npm version" src="https://img.shields.io/npm/v/create-clockify-addon?label=creator"></a>
  <a href="https://github.com/apet97/addon-ts-sdk/actions/workflows/ci.yml"><img alt="SDK CI" src="https://github.com/apet97/addon-ts-sdk/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://www.npmjs.com/package/@apet97/clockify-addon-sdk"><img alt="Node.js support" src="https://img.shields.io/node/v/%40apet97%2Fclockify-addon-sdk"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/apet97/addon-ts-sdk"></a>
</p>

</div>

> Independent, unofficial project. Not affiliated with, endorsed by, or supported by Clockify or
> CAKE.com.

## Build your first add-on

1. `npm create clockify-addon@latest my-addon`
2. Configure `.env` and replace the manifest key.
3. Run the generated project and open `GET /manifest`.
4. Add the manifest URL in the Clockify developer workspace.

[Full getting-started guide](docs/getting-started.md)

## How a Clockify add-on works

`manifest -> INSTALLED -> component/webhook -> Clockify API -> DELETED`

[Lifecycle and responsibility model](docs/how-an-addon-works.md)

## What the SDK owns

This repository handles the **inbound add-on boundary**: manifests, signed component and lifecycle
requests, webhooks, settings, iframe integration, and runtime wiring. It is not a general-purpose
Clockify REST API client.

```text
Clockify request
  -> @apet97/clockify-addon-sdk verifies and routes it
  -> your add-on application persists credentials and runs business logic
```

| Capability             | SDK support                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Typed manifests        | Schema 1.5 builders and runtime validation                                                     |
| Verified requests      | RS256 component, lifecycle, and stored-token webhook verification with context checks          |
| Runtime adapters       | Node.js `http`, optional Express integration, and the standard Fetch API                       |
| Add-on services        | Claim-driven token exchange, structured settings transport, and generic authenticated requests |
| Installation workflows | Store contracts, encryption wrappers, lifecycle guards, and webhook idempotency leases         |
| Browser integration    | Hardened HTML/JSON responses and an exact-origin iframe bridge                                 |

Entity-specific Clockify REST APIs remain outside this package. See
[Product Surface](docs/product-surface.md) for the exact boundary.

## Packages and runtimes

| Package                                                                                  | Purpose                                                                                          | Distribution             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| [`@apet97/clockify-addon-sdk`](https://www.npmjs.com/package/@apet97/clockify-addon-sdk) | Manifests, routing, verification, adapters, storage contracts, client helpers, and UI primitives | ESM + CommonJS, Node 22+ |
| [`create-clockify-addon`](https://www.npmjs.com/package/create-clockify-addon)           | CLI and typed programmatic scaffolding for Node or Worker projects                               | ESM, Node 22+            |

The SDK root stays runtime-neutral. Host integrations are explicit:

| Runtime         | Import                                        |
| --------------- | --------------------------------------------- |
| Node.js HTTP    | `@apet97/clockify-addon-sdk/adapters/node`    |
| Express         | `@apet97/clockify-addon-sdk/adapters/express` |
| Fetch / Workers | `@apet97/clockify-addon-sdk/adapters/fetch`   |

For an existing project, install the SDK directly:

```bash
npm install @apet97/clockify-addon-sdk
```

## Documentation

- [Documentation index](docs/README.md)
- [Getting started](docs/getting-started.md)
- [How an add-on works](docs/how-an-addon-works.md)
- [SDK package guide](addon-sdk/README.md)
- [Creator CLI and programmatic API](create-clockify-addon/README.md)
- [API reference](addon-sdk/docs/api-reference.md)
- [Changelog](CHANGELOG.md)

## Verification and trust

The repository verifies what users install, not only workspace source:

- package linting checks both packed artifacts with publint and Are The Types Wrong;
- installed ESM, CommonJS, and TypeScript consumers import the packed SDK;
- all four Node/Worker and minimal/all-feature projects are generated and executed from tarballs;
- generated manifests are validated and failure paths are exercised;
- vendored schemas and public API declarations are checked for drift.

The canonical gate is:

```bash
npm ci
npm run ci:verify
```

For a future version, maintainers run `npm run release:verify` before publication and
`npm run verify:registry` afterward.

See [Quality Gates](docs/quality-gates.md), [Release Evidence](docs/release-readiness.md), and
[Marketplace Coverage](docs/marketplace-coverage.md) for the proof boundaries.

## Contributing

Source development requires Node 22.13.0 or newer. Start with:

```bash
npm ci
npm run verify:fast
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing generated models or public API, and use
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License and project status

MIT licensed. Clockify and CAKE.com are trademarks of their respective owners.
