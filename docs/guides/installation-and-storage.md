# Installation and Storage

## Mental model

`INSTALLED` establishes the server-side installation record used by every later privileged action.
The lifecycle JWT proves who sent the request; the payload supplies the installation credential and
webhook credentials. Verification must happen before persistence, and persistence must finish
before the handler acknowledges success.

## What Clockify sends

Clockify sends lifecycle callbacks as `POST` requests with an `X-Addon-Lifecycle-Token` header.
The `INSTALLED` body contains `workspaceId`, `addonId`, `addonUserId`, `asUser`, `apiUrl`,
`authToken`, and optional per-route webhook tokens. The real `DELETED` body contains
`workspaceId`, `addonId`, and `asUser`; it does not contain `installedAt` or another installation
generation.

## What the SDK does

`withClockifyInstalledLifecycleRequest()` verifies the lifecycle token, requires its expiration,
checks the documented payload shape, and matches the payload `workspaceId` and `addonId` to the
verified claims. Normal verification failures return `401 Unauthorized` before the application
handler runs.

`ClockifyInstallationContext` is the complete SDK storage shape:

- `workspaceId`, `addonId`, `addonUserId`, and `asUser`
- `apiUrl` and the installation `authToken`
- application-assigned `installedAt`
- optional `webhooks`, including each path, `webhookType`, and `authToken`

`wrapClockifyInstallationStoreWithEncryption()` encrypts the installation credential and every
nested webhook credential before delegating to a store. Reads decrypt an intact record and return
`null` when encrypted data is corrupt — the same result as "no installation," because the caller
must fail closed either way. Pass a third `onDecodeError` argument to observe corrupt-decode
events for operational alerting; it does not change what `load()` returns.

To rotate the encryption key without a storage migration, wrap both keys with
`createRotatingClockifyTokenCodec(newCodec, oldCodec)`: it encrypts every new write with the new
key, and decrypts by trying the new key first, falling back to the old key for a row saved before
the rotation. Deploy with the rotating codec, let normal application traffic re-save rows (each
save re-encrypts with the new key), then once every row has been touched, redeploy with
`createClockifyAesGcmTokenCodec(newKey)` alone.

## What your application must do

Implement `ClockifyInstallationStore` on durable storage and wrap it with encryption backed by
managed key material. `InMemoryClockifyInstallationStore` is for tests and single-process local
development, not production.

After verification, assign `installedAt` once, save the complete record, await the save, and only
then return success. A durable implementation should preserve the SDK generation behavior: an
older save must not replace a newer generation, and a qualified delete must compare the supplied
generation atomically.

Keep installation and webhook credentials server-side. Never copy them into component HTML,
browser storage, logs, or error messages. The SDK redacts what it knows about (`authToken`,
`x-addon-token`, `clockify-signature`, and similar) before its own `onError` reporter sees a
request, but it cannot redact a request or store record your application logs directly:

```typescript
// WRONG — logs the raw authToken and every webhooks[].authToken:
console.log(request.body);

// RIGHT — logs the same request with known secret fields replaced:
import { redactAddonRequest } from "@apet97/clockify-addon-sdk";
console.log(redactAddonRequest(request));
```

## Smallest correct path

The generated installation handler follows this ordering:

```typescript
import {
  ClockifyLifecycleEvent,
  withClockifyInstalledLifecycleRequest,
} from "@apet97/clockify-addon-sdk";

const installed = ClockifyLifecycleEvent.v1_5Builder()
  .path("/lifecycle/installed")
  .onInstalled()
  .build();

addon.registerLifecycleEvent(
  installed,
  withClockifyInstalledLifecycleRequest(parser, async (_request, payload) => {
    await installations.save({ ...payload, installedAt: Date.now() });
    return { status: 204 };
  }),
);
```

For deletion, inspect the store result:

- `deleted`: the matching record was removed.
- `missing`: no matching record existed; cleanup is already absent and can remain idempotent.
- `stale`: a caller-supplied `installedAt` did not match the current generation, so the newer
  record was preserved.

## Failure behavior

- Missing, duplicate, invalid, expired, or context-mismatched lifecycle credentials return `401`.
- The generated all-features scaffold returns `503` after successful verification when persistent
  installation storage or deletion cleanup is not wired and the explicit local-only storage switch
  is disabled.
- A rejected save or other handler exception is contained by the router as `500`; do not return
  `204` before durable persistence commits.
- An encrypted record that cannot be decoded loads as `null`; treat it as unavailable and alert
  without logging ciphertext or credentials.
- A delete with `installedAt` is generation-qualified. A delete without it is unconditional for
  the matching workspace/add-on record.

The final point is a real platform limitation: because Clockify's `DELETED` payload is unqualified,
passing only its fields cannot distinguish a delayed uninstall from a newer reinstall. Do not invent
an `installedAt` value. Use a trusted application-owned correlation if one exists; otherwise the
cleanup is necessarily unconditional.

## Prove it

Exercise both token/payload matching and the store contract:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/request-verification.test.ts tests/installation-store.test.ts
```

In an integration environment, prove that the raw database does not contain the installation or
webhook tokens, a stale qualified delete preserves a newer record, and a successful `INSTALLED`
response is sent only after the durable write completes.

## Reference

- [How an add-on works: storage lifecycle](../how-an-addon-works.md#storage-lifecycle)
- [Secure server recipe](../../addon-sdk/docs/secure-server-recipe.md)
- [Installation-store contract](../../addon-sdk/src/clockify/clockify-installation-store.ts)
- [Lifecycle payloads and matching](../../addon-sdk/src/clockify/clockify-lifecycle.ts)
- [Lifecycle request wrappers](../../addon-sdk/src/clockify/clockify-request-handlers.ts)
