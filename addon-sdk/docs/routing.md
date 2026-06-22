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

## Trailing Slash Trim at Dispatch

Incoming requests have their trailing slash trimmed when executing route dispatch:
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

## Request Body Limits

The built-in Node `http` and Fetch adapters buffer request bodies before routing so handlers receive
both `body` and `rawBody`. They default to `DEFAULT_MAX_BODY_BYTES` (`1_048_576`, 1 MiB) and return
`413 Payload Too Large` before dispatch when a request exceeds the limit.
Custom `maxBodyBytes` values must be positive integers; invalid adapter configuration throws instead
of dispatching requests with an ambiguous limit.

```typescript
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters";

const server = createNodeHttpAddonServer(addon, { maxBodyBytes: 2_097_152 });
```

For Express, configure the host app's body parser directly:

```typescript
app.use(express.json({ limit: "1mb" }));
app.use(createExpressAddonHandler(addon));
```
