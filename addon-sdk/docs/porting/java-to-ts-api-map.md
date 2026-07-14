# API Surface Map: Java to TypeScript

This file documents the API translation from Java classes and methods to public TypeScript package
symbols. Application code should import from `@apet97/clockify-addon-sdk` and its documented
subpaths rather than from repository `src/**` files.

## Core Runtime

| Java Class / Interface   | TypeScript Type / Class                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `Addon<M>`               | `Addon<M>` abstract class from the package root                                                     |
| `AddonServlet`           | `createExpressAddonHandler` from `/adapters/express` or `handleFetchRequest` from `/adapters/fetch` |
| `EmbeddedServer`         | `createNodeHttpAddonServer` from `/adapters/node`                                                   |
| `RequestHandler`         | `RequestHandler` type signature                                                                     |
| `Filter` / `FilterChain` | `AddonMiddleware` type signature                                                                    |
| `Addon.Request`          | `AddonRequest` interface                                                                            |
| `HttpResponse`           | `AddonResponse` interface                                                                           |

## Clockify Product Layer

| Java Class / Interface            | TypeScript Type / Class                    |
| --------------------------------- | ------------------------------------------ |
| `ClockifyAddon`                   | `ClockifyAddon`                            |
| `ClockifyManifest`                | `ClockifyManifest` with versioned builders |
| `ClockifyResource`                | `ClockifyResource`                         |
| `ClockifySignatureParser`         | `ClockifySignatureParser`                  |
| `ClockifySignatureParser.CLAIM_*` | `ClockifySignatureClaims` const object     |
| `ClockifySignatureParser.ISSUER`  | `CLOCKIFY_JWT_ISSUER` constant             |
| `ClockifySignatureParser.ADDON`   | `CLOCKIFY_JWT_ADDON_TYPE` constant         |

## TypeScript Marketplace extensions

The TypeScript package also exposes reviewed Marketplace helpers that are not direct Java class
ports:

- `ClockifyAddonClient` from `@apet97/clockify-addon-sdk/client` for token exchange, structured
  settings, and generic authenticated transport.
- Component, lifecycle, installed-lifecycle, and webhook verification wrappers from the root or
  `/clockify` entrypoint.
- Installation-store encryption, webhook idempotency leases, static runtime manifest validation,
  and the browser-only `/ui` entrypoint.

For source-by-source maintainer evidence, use the repository
[Java parity evidence map](../../../docs/maintainers/java-parity/evidence-map.md). For the exhaustive
shipped declarations, use the generated [public API snapshot](../../public-api.snapshot.md).
