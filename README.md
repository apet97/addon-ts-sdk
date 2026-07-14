<div align="center">

# Clockify Add-on SDK for TypeScript

Build Clockify add-on backends with typed manifests, verified request handlers, and executable
Node.js or Cloudflare Worker scaffolds.

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

This repository handles the **inbound add-on boundary**: manifests, signed component and lifecycle
requests, webhooks, settings, iframe integration, and runtime wiring. It is not a general-purpose
Clockify REST API client.

## Start in 30 seconds

Create a fail-closed Node project with lifecycle and webhook routes:

```bash
npm create clockify-addon@latest ./my-addon -- --runtime node --features all
cd my-addon
cp .env.example .env
npm start
```

The generated README explains the required public origin, parent origin, and durable storage setup.
For an existing project, install the SDK directly:

```bash
npm install @apet97/clockify-addon-sdk
```

See the [SDK quick start](./addon-sdk/README.md#quick-start) or
[creator options](./create-clockify-addon/README.md) for the next step.

## What you get

| Capability             | Included                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Typed manifests        | Generated builders and runtime validation for Clockify manifest schemas 1.2–1.5                      |
| Verified requests      | RS256 component, lifecycle, and stored-token webhook verification with context checks                |
| Runtime adapters       | Node.js `http`, optional Express integration, and the standard Fetch API                             |
| Add-on services        | Claim-driven token exchange, structured settings transport, and generic authenticated requests       |
| Installation workflows | Store contracts, encryption wrappers, lifecycle guards, and webhook idempotency leases               |
| Browser integration    | Hardened HTML/JSON responses and an exact-origin iframe bridge                                       |
| Executable scaffolds   | Node/Worker and minimal/all-feature projects that type-check and fail closed before production setup |

## How it fits

```text
Clockify
  └─ signed component, lifecycle, or webhook request
      └─ @apet97/clockify-addon-sdk
          ├─ verify identity and installation context
          ├─ enforce body, routing, and response boundaries
          └─ call your handler, storage, and business logic
```

Entity-specific outbound REST clients remain outside this package. See
[Product Surface](./docs/product-surface.md) for the exact boundary.

## Packages

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

## Trust the artifact

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

See [Quality Gates](./docs/quality-gates.md),
[Release Evidence](./docs/release-readiness.md), and
[Marketplace Coverage](./docs/marketplace-coverage.md) for the proof boundaries.

## Documentation

- [SDK guide and quick start](./addon-sdk/README.md)
- [Creator CLI and programmatic API](./create-clockify-addon/README.md)
- [API reference](./addon-sdk/docs/api-reference.md)
- [Architecture](./docs/architecture.md)
- [Manifest builders](./addon-sdk/docs/manifest-builders.md)
- [Routing and middleware](./addon-sdk/docs/routing.md)
- [Token validation](./addon-sdk/docs/token-validation.md)
- [Secure server recipe](./addon-sdk/docs/secure-server-recipe.md)
- [Java migration](./addon-sdk/docs/java-migration.md)
- [Changelog](./CHANGELOG.md)

## Contributing

Source development requires Node 22.13.0 or newer. Start with:

```bash
npm ci
npm run verify:fast
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing generated models or public API, and use
[SECURITY.md](./SECURITY.md) for private vulnerability reporting.

MIT licensed. Clockify and CAKE.com are trademarks of their respective owners.
