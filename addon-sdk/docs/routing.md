# Routing and Middleware

This document describes how request routing, trailing slashes, duplicate checks, and middleware execution work in `clockify-addon-sdk-ts-115`.

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
