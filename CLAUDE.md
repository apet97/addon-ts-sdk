# CLAUDE.md

Quick reference for Claude Code and other contributors working in this repository.

## How an add-on works

Clockify loads `GET /manifest`, then calls the registered lifecycle, component, and webhook routes.
The SDK owns manifest construction and static validation, exact routing, signed-request
verification, runtime adapters, storage contracts, browser-response helpers, and
Marketplace-specific add-on transport. The application owns durable persistence, secret handling,
business logic, public-origin configuration, deployment, and operational policy.

- For `INSTALLED`, verify the signed request and matched payload before storing its `authToken` and
  `apiUrl`. Retain the verified signed `backendUrl` separately for `ClockifyAddonClient`.
- Treat the component `auth_token` as transient.
- Verify the webhook event, the signed installation context, and the stored expected webhook token
  before handling a delivery.
- Process `DELETED` cleanup with the documented unconditional lifecycle semantics.
- Entity-specific Clockify REST resources, CLI, and MCP behavior belong to the separate
  `clockify-ts-sdk`.

## Commands

Run commands from the repository root unless noted otherwise.

| Command                                                          | Purpose                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                         | Install the locked workspace dependencies.                                                                              |
| `npm test -w @apet97/clockify-addon-sdk -- tests/<file>.test.ts` | Run a focused Vitest file while developing.                                                                             |
| `npm run verify:fast`                                            | Type-check, check generated drift, replay local Clockify fixtures, build, and verify built imports.                     |
| `npm run verify:docs`                                            | Check active documentation links, anchors, required navigation, paired agent contracts, and configured stale claims.    |
| `npm run verify:generated`                                       | Check schema provenance and compare fresh temporary generation with committed output.                                   |
| `npm run verify:scaffolds`                                       | Pack both packages and execute generated Node and real `workerd` Worker projects, plus Wrangler dry-runs.               |
| `npm run ci:verify`                                              | Run the deterministic full local/CI gate, including docs, coverage, package, scaffold, and audit checks.                |
| `npm run verify:schema-live`                                     | Manually compare vendored schemas with Clockify's live schema endpoint; this is intentionally outside deterministic CI. |
| `npm run release:preflight`                                      | Confirm proposed workspace versions are absent from npm immediately before an authorized publish.                       |
| `npm run release:verify`                                         | Run CI, live-schema, and publish dry-run checks only for new unpublished workspace versions.                            |
| `npm run verify:registry`                                        | Verify both exact public artifacts from a disposable consumer after publication.                                        |

Intentional public declaration changes require a build, an explicit
`npm run verify:public-api -w @apet97/clockify-addon-sdk -- --update`, and review of the snapshot
diff. Intentional schema/model changes start from the vendored schema or generator, followed by
`npm run generate -w @apet97/clockify-addon-sdk` and generated-drift verification.

## Documentation ownership

- `docs/getting-started.md`, `docs/how-an-addon-works.md`, and `docs/guides/**` are the builder
  journey. Keep them task-oriented and application-facing.
- `addon-sdk/README.md`, `addon-sdk/docs/**`, and `create-clockify-addon/README.md` are package and
  API references. The creator's generated project README is owned by the template source in
  `create-clockify-addon/src/index.mjs`.
- `docs/maintainers/**` owns architecture, product boundaries, quality gates, publication records,
  live Marketplace evidence, migration, and Java-parity evidence. Exact published versions belong
  only in `docs/maintainers/release-readiness.md`.
- `MARKETPLACE_DOCS/**` is captured upstream material with provenance; numbered snapshots are not
  authored builder documentation.
- `addon-sdk/src/clockify/generated/**` and `addon-sdk/public-api.snapshot.md` are generated evidence.
  Change their owning inputs or explicit update command, never their contents by hand.
- `docs/superpowers/**` and `docs/archive/**` are historical evidence. Ignored local files such as
  `.superpowers/**`, `GOAL.md`, and `verification_report.md` are execution notes, not repository
  documentation.

Run `npm run verify:docs` after authored Markdown changes. Its active-document gate checks local
links and anchors, the builder index, the shared agent body, and configured stale claims while
respecting the upstream, generated, historical, and ignored-local boundaries above.

## Stable engineering rules

- Keep the root SDK entrypoint runtime-neutral. Runtime-specific Node, Express, and Fetch behavior
  belongs behind adapter subpaths; never introduce `node:*` through portable entrypoints.
