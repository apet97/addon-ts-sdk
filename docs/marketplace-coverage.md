# Marketplace Coverage Matrix

This matrix maps the vendored `MARKETPLACE_DOCS` snapshot to SDK behavior. A row marked
"application responsibility" is deliberately not hidden behind an SDK success response.

| Marketplace area         | SDK coverage                                                                                                            | Proof                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Introduction             | Manifest, runtime, lifecycle, webhook, component, client and UI layers                                                  | API reference and packed scaffolds                  |
| Quick start              | Packed creator generates Node/Worker minimal/all with valid manifests, fail-closed paths, and compilable Worker entries | executable `verify:scaffolds`                       |
| Lifecycle                | Typed payload guards, verified wrappers, encrypted storage, and caller-qualified generation deletes                     | lifecycle, creator and installation-store suites    |
| UI components            | Generated component builders and hardened HTML responses                                                                | builder, security and creator suites                |
| Webhooks                 | Exact event/signature/token checks, 1 MiB request limits and owner-specific idempotency leases                          | request-verification and webhook-idempotency suites |
| Structured settings      | Typed setting builders plus claim-driven GET/PATCH client methods                                                       | settings and add-on-client suites                   |
| Developer account        | Application responsibility; authenticated installation remains outside deterministic repo gates                         | final-SHA `e74e1f7` workspace receipt below         |
| Authentication           | RS256, issuer/type/subject pinning, expiry profiles and context matching                                                | request-verification suite                          |
| Environments and regions | Verified URL claims, encoded path segments and fail-closed public origins                                               | request-wire, client and origin suites              |
| Window events            | Source/origin-checked subscriptions and typed actions                                                                   | UI suite                                            |
| Development checklist    | Security responses, redaction boundary, package/scaffold/audit gates                                                    | `ci:verify`                                         |
| Publishing and privacy   | Security and release checklists; no automatic Marketplace submission                                                    | release-readiness and SECURITY                      |
| Private add-ons          | Same manifest/runtime contract; workspace whitelisting remains a portal responsibility                                  | deployment guide                                    |

The source URLs and capture markers remain in each vendored document. Network-dependent schema and
documentation freshness checks stay outside deterministic PR verification.

Clockify's real `DELETED` payload contains `addonId`, `workspaceId`, and `asUser`, but no
installation generation. `ClockifyInstallationStore.delete()` rejects a stale generation only when
the caller supplies `installedAt`; omitting it intentionally performs unconditional matching-record
cleanup. The generated development scaffold keeps that normal uninstall cleanup and therefore does
not claim protection from delayed events belonging to an earlier installation.

## Final-SHA sanitized live receipt (2026-07-12)

This receipt applies to final runtime commit `e74e1f7c1b307791b485f0a25b10a0df0fe7e725` after the
request-target, registration, Worker-start, and packed-creator remediations. It proves that exact
runtime SHA; it is not evidence of a Marketplace submission or of future code changes.

Before the disposable pass, the hosted Mileage reference returned an `UP` health response, exposed
a schema 1.5 manifest, and rendered its installed iframe in the authenticated Firefox workspace.
Its already-dirty checkout was not modified.

A packed Node all-features scaffold then produced a schema-valid manifest with exactly one
component, two lifecycle hooks, and one webhook. The developer workspace accepted the manifest and
the redacting request counter recorded only this successful sequence:

```text
GET  /manifest             200
POST /lifecycle/installed  204
GET  /component            200
POST /webhooks/time-entry  204
POST /lifecycle/deleted    204
```

The first iframe attempt was correctly refused when `frame-ancestors` named the production Clockify
origin. Setting `CLOCKIFY_PARENT_ORIGIN` to the exact developer-workspace origin allowed the signed
component to render. The disposable two-hour entry was deleted, the add-on was uninstalled, and the
temporary server, tunnel, proxy, and files were removed. No headers, query strings, request bodies,
JWTs, tokens, or tunnel hostname were retained.
