# Marketplace Coverage Matrix

This maintainer evidence map connects captured upstream Marketplace material to current SDK
behavior and recorded proof. It is not a builder tutorial or a claim of fresh Marketplace
acceptance.

This matrix maps the vendored `MARKETPLACE_DOCS` snapshot to SDK behavior. A row marked
"application responsibility" is deliberately not hidden behind an SDK success response.

| Marketplace area         | SDK coverage                                                                                                                            | Proof                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Introduction             | Manifest, runtime, lifecycle, webhook, component, client and UI layers                                                                  | API reference and packed scaffolds                  |
| Quick start              | Packed Node/Worker minimal/all: valid manifests, fail-closed paths, real `workerd` routes, and compilable Worker entries                | executable `verify:scaffolds`                       |
| Lifecycle                | Typed payload guards, verified wrappers, encrypted storage, and caller-qualified generation deletes                                     | lifecycle, creator and installation-store suites    |
| UI components            | Generated component builders and hardened HTML responses                                                                                | builder, security and creator suites                |
| Webhooks                 | Fixed-token raw verification, exactly-one-source wrappers, signed installation context, 1 MiB limits and owner leases                   | request-verification and webhook-idempotency suites |
| Structured settings      | Typed builders plus claim-driven GET/PATCH clients with bounded timeouts, bounded retry fallback, and response cleanup                  | settings and add-on-client suites                   |
| Developer account        | Application responsibility; authenticated installation remains outside deterministic repo gates                                         | 1.2.0 pointer below and release-readiness receipt   |
| Authentication           | RS256, issuer/type/subject pinning, expiry profiles and context matching                                                                | request-verification suite                          |
| Environments and regions | Absolute HTTPS/canonical loopback URLs, exact direct-client loopback spellings, encoded nondegenerate segments, and fail-closed origins | request-wire, client and origin suites              |
| Window events            | Source/origin-checked subscriptions and typed actions                                                                                   | UI suite                                            |
| Development checklist    | Security responses, redaction boundary, package/scaffold/audit gates                                                                    | `ci:verify`                                         |
| Publishing and privacy   | Security and release checklists; no automatic Marketplace submission                                                                    | release-readiness and SECURITY                      |
| Private add-ons          | Same manifest/runtime contract; workspace whitelisting remains a portal responsibility                                                  | deployment guide                                    |

The source URLs and capture markers remain in each vendored document. Network-dependent schema and
documentation freshness checks stay outside deterministic PR verification.

Clockify's real `DELETED` payload contains `addonId`, `workspaceId`, and `asUser`, but no
installation generation. `ClockifyInstallationStore.delete()` rejects a stale generation only when
the caller supplies `installedAt`; omitting it intentionally performs unconditional matching-record
cleanup. The generated development scaffold keeps that normal uninstall cleanup and therefore does
not claim protection from delayed events belonging to an earlier installation.

## 1.2.0 lifecycle evidence pointer

After publication, a project created with the public `create-clockify-addon@1.2.0` package was
installed in the authenticated developer workspace. The pass covered `INSTALLED`, `DELETED`, the
signed component request, and five of seven registered time-entry webhooks. `TIME_ENTRY_SPLIT` and
`TIME_ENTRY_RESTORED` remained unexercised because the review found no public REST endpoint that
triggers them. This is the latest lifecycle evidence. See the "1.2.0 release evidence" section of
`release-readiness.md` for the exact boundary and registry record.

## 1.1.0 lifecycle evidence pointer

A cloudflared-tunnel developer-workspace pass against an unpublished-tarball scaffold exercised
installation, component authentication, webhook delivery, and uninstall cleanup for the 1.1.0
release source before publication. The 1.2.0 pass supersedes this historical receipt. See the
"1.1.0 release evidence" section of `release-readiness.md` for the publish record. This repository
does not hold a sanitized route/status log for the 1.1.0 pass because the tunnel and server were
already removed before the publisher's confirmation was recorded.

## 1.0.5 registry-only evidence boundary

