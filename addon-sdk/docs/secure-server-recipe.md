# Secure Server Recipe

This recipe shows the minimum server-side pattern for a Clockify add-on backend that persists
installation tokens and validates webhook calls. The SDK verifies incoming Clockify requests; your
application still owns storage and any outbound Clockify API calls.

## Installation

Use `withClockifyInstalledLifecycleRequest()` on the `INSTALLED` lifecycle route. After the wrapper
verifies `X-Addon-Lifecycle-Token`, validates the installed payload, and matches `workspaceId` plus
`addonId` to the signed claims, persist these values server-side:

- `payload.authToken` for future Clockify API calls with the `X-Addon-Token` header.
- `payload.webhooks[].authToken` keyed by workspace, add-on, event type, and webhook path.
- Environment URLs from the verified claims or installed payload; do not hardcode production hosts.

Do not send installation tokens to browser code, logs, or client-side storage.

## Webhooks

Use `withClockifyVerifiedWebhookRequest()` on each webhook route. Prefer
`getExpectedWebhookAuthToken({ workspaceId, addonId, eventType })` when the expected webhook token is
stored per installation:

```typescript
addon.registerWebhook(
  ClockifyWebhook.v1_5Builder().onExpenseCreated().path("/webhooks/expense-created").build(),
  withClockifyVerifiedWebhookRequest(
    parser,
    {
      expectedEventType: "EXPENSE_CREATED",
      getExpectedWebhookAuthToken({ workspaceId, addonId, eventType }) {
        return store.findWebhookAuthToken({
          workspaceId,
          addonId,
          eventType,
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

The wrapper checks the signed JWT, the expected event header, workspace/add-on context, and the
stored webhook token before the handler runs.

## Local Replay

The secure example is the canonical local playground for this SDK:

```bash
npm run dev:clockify-local
```

It starts the example server, signs fake local component/lifecycle/webhook tokens with
`@apet97/clockify-addon-sdk/testing`, replays the documented request shapes, and prints the status
transcript. Use `npm run dev:clockify-local -- --once` when you want the same replay to exit for CI or
local smoke checks.

## Scope

This is only a secure request-handling recipe. It does not add a Clockify REST client, token
exchange flow, database adapter, queue, or UI framework to the SDK.
