# Webhooks and Idempotency

## Mental model

Webhook safety has two independent gates: authenticate the delivery for the correct installation,
then make processing idempotent. A valid signature does not make retries impossible, and an
idempotency key does not authenticate the sender.

Assume at-least-once delivery. The stable event key identifies the work; the lease owner identifies
one processing attempt.

## What Clockify sends

Clockify sends a `POST` to the registered webhook path with `clockify-signature`,
`clockify-webhook-event-type`, and an event body. The signature must match the webhook token stored
for the verified installation and route. The signed claims must contain nonblank `workspaceId` and
`addonId` context.

Clockify can redeliver an event after a timeout or server failure, so the same business event may
arrive more than once.

## What the SDK does

`withClockifyVerifiedWebhookRequest()` requires an expected event type and exactly one token source:
a fixed `expectedWebhookAuthToken` or `getExpectedWebhookAuthToken`. With a lookup, the wrapper
first verifies the signature JWT, event, and nonblank installation context, then calls the lookup
with verified `workspaceId`, `addonId`, and `eventType`, compares the resolved stored token, and only
then invokes the handler.

The Node and Fetch adapters bound and buffer the request body before route verification. Their
default maximum is 1 MiB, and an oversized body returns `413` before the webhook handler. Express
body parsing and limits belong to the host application.

`runClockifyIdempotentWebhook()` claims an owner-specific lease, returns `duplicate` without running
work when the claim fails, completes work whose result is not a response-like 5xx, and calls
`release` after a throw or a returned response-like value whose numeric status is 500 or greater.

## What your application must do

Persist each webhook token server-side by installation, event type, and declared path. Bind the
path in the lookup closure because `getExpectedWebhookAuthToken` receives verified installation and
event context, not a path.

Choose a stable event key from verified installation context, event type, and a provider/business
event identifier. Do not use a random value or processing timestamp as the key, and do not include a
credential. Give every processing attempt a distinct nonblank owner and a bounded lease duration.

Use a durable lease store in production. Distributed `claim`, `complete`, and `release` operations
must be atomic and conditional on the current owner; an unguarded read-then-write implementation is
not sufficient. Keep the business write idempotent or transactional as well—the lease coordinates
attempts but is not a substitute for a business-data transaction.

`InMemoryClockifyIdempotencyLeaseStore` never expires a completed entry, so a long-lived process
grows its lease map without bound. It is for tests and short-lived single-process deployments only.
A production store must put a time-to-live on completed entries — long enough to cover Clockify's
retry window for a delivery, then evict.

## Smallest correct path

This stored-token lookup shape is reduced from the secure-server example:

```typescript
addon.registerWebhook(
  webhook,
  withClockifyVerifiedWebhookRequest(
    parser,
    {
      expectedEventType: "EXPENSE_CREATED",
      getExpectedWebhookAuthToken(input) {
        return store.findWebhookAuthToken({
          ...input,
          path: "/webhooks/expense-created",
        });
      },
    },
    async (request, claims) => {
      await handleExpenseCreated(request.body, claims);
      return { status: 204 };
    },
  ),
);
```

Inside the verified handler, derive the stable key, then pass the durable lease store, that key, a
unique owner, a lease duration, and the business callback to `runClockifyIdempotentWebhook`. Handle
the returned `duplicate` state deliberately without running the callback again. Return the helper's
completed value for the attempt that owned the lease.

## Failure behavior

- Missing, duplicate, invalid, wrong-event, contextless, or stored-token-mismatched requests return
  `401 Unauthorized` before business logic runs.
- Returning `undefined` or a blank value from `getExpectedWebhookAuthToken` also returns `401`; this
  missing expected credential is not a scaffold `503`.
- If the token lookup throws, the router contains the failure as `500`; returning no token and a
  storage outage are operationally different cases and should be monitored differently.
- An oversized Node/Fetch body returns `413 Payload Too Large` before verification. Express uses the
  host's configured limit.
- A failed lease claim returns `duplicate` without invoking work. Your application chooses the
  response policy for that state.
- Successful work completes the lease. A throw or returned 5xx releases it so a later delivery may
  reclaim the key. If ownership is lost before completion, the helper throws rather than claiming
  success.

## Prove it

Run the request, adapter, and lease regressions:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/request-verification.test.ts tests/webhook-idempotency.test.ts tests/adapters.test.ts tests/adapters-node-server.test.ts
```

In an integration test, deliver the same event key concurrently, confirm only one callback owns the
lease, then prove that a thrown callback and a 5xx result can be reclaimed while a completed result
cannot. Repeat against the production store implementation, not only the in-memory test store.

## Reference

- [Secure server recipe](../../addon-sdk/docs/secure-server-recipe.md)
- [Webhook request verification](../../addon-sdk/src/clockify/clockify-request-handlers.ts)
- [Webhook verification primitives](../../addon-sdk/src/clockify/clockify-request-verifiers.ts)
- [Idempotency lease contract](../../addon-sdk/src/clockify/clockify-webhook-idempotency.ts)
- [Request body limits](../../addon-sdk/docs/routing.md#request-body-limits)
