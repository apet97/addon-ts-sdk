# How a Clockify Add-on Works

## The three owners

| Owner              | Responsibility                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Clockify           | Reads the manifest, embeds components, sends lifecycle events and webhooks, and issues tokens.                                 |
| SDK                | Builds and validates the manifest, routes requests, verifies Clockify context, enforces limits, and provides runtime helpers.  |
| Add-on application | Hosts the endpoint, persists installation credentials, implements UI and business logic, calls Clockify, and performs cleanup. |

The SDK secures and normalizes the add-on boundary. It does not deploy the application, choose its
database, or implement its business behavior.

## The request lifecycle

1. Scaffold a Node or Worker project.
2. Configure the public base URL, Clockify parent origin, and durable installation storage.
3. Build a schema 1.5 manifest and register components, lifecycle handlers, and webhooks.
4. Serve `/manifest`, keeping descriptors and executable routes aligned.
5. Verify `INSTALLED` and persist installation and webhook credentials.
6. Verify a component's `auth_token`, return iframe-safe HTML, and use the exact parent origin.
7. Verify a webhook, claim an idempotency lease, process it, then complete or release the lease.
8. Call Clockify with stored add-on credentials and service URLs from verified claims.
9. Handle `DELETED` cleanup while accounting for the real payload's lack of a generation identifier.
10. Deploy with explicit public-origin configuration and durable encrypted storage.

## Routes and credentials

| Boundary          | Route or wire value                                    | Contract                                                                                                |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Manifest          | `GET /manifest`                                        | Publicly serves the validated manifest that tells Clockify which routes exist.                          |
| Component         | `auth_token` query value                               | Clockify-signed user context; verify it before returning component HTML.                                |
| Lifecycle         | `X-Addon-Lifecycle-Token` header                       | Clockify-signed installation context; verify it and match lifecycle payload IDs to the claims.          |
| Webhook           | `clockify-signature` and `clockify-webhook-event-type` | Verify the signature, expected event, installation context, and stored webhook token before processing. |
| Outbound API call | `X-Addon-Token` header                                 | Send the stored installation credential only from the server to a claim-derived Clockify service URL.   |

Clockify places the component `auth_token` transiently in the iframe query URL. Verify it before
returning component content; it must not be logged, persisted, or re-emitted in HTML, links, or
redirects.

Installation and webhook credentials remain server-side. Send the stored installation credential
outbound only as `X-Addon-Token`; do not log or copy these values into browser storage, documentation,
error messages, or unrelated services.

## Storage lifecycle

After a verified `INSTALLED` request, the add-on application persists the installation record for
the matching workspace and add-on. That record includes the installation credential, Clockify API
context, application user context, an application-assigned `installedAt`, and any per-route webhook
tokens supplied by Clockify.

Webhook verification should look up the expected token by verified workspace and add-on context,
then narrow it to the declared event and path before processing. Durable stores should be wrapped
with `wrapClockifyInstallationStoreWithEncryption`, which encrypts the installation token and
nested webhook token copies at rest.

The store's generation guard applies only when the caller supplies `installedAt`. Clockify's real
`DELETED` payload does not include that generation, so the generated uninstall path deletes the
matching workspace/add-on record unconditionally. If an application has its own trusted generation
correlation, it may supply `installedAt`; otherwise it must not invent one from the payload.

## Runtime boundary

The generated `src/addon.ts` owns the shared `createAddon` function and all manifest and route
registration. The runtime-specific `src/index.ts` is deliberately small:

- Node passes the add-on to `createNodeHttpAddonServer`.
- Fetch/Worker passes each standard `Request` to `handleFetchRequest`.
- Express applications pass requests through `createExpressAddonHandler`, but the host owns body
  parsing and its body-size limit.

This keeps manifest, routing, and verification behavior shared while leaving process startup and
framework middleware with the host application.

## Failure model

- `400 Bad Request`: the Node adapter rejects a malformed declared content length, and the Fetch
  adapter rejects request-body read failures before routing.
- `401 Unauthorized`: verified component, lifecycle, and webhook wrappers reject missing, duplicate,
  invalid, or context-mismatched credentials. Missing expected webhook tokens return this response
  before the scaffold handler runs.
- `404 Not Found`: no route is registered for the requested path.
- `405 Method Not Allowed`: the path exists but not for the requested method; the router includes an
  `Allow` header.
- `413 Payload Too Large`: the Node and Fetch adapters reject bodies above their configured limit
  before dispatch. Express body limits remain the host application's responsibility.
- `500 Internal Server Error`: the router contains handler or middleware failures, and the Node and
  Fetch adapters contain unexpected adapter failures.
- `503 Service Unavailable`: the generated component and lifecycle handlers fail closed when required
  iframe parent-origin, installation storage, or deletion cleanup setup is absent.

See [Routing and Middleware](../addon-sdk/docs/routing.md) for dispatch and adapter details and
[Token Signature Verification](../addon-sdk/docs/token-validation.md) for the credential contracts.

## Next steps

- [Documentation index](README.md)
- [SDK package reference](../addon-sdk/README.md)
- [Creator package reference](../create-clockify-addon/README.md)