- Use Web Crypto for portable cryptography. Keep `jose` behind dynamic imports so installed ESM and
  CommonJS consumers remain valid.
- Registration is atomic: initialize an omitted manifest descriptor array only after its route binds;
  an identical declaration may be reused, but a conflict must leave router and manifest unchanged.
- Verify Clockify JWT algorithm, issuer, type, subject, expiration profile, event, and installation
  context at the correct boundary. A webhook route must configure exactly one fixed or lookup source
  for its stored expected token. Browser messaging must match the exact trusted origin and source.
- Keep installation and webhook credentials server-side and encrypted at rest. Ephemeral stores are
  local-development aids only. Never expose installation credentials to generated UI or logs.
- Keep Node and Fetch body-limit semantics aligned for declared and streamed bodies. Express body
  limits remain the host application's responsibility. Reject malformed sizes before application
  error handling and oversized bodies before dispatch.
- Safe reads may retry transient failures. Mutations may replay only after a confirmed `429`.
  Caller aborts are terminal, and timeout bounds stay validated. Before backoff, cancel any
  discarded retry body so it cannot replace the intended result.
- Never hardcode Clockify service hosts. Build `/v1` entity bases from the documented verified
  inputs. Retain the signed `backendUrl` for Marketplace `/addon/...` calls. Encode every dynamic
  path segment, and reject empty or dot-only segments before transport.
- Use `X-Addon-Token`, not `Authorization`, for Clockify add-on calls. Never log tokens, signatures,
  private keys, outbound query strings, or unsanitized credentials.
- Runtime manifest validation uses generated static Draft-04 validators. Do not add a runtime AJV
  compiler or string code generation. Preserve `addon-sdk/THIRD_PARTY_NOTICES.md` and its packed
  consumer check when validator generation changes.
- Never hand-edit generated models, validators, or the public API snapshot. Change the owning
  schema, generator, or source instead. Update schema provenance deliberately, and include focused
  regression coverage plus the generated diff.

## Layout

- `addon-sdk/src/` — portable SDK source, runtime adapters, Clockify modules, client, UI, and testing
  exports; generated manifest code lives under `src/clockify/generated/`.
- `addon-sdk/docs/`, `addon-sdk/examples/`, `addon-sdk/schemas/`, `addon-sdk/tests/`, and
  `addon-sdk/scripts/` — package reference, runnable examples, vendored schemas/provenance, tests,
  and package build/verification tools.
- `create-clockify-addon/src/` — creator API and generated project templates, including the project
  README; `bin/` is the CLI and `scripts/verify-scaffolds.mjs` owns packed scaffold proof.
- `docs/` — builder and maintainer documentation; `MARKETPLACE_DOCS/` — captured upstream sources.
- `scripts/` — repository documentation, release, registry, and Marketplace verification tools;
  `.github/workflows/` owns deterministic CI and scheduled/manual live-schema checks.

## Delivery

- Preserve unrelated working-tree changes and keep each commit limited to the requested task. Run
  focused tests while editing, then the applicable docs/generated/public-API checks and
  `npm run ci:verify` before handoff.
- Update user-visible docs with behavior changes. A green local gate is not evidence of a fresh npm
  registry publish, an authenticated Clockify check, or a Marketplace submission. Record that
  evidence only in the canonical maintainer documents, and only after the corresponding live check.
- Do not change CI, authentication, security policy, package versions, or publication settings
  without explicit authority. Do not run `release:verify` against unchanged published versions. Its
  publish dry-run must reject immutable versions.
- Commit when requested. Push only when explicitly requested, and publish only with explicit
  npm-owner approval for the exact packages and versions. When both packages are authorized, publish
  the SDK first and the creator second, then run `npm run verify:registry`.
- For an authorized two-package release:
  1. Update both workspace versions and the lockfile together.
  2. Run `release:preflight`, then `release:verify`.
  3. Push the exact source, and wait for green CI before publishing.
  4. Record the post-registry receipt in `docs/maintainers/release-readiness.md`.
- Before a direct `main` push:
  1. Fetch `origin`.
  2. Confirm `origin/main` is an ancestor of the commit.
  3. Push without force.
  4. Verify the remote and local tips match.

  Never force-push or amend a pushed commit. Never redirect this repository's history to a
  similarly named project.
- This is an independent, unofficial project and is not affiliated with Clockify or CAKE.com.