Release source commit `d46723956b9b5ff7fb5587bdc03fc8858c90113f` passed the full local release
gate and [SDK CI run
`29324693717`](https://github.com/apet97/addon-ts-sdk/actions/runs/29324693717) on Node 22.13.0 and
Node 24.x. Both exact public registry artifacts were then installed and executed from an isolated
empty npm cache:

- `@apet97/clockify-addon-sdk@1.0.5`: npm SHA-1
  `853a6701dfc53df18fa9086f04c08d5fda6904f8`
- `create-clockify-addon@1.0.5`: npm SHA-1
  `770f864ba8ed67d2954cd486ec4231c474d41e63`

This proves registry packaging, SDK ESM/CommonJS/TypeScript consumption, creator API/CLI execution,
generated-project type-checking, manifest validation, route failures, and production fail-closed
behavior for 1.0.5. No authenticated Marketplace install was run for this release. At publication,
the 1.0.3 receipt below was the latest lifecycle evidence, and 1.0.5 did not inherit it.

## 1.0.4 registry-only evidence boundary

Release source commit `0e2fde5a49e8d6860961339b7945ba6d2a177c07` passed the full local release
gate and SDK CI on Node 22.13.0 and Node 24.x. Both exact public registry artifacts were then
installed and executed from an isolated empty npm cache:

- `@apet97/clockify-addon-sdk@1.0.4`: npm SHA-1
  `3442f2cf37f1d058fba8f82ad051227f90647e0a`
- `create-clockify-addon@1.0.4`: npm SHA-1
  `879475363645aaa534a60630285d6af3b8f378ee`

This proves registry packaging, SDK ESM/CommonJS/TypeScript consumption, creator API/CLI execution,
generated-project type-checking, manifest validation, route failures, and production fail-closed
behavior for 1.0.4. No authenticated Marketplace install was run for this patch. At publication,
the 1.0.3 receipt below was the latest lifecycle evidence, and 1.0.4 did not inherit it.

## 1.0.3 evidence boundary

This historical receipt proves release source commit `303f9c6a732707b572f418b592e75575811a7447`, the
exact packed artifacts identified below, their authenticated developer-workspace behavior, and
their subsequent installation from the public npm registry. It does not prove a Marketplace
submission, future source changes, or future package versions.

## 1.0.3 sanitized live and registry receipt (2026-07-14)

The creator tarball generated a disposable Node all-features project, and the project installed the
SDK tarball from the same clean release source. The packed SDK validated its schema 1.5 manifest
with exactly one component, two lifecycle hooks, and one webhook. Before installation, runtime
preflight confirmed an unknown route returned 404, an unsigned component request returned 401, and
production configuration failed closed without an explicit public origin.

The authenticated Firefox developer workspace accepted the manifest. The signed component rendered
its expected HTML with CSP present and no `X-Frame-Options` response header. The redacting request
counter retained only this successful sequence:

```text
GET  /manifest             200
POST /lifecycle/installed  204
GET  /component            200
POST /webhooks/time-entry  204
POST /webhooks/time-entry  204
POST /lifecycle/deleted    204
```

The two webhook deliveries covered the disposable entry's create/stop updates. The entry was
deleted, the add-on was uninstalled, and the server, tunnel, proxy, generated project, screenshots,
packed files, and temporary workspace were removed. The component header check retained booleans
only. No headers, query strings, request bodies, JWTs, tokens, or tunnel hostname were retained.

The exact live-tested tarballs were then published in SDK-first order and verified from the public
registry:

- `@apet97/clockify-addon-sdk@1.0.3`: npm SHA-1
  `933248cf9f3b4cfc3b66391a61615dcd3518591b`
- `create-clockify-addon@1.0.3`: npm SHA-1
  `c18c65a9ffcd4fc1003b86cfb7fd0d6d5c1531b7`

`npm run verify:registry` passed exact-version SDK ESM, CommonJS, and TypeScript consumers; creator
API and CLI execution; installed project generation and type-checking; manifest validation; route
failures; and production fail-closed behavior.

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
