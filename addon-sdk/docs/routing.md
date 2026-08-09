# Routing and Middleware

This document describes how request routing, trailing slashes, duplicate checks, and middleware execution work in `@apet97/clockify-addon-sdk`.

## Path Constraints

Path validation constraints match the Java SDK exactly:

1. Registered paths must start with a slash `/`.
2. Registered paths must not end with a slash `/`.
3. Attempting to register an invalid path throws a `ValidationException`.
4. Registering a duplicate path+method combination throws an `IllegalArgumentException`.

```typescript
addon.registerHandler("/valid", "GET", () => ({ status: 200 })); // Valid

addon.registerHandler("/invalid/", "GET", () => ({ status: 200 })); // Throws ValidationException
addon.registerHandler("invalid", "GET", () => ({ status: 200 })); // Throws ValidationException
```

## Route Matching

The core router matches exact `method + path` keys after trimming one trailing slash from the
incoming request path. It does not support wildcard routes or parameterized path segments.

- A request to `/hooks/abc-123` does not match a handler registered at `/hooks`.
- A request to `/hooks/abc-123/` only trims the final slash; it still does not match `/hooks`.

If you need variable path segments, route or normalize them in your host framework before calling
the SDK handler, then dispatch to a concrete SDK path.

## 404, 405, HEAD, and OPTIONS

An unknown path returns `404 Not Found`.

A known path requested with the wrong method returns `405 Method Not Allowed` and an `Allow`
header.

The allowed-method set contains the explicitly registered methods, adds `HEAD` when `GET` is
registered, and always adds `OPTIONS`. For a known path:

- `HEAD` dispatches the `GET` handler and middleware chain once, then removes the response body.
- `OPTIONS` returns `204` with `Allow` without invoking the registered handler.
- Any other unregistered method returns `405` with the same `Allow` value.

`HEAD` or `OPTIONS` for an unknown path still returns `404`; status selection is path-aware
before it is method-aware.

## Trailing Slash Trim at Dispatch

Incoming requests have one trailing slash trimmed when executing route dispatch:

- A request to `/manifest/` matches the `/manifest` handler.
- A request to `/component/` matches the `/component` handler.

## Middlewares

Middlewares run in the order they are registered via `.use()`:

```typescript
addon.use(async (request, next) => {
  console.log("Logger 1 - Start");
  const response = await next(request);
  console.log("Logger 1 - End");
  return response;
});
```

Each middleware receives a single-use `next()` function. If middleware calls `next()` more than once,
the SDK throws before a second dispatch can reach the route handler and returns the same handled 500
response shape as any other router error.

## Request Body Limits

The built-in Node `http` and Fetch adapters own body adaptation. They default to
`DEFAULT_MAX_BODY_BYTES` (`1_048_576`, 1 MiB), inspect a declared `Content-Length` on every
method before routing, and return `413 Payload Too Large` when the declared or streamed body exceeds
the limit. Malformed, negative, ambiguous, or unsafe declared lengths return `400 Bad Request`
without invoking the router or application `onError` callback.

For body-bearing requests, the adapters expose both parsed `body` and bounded `rawBody`. Fetch
does not consume a stream for `GET` or `HEAD`; its declared-length preflight still applies.
Custom `maxBodyBytes` values must be positive integers; invalid adapter configuration throws instead
of dispatching requests with an ambiguous limit.

```typescript
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";

const server = createNodeHttpAddonServer(addon, { maxBodyBytes: 2_097_152 });
```

For Express, configure the host app's body parser directly:

```typescript
app.use(express.json({ limit: "1mb" }));
app.use(createExpressAddonHandler(addon, { onError }));
```

`createExpressAddonHandler`'s optional `onError` observes an error from outside the handler chain,
such as a failure while writing the response. The `ClockifyAddon`-level `onError` cannot see that
failure because it observes only errors from inside `addon.handle()`. A malformed request target is
a client error. The Express adapter returns `400` for it and does not call `onError`.

Prefer the granular `/adapters/node`, `/adapters/express`, and `/adapters/fetch` imports for host
code. The legacy `/adapters` aggregate remains Node-oriented, while the package root stays
runtime-neutral.

## Handled Errors

Router, Express, Fetch, and Node `http` adapter errors are quiet by default. Pass
`onError(error, context)` when the host application must log or count them:

```typescript
import { AddonErrorReporter, ClockifyAddon } from "@apet97/clockify-addon-sdk";
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";

const addonErrorReporter: AddonErrorReporter = (error, context) => {
  appLogger.error({ error, source: context.source }, "Clockify addon request failed");
};

const addon = new ClockifyAddon(manifest, undefined, {
  onError: addonErrorReporter,
});

const server = createNodeHttpAddonServer(addon, { onError: addonErrorReporter });
```

`context.source` identifies `router`, `express-adapter`, `fetch-adapter`, or `node-http-adapter`.
When the router supplies a normalized request, the SDK redacts known credential headers, the
component query token, and lifecycle or webhook tokens in the parsed body. It replaces
unstructured string and binary bodies, and it omits `rawBody`, because these values can contain the
same credentials. Adapters do not expose the native request object to `onError` because it can
contain unredacted headers, URLs, or bodies.
