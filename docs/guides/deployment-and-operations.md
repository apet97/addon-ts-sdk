# Deployment and Operations

## Mental model

The SDK provides a framework-neutral add-on runtime plus Node and Fetch adapters. Your deployment
owns process startup, public HTTPS, configuration, durable state, logging, health checks, queues,
and incident response. A locally valid manifest is necessary but is not evidence that Clockify can
reach or embed the deployed application.

## What Clockify sends

Clockify reaches the public origin for `GET /manifest`, component `GET` requests, and lifecycle and
webhook `POST` requests. Those requests can contain credentials in query values or headers and can
contain bodies up to the application's configured adapter limit.

Traffic can arrive concurrently and webhook deliveries can repeat, so production storage and lease
semantics must hold across processes and regions, not only inside one JavaScript instance.

## What the SDK does

The creator emits two bootstraps:

- Node passes the shared add-on to `createNodeHttpAddonServer()`.
- Worker/Fetch passes each standard `Request` to `handleFetchRequest()`.

`resolveClockifyPublicOrigin()` requires an explicit HTTPS `PUBLIC_BASE_URL` for production. A
request-derived origin is available only with explicit local opt-in and only for canonical loopback
hosts. The Node and Fetch adapters enforce a configurable body limit before dispatch; the default is
1 MiB.

The SDK contains router and adapter failures as stable responses and offers `onError` hooks. It does
not install a logger, database, queue, health route, or monitoring service.

## What your application must do

Provide an HTTPS public origin without credentials and set the exact `CLOCKIFY_PARENT_ORIGIN` for
iframe responses. Keep `ALLOW_LOCAL_REQUEST_ORIGIN` and `ALLOW_EPHEMERAL_STORAGE` limited to explicit
local development.

Use a durable encrypted installation store and a durable, transactional owner-checked lease store.
Manage encryption keys outside the data store and define backup, rotation, restore, and regional
consistency policy.

Choose one body owner:

- The Node and Fetch adapters read, bound, and normalize the body before dispatch.
- An Express host owns parsing and its body-size limit, then passes the parsed body to
  `createExpressAddonHandler()`.

Emit structured logs with fields such as adapter source, method, route pathname, status, duration,
and a non-secret correlation ID. Never log query strings, full request URLs, bodies by default,
`auth_token`, signatures, lifecycle tokens, installation/webhook tokens, or `X-Addon-Token`.

Expose host-owned liveness and readiness checks. Monitor sustained 401/413/5xx/503 rates, storage
and token-lookup failures, lease contention/loss, webhook latency, and installation cleanup results.

## Smallest correct path

The generated Node bootstrap loads `.env` and starts the SDK adapter:

```typescript
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";
import { createAddon } from "./addon.js";

process.loadEnvFile?.();
const port = Number(process.env.PORT ?? 8080);
createNodeHttpAddonServer(createAddon(process.env)).listen(port);
```

The generated Worker bootstrap keeps environment bindings explicit:

```typescript
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
import { createAddon, type AddonEnvironment } from "./addon.js";

export default {
  fetch(request: Request, environment: AddonEnvironment): Promise<Response> {
    return handleFetchRequest(createAddon(environment, request.url), request);
  },
};
```

Replace development storage before installation, configure secrets through the platform, and probe
the deployed `/manifest` before registering its URL with Clockify.

## Failure behavior

- Missing or invalid production `PUBLIC_BASE_URL` fails closed instead of trusting an arbitrary
  request host. Local request-origin resolution also fails unless explicitly enabled with a
  canonical loopback request URL.
- Node/Fetch requests above the configured limit return `413`; malformed declared body lengths
  return `400`. Express follows the host parser's behavior.
- The generated component and lifecycle routes return `503` after successful verification when
  parent-origin or storage/cleanup wiring is incomplete. A missing expected webhook token returns
  `401` before its handler instead.
- In-memory installation or lease stores lose state on restart and cannot coordinate multiple
  instances. Treat that as unsupported production configuration, not an availability strategy.
- Unexpected handler/router/adapter errors become `500`; use redacted `onError` reporting to retain
  diagnostic context without changing the response contract.

## Prove it

Verify both generated runtime families from packed artifacts:

```bash
npm run verify:scaffolds
npm run ci:verify
```

Those local gates are not fresh Marketplace proof. Before a release, use an authenticated Clockify
developer workspace to fetch the deployed manifest, install the add-on, load the iframe, deliver a
webhook, exercise deletion, and record the exact source SHA and environment. Historical receipts,
localhost probes, CI, real local `workerd` route probes, and Wrangler dry-runs prove only the states
they actually exercised.

## Reference

- [Getting started](../getting-started.md)
- [Creator package reference](../../create-clockify-addon/README.md)
- [Runtime adapters](../../addon-sdk/docs/routing.md)
- [Quality gates](../maintainers/quality-gates.md)
- [Marketplace coverage and live evidence](../maintainers/marketplace-coverage.md)
- [Current scaffold source](../../create-clockify-addon/src/index.mjs)
