# Secure Server Recipe

This reference follows one add-on from schema declaration through verified teardown. The
[builder guides](../../docs/getting-started.md) own the step-by-step tutorial; this page keeps the
security-sensitive server flow together.

## Build and register schema 1.5 descriptors

Use the explicit schema 1.5 builders for the manifest and every descriptor. Validate the base
manifest before serving it, then bind descriptors through `registerComponent()`,
`registerLifecycleEvent()`, and `registerWebhook()` so the route and manifest stay synchronized.

```typescript
const manifest = ClockifyManifest.v1_5Builder()
  .key("secure-addon")
  .name("Secure add-on")
  .baseUrl(publicOrigin)
  .requireProPlan()
  .build();
const addon = createValidatedClockifyAddon(manifest);
const parser = createClockifySignatureParser(manifest.key);
```

Registration paths must start with `/` and must not end with `/`. Use the matching
`v1_5Builder()` factories for components, lifecycle events, and webhooks.

## Verify and store INSTALLED

Register `INSTALLED` with `withClockifyInstalledLifecycleRequest()`. The wrapper reads the single
`X-Addon-Lifecycle-Token`, verifies the RS256 token and required expiration, validates the payload,
and matches its `workspaceId` and `addonId` to the signed claims before the handler runs.

```typescript
addon.registerLifecycleEvent(
  ClockifyLifecycleEvent.v1_5Builder().path("/lifecycle/installed").onInstalled().build(),
  withClockifyInstalledLifecycleRequest(parser, async (_request, payload, claims) => {
    await installations.save({
      ...payload,
      installedAt: Date.now(),
    });
    await storeVerifiedBackendUrl(claims.workspaceId, claims.addonId, claims.backendUrl);
    return { status: 204 };
  }),
);
```

Persist the installation `authToken`, every nested webhook `authToken`, and the verified
environment context only on the server. Wrap a durable `ClockifyInstallationStore` with
`wrapClockifyInstallationStoreWithEncryption()`; the in-memory store is for tests and
single-process local development.

## Render a verified component

Use `withClockifyVerifiedComponentRequest()` so the component's single `auth_token` query value
is verified before authorization or rendering. Return browser-facing HTML through
`createClockifyHtmlResponse()` with the exact configured Clockify parent origin.

```typescript
addon.registerComponent(
  ClockifyComponent.v1_5Builder()
    .activityTab()
    .allowAdmins()
    .path("/component")
    .label("Secure component")
    .build(),
  withClockifyVerifiedComponentRequest(parser, async (_request, claims) => {
    if (!isClockifyAdminRole(claims.workspaceRole)) {
      return { status: 403, body: "Admins only" };
    }
    return createClockifyHtmlResponse("<main>Secure component</main>", {
      frameAncestors: [clockifyParentOrigin],
    });
  }),
);
```

The transient component token must not enter logs, persistence, rendered HTML, redirects, analytics,
or browser storage.

## Verify stored-token webhooks

Persist each webhook token from `INSTALLED` by workspace, add-on, event type, and registered path.
The webhook wrapper requires one token source. A lookup runs only after the signature, event, and
nonblank signed installation context pass the first verification stage.

```typescript
addon.registerWebhook(
  ClockifyWebhook.v1_5Builder().onExpenseCreated().path("/webhooks/expense-created").build(),
  withClockifyVerifiedWebhookRequest(
    parser,
    {
      expectedEventType: "EXPENSE_CREATED",
      getExpectedWebhookAuthToken({ workspaceId, addonId, eventType }) {
        return installations.findWebhookAuthToken({
          workspaceId,
          addonId,
          eventType,
          path: "/webhooks/expense-created",
        });
      },
    },
    verifiedExpenseHandler,
  ),
);
```

`verifyClockifyWebhookRequest()` is the lower-level fixed-token API. Dynamic per-installation
lookup belongs in `withClockifyVerifiedWebhookRequest()`, which accepts exactly one fixed or lookup
token source.

## Make webhook work idempotent

Authentication and idempotency are separate. Inside the verified handler, derive a stable key from
verified installation context, event type, and a provider event identifier; give each processing
attempt a unique owner.

```typescript
const result = await runClockifyIdempotentWebhook(
  leases,
  {
    key: stableEventKey,
    owner: crypto.randomUUID(),
    leaseMs: 30_000,
  },
  async () => {
    await applyExpenseOnce(request.body);
    return { status: 204 };
  },
);
return result.status === "duplicate" ? { status: 204 } : result.value;
```

Production `claim`, `complete`, and `release` operations must be durable, atomic, and conditional
on the current owner. Throws and response-like 5xx results release the lease so a later delivery can
retry; completed work stays claimed.

## Call Marketplace endpoints

Load the decrypted installation token and its verified `backendUrl` only inside server-side work,
then construct `ClockifyAddonClient`.

```typescript
const client = new ClockifyAddonClient({
  token: installation.authToken,
  backendUrl: installation.backendUrl,
});

const settings = await client.getSettings(installation.workspaceId);
const userToken = await client.exchangeUserToken(userId);
```

The client sends `X-Addon-Token`, encodes each caller-provided path segment, retries safe requests under
its bounded policy, and replays mutations only after a confirmed `429`. Do not use the transient
component `auth_token` as the installation credential.

## Handle DELETED

Register `DELETED` with `withClockifyDeletedLifecycleRequest()`, await application cleanup, and
make the cleanup idempotent. The documented payload has no `installedAt` generation, so passing
only its `workspaceId` and `addonId` requests an unconditional delete of that installation.

```typescript
addon.registerLifecycleEvent(
  ClockifyLifecycleEvent.v1_5Builder().path("/lifecycle/deleted").onDeleted().build(),
  withClockifyDeletedLifecycleRequest(parser, async (_request, payload) => {
    await installations.delete({
      workspaceId: payload.workspaceId,
      addonId: payload.addonId,
    });
    await removeInstallationOwnedResources(payload.workspaceId, payload.addonId);
    return { status: 204 };
  }),
);
```

Do not invent an installation generation from request time. If the application has a trusted
correlation mechanism, it may qualify cleanup itself; the platform payload alone cannot.

## Run locally and deploy

`npm run dev:clockify-local -- --once` signs local test tokens and replays the secure example.
Before deployment, use durable encrypted storage and durable idempotency leases, configure an
explicit HTTPS `PUBLIC_BASE_URL` and exact `CLOCKIFY_PARENT_ORIGIN`, and choose the granular Node
or Fetch adapter for the host runtime. Probe the deployed `/manifest` and exercise the complete
flow in an authenticated Clockify developer workspace; local replay and CI are not live proof.

Continue with the canonical guides for
[installation and storage](../../docs/guides/installation-and-storage.md),
[webhooks and idempotency](../../docs/guides/webhooks-and-idempotency.md),
[calling Clockify](../../docs/guides/calling-clockify.md), and
[deployment and operations](../../docs/guides/deployment-and-operations.md).

## Boundary

`ClockifyAddonClient` covers Marketplace-specific token exchange, structured settings, and generic
authenticated requests; entity-specific REST clients remain outside this SDK. Database drivers,
queue implementations, hosted infrastructure, and business workflows also remain application-owned.
