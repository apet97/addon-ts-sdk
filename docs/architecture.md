# Architecture

`@apet97/clockify-addon-sdk` is layered so a runtime never imports code for another runtime.

- The root and `/clockify` entrypoints contain manifests, routing, verification, security,
  lifecycle/storage primitives and the Fetch-based add-on client.
- `/adapters/node`, `/adapters/express`, and `/adapters/fetch` isolate host integration. The legacy
  `/adapters` aggregate remains available for package consumers but is Node-oriented.
- `/client` contains Marketplace-specific token exchange, settings and generic authenticated
  transport. Entity-specific Clockify REST APIs remain in the separate `clockify-ts-sdk` project.
- `/ui` is browser-only and fails closed unless the exact Clockify parent origin is supplied.
- `/testing` contains local RS256 keys and token signing only.

The root entrypoint must continue to bundle for browser/Worker targets without `node:*` imports.
Persistent implementations may adapt the store and lease interfaces, but distributed claims must be
atomic; an unguarded read-then-write is not a valid distributed adapter.
