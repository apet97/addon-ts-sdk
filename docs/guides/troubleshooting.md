# Troubleshooting

## Mental model

Troubleshoot the first boundary that failed: configuration, routing/body adaptation, credential
verification, application setup, iframe policy, storage, or idempotent processing. HTTP status alone
is not enough; determine whether the application handler ran before changing code or weakening a
security check.

## What Clockify sends

The important request shapes are:

| Boundary  | Expected shape                                                                   |
| --------- | -------------------------------------------------------------------------------- |
| Manifest  | `GET /manifest`                                                                  |
| Component | `GET <component-path>?auth_token=<signed-user-context>`                          |
| Lifecycle | `POST <lifecycle-path>` with `X-Addon-Lifecycle-Token` and a lifecycle body      |
| Webhook   | `POST <webhook-path>` with signature/event headers and the event body            |
| Outbound  | Your server calls a verified Clockify origin with a stored `X-Addon-Token` value |

Do not paste real values from any credential-bearing location into an issue, log query, or test
fixture.

## What the SDK does

The router distinguishes unknown paths (`404`) from known paths using the wrong method (`405`).
Node and Fetch adapters reject malformed or oversized bodies before dispatch. Verification wrappers
return `401` before the application handler when credentials, event type, installation context, or
stored webhook-token comparison fails.

Generated `503` responses are application setup guards after verification, not authentication
failures. The SDK also returns contained `500` responses for unexpected handler/router/adapter
throws; redacted `onError` hooks provide the diagnostic seam.

## What your application must do

Capture a non-secret correlation ID, runtime, method, pathname without query, response status,
whether the handler was reached, and redacted error category. Compare the deployed manifest with
the registered routes and the exact environment configuration. Do not log whole URLs, headers,
bodies, tokens, signatures, or stored records.

Reproduce against the same runtime and store topology as production. A passing in-memory or
single-process test does not prove distributed lease or durable installation behavior.

## Smallest correct path

Use this order so later symptoms do not hide the first failure:

1. Start the application with explicit `PUBLIC_BASE_URL` and inspect `GET /manifest`.
2. Confirm the failing request's pathname and method exactly match a declared descriptor.
3. Confirm the relevant token location and expected installation/event context without printing the
   value.
4. Determine whether the wrapper returned `401` before the handler or the verified handler returned
   `503` because setup is incomplete.
5. Check body-limit ownership, iframe origin/CSP, durable store state, then lease state.
6. Re-run the focused regression and the same request in a developer workspace.

## Failure behavior

| Symptom                                         | Meaning and checks                                                                                                                                                              | Corrective action                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup/request creation fails with no manifest | `PUBLIC_BASE_URL` is missing, malformed, credential-bearing, or not HTTPS. Request-derived origins also fail unless local opt-in uses a canonical loopback URL.                 | Configure the real HTTPS public origin. Use `ALLOW_LOCAL_REQUEST_ORIGIN=true` only for explicit loopback development with a request URL.                |
| Component returns `401`                         | `auth_token` is missing, duplicated, expired, invalid, signed for another manifest key, or mismatched to expected context. The component handler did not run.                   | Fix the request/environment or expected context. Never bypass verification or persist the query token.                                                  |
| Lifecycle returns `401`                         | `X-Addon-Lifecycle-Token` failed verification, the payload shape is wrong, or payload `workspaceId`/`addonId` does not match signed claims.                                     | Verify header forwarding, token expiration/key, payload shape, and the installation IDs before persistence.                                             |
| Webhook returns `401`                           | Signature/event/context verification failed, token sources are misconfigured, or `getExpectedWebhookAuthToken` returned no matching stored token.                               | Look up the token by verified workspace/add-on/event and route. Missing expected webhook storage is `401`, not `503`.                                   |
| Unknown route returns `404`                     | No handler exists for the exact normalized path. Prefix and parameter-style matching are not supported.                                                                         | Compare the served manifest and registered concrete path; route variable paths in the host before SDK dispatch.                                         |
| Known route returns `405`                       | The path exists but the method is wrong. The `Allow` header shows accepted methods, including derived `HEAD`/`OPTIONS` behavior for GET routes.                                 | Send the descriptor's method or correct the registration; do not add a second route only to hide a caller error.                                        |
| Request returns `413`                           | The Node/Fetch body exceeded `maxBodyBytes` before routing. Express limits belong to the host parser.                                                                           | Confirm payload size and the single body owner. Raise the limit only after an explicit resource/safety review.                                          |
| Verified route returns `503`                    | The generated handler lacks required parent-origin, persistent installation storage, deletion cleanup, or other explicit application wiring.                                    | Complete the wiring. Distinguish this post-verification setup guard from wrapper `401`; do not convert invalid credentials into `503`.                  |
| Iframe is refused or bridge messages disappear  | `CLOCKIFY_PARENT_ORIGIN`, CSP `frame-ancestors`, actual parent origin, or message source does not match exactly. A path, wildcard, wrong environment, or insecure origin fails. | Configure the exact Clockify origin for that environment and use the same origin in `createClockifyHtmlResponse` and `createClockifyBridge`.            |
| Webhook reports `duplicate`                     | Another owner holds an unexpired lease or the event key is already completed. The callback was not invoked.                                                                     | Verify the stable key and owner, then apply the application's deliberate duplicate response policy. Do not generate a fresh key for the same event.     |
| Webhook keeps retrying after failure            | The callback threw or returned a response-like 5xx, so `runClockifyIdempotentWebhook` called `release`; alternatively the lease expired before completion.                      | Fix the business failure, size the lease, and prove owner-conditional atomic store operations. A successful retry should complete the same stable key.  |
| Delete returns `stale`                          | A trusted caller-supplied `installedAt` does not match the current record, so a newer installation was preserved.                                                               | Leave the newer record intact and investigate event/generation correlation; do not retry the stale qualified delete as an unconditional one.            |
| Newer installation vanished during cleanup      | The real `DELETED` payload has no `installedAt`; deletion using only that payload is unqualified and unconditional for the workspace/add-on key.                                | Do not fabricate a generation. Use a trusted application-owned correlation if available, otherwise reconcile/reinstall and document the platform limit. |

If a syntactically invalid parent origin reaches `createClockifyHtmlResponse`, the security helper
throws and the router returns `500`; validate configuration at startup to separate that from an
ordinary iframe mismatch.

## Prove it

Replay the documented local request shapes and run the focused boundaries:

```bash
npm run test:replay
npm test -w @apet97/clockify-addon-sdk -- tests/router.test.ts tests/request-verification.test.ts tests/adapters.test.ts tests/installation-store.test.ts tests/webhook-idempotency.test.ts
```

For a deployed failure, repeat only with sanitized inputs in a Clockify developer workspace and
record the source SHA, runtime, manifest response, status sequence, and whether the handler ran.

## Reference

- [How an add-on works: failure model](../how-an-addon-works.md#failure-model)
- [Manifest and registration](manifest-and-registration.md)
- [Installation and storage](installation-and-storage.md)
- [Components and UI](components-and-ui.md)
- [Webhooks and idempotency](webhooks-and-idempotency.md)
- [Deployment and operations](deployment-and-operations.md)
- [Routing and middleware](../../addon-sdk/docs/routing.md)
- [Token signature verification](../../addon-sdk/docs/token-validation.md)
