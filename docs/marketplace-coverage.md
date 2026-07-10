# Marketplace Coverage Matrix

This matrix maps the vendored `MARKETPLACE_DOCS` snapshot to SDK behavior. A row marked
"application responsibility" is deliberately not hidden behind an SDK success response.

| Marketplace area         | SDK coverage                                                                                   | Proof                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Introduction             | Manifest, runtime, lifecycle, webhook, component, client and UI layers                         | API reference and packed scaffolds                  |
| Quick start              | Node and Worker creator projects with `/manifest` and an authenticated iframe                  | `verify:scaffolds`                                  |
| Lifecycle                | Typed payload guards, verified wrappers, generation-aware encrypted installation store         | lifecycle and installation-store suites             |
| UI components            | Generated component builders and hardened HTML responses                                       | builder, security and creator suites                |
| Webhooks                 | Exact event/signature/token checks, 1 MiB request limits and owner-specific idempotency leases | request-verification and webhook-idempotency suites |
| Structured settings      | Typed setting builders plus claim-driven GET/PATCH client methods                              | settings and add-on-client suites                   |
| Developer account        | Application responsibility; documented setup only                                              | live-validation guide                               |
| Authentication           | RS256, issuer/type/subject pinning, expiry profiles and context matching                       | request-verification suite                          |
| Environments and regions | Verified URL claims, encoded path segments and fail-closed public origins                      | request-wire, client and origin suites              |
| Window events            | Source/origin-checked subscriptions and typed actions                                          | UI suite                                            |
| Development checklist    | Security responses, redaction boundary, package/scaffold/audit gates                           | `ci:verify`                                         |
| Publishing and privacy   | Security and release checklists; no automatic Marketplace submission                           | release-readiness and SECURITY                      |
| Private add-ons          | Same manifest/runtime contract; workspace whitelisting remains a portal responsibility         | deployment guide                                    |

The source URLs and capture markers remain in each vendored document. Network-dependent schema and
documentation freshness checks stay outside deterministic PR verification.
