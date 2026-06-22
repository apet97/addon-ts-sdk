# AGENTS.md

Conventions for anyone (human or agent) working in this repository.

## Layout

- `addon-sdk/` — the published package (`@apet97/clockify-addon-sdk`). All SDK code, schemas,
  examples, and tests live here. Run package commands from this directory.
- Root npm scripts proxy the package gates through npm workspaces; use `npm run ci:verify` from the
  repo root for the full local/CI verification chain.

## Source of truth

- Behaviour mirrors the upstream Clockify add-on Java SDK; the TypeScript port stays faithful to it.
- Manifest schemas are vendored under `addon-sdk/schemas/clockify-manifests/*.json`: 1.2–1.4 are
  byte-identical to the Clockify add-on Java SDK's bundled resources, 1.5 is taken verbatim from the
  live schema endpoint (modulo a trailing newline), and all are structurally identical to the live
  API (which serves them minified). Supported versions: **1.2, 1.3, 1.4, 1.5** (`?version=1.6`
  returns HTTP 400).
- `addon-sdk/schemas/clockify-manifests/provenance.json` records the supported schema list, source
  labels, and raw SHA-256 hashes. `npm run verify:generated` must fail if a supported schema is
  missing, changed without updating provenance, if the supported version set drifts, or if a fresh
  temporary generation differs from committed generated output.
- `addon-sdk/src/clockify/generated/**` is generated from those schemas. **Never edit it by hand** —
  change the schema or the generator, then `npm run generate`. Public generated interfaces include
  schema descriptions as JSDoc; keep that documentation in the generator, not in generated files.
- Builder step order follows each schema's `required` array (matching the upstream processor).
  Required array fields keep Java-parity empty-array defaults but must still throw at runtime when
  their setter was never called.
- Marketplace docs coverage is intentionally small and runtime-focused: request verification helpers,
  lifecycle payload guards, token/header constants, and environment/region claim extraction. Do not
  add a REST client, token exchange client, UI/window-event framework, persistence layer, or custom
  manifest validator unless explicitly requested.
- Clockify-signed tokens are verified as `RS256` JWTs with `iss=clockify`, `type=addon`, and
  `sub=<manifest key>`. Webhooks should use `verifyClockifyWebhookRequest()` with
  `expectedEventType`; lifecycle routes should use `X-Addon-Lifecycle-Token`; Clockify API calls use
  `X-Addon-Token`.
- Do not hardcode Clockify API/report/location/screenshot hosts. Use verified token claims such as
  `backendUrl`, `reportsUrl`, `locationsUrl`, and `screenshotsUrl`.
- Node `http` and Fetch adapters enforce `DEFAULT_MAX_BODY_BYTES` (`1_048_576`) before dispatch and
  return 413 for oversized bodies. Invalid `maxBodyBytes` values should throw configuration errors.
  Express body limits are configured by the host app, not the SDK.
- Express remains an optional peer. Keep the adapter structurally typed so root imports and non-Express
  consumers do not need Express types installed.
- Runtime support starts at Node 22. CI verifies Node 22.x and 24.x.

## Gates

| Command                                    | Checks                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ci:verify`                        | Canonical root gate: type-check, generated drift, tests, lint, format check, build, dist import smoke, pack dry-run, installed-consumer smoke, and audits. |
| `npm run type-check`                       | `src`, generator, examples, and the type-state probes. A weakened builder must fail this.                                                     |
| `npm run verify:generated`                 | Checks schema provenance, generates to a temporary directory, compares against committed generated files, and leaves tracked files untouched. |
| `npm run test`                             | vitest suite.                                                                                                                                 |
| `npm run lint`                             | Check-only ESLint over the package.                                                                                                           |
| `npm run format:check`                     | Check-only Prettier over the package.                                                                                                         |
| `npm run build`                            | ESM + CJS output.                                                                                                                             |
| `npm run verify:dist`                      | Imports the **built** ESM and CJS and boots the quick-start. A green `build` alone does not prove the package imports.                        |
| `npm run pack:dry-run`                     | Tarball contents (`dist` + `docs` + `schemas/clockify-manifests` + `LICENSE` + `README`).                                                     |
| `npm run verify:package-consumer`          | Packs the already-built package with scripts ignored, installs it into temporary ESM/CJS consumers, imports public subpaths, and serves `/manifest`. |
| `npm run audit:prod` / `npm run audit:all` | Production and full dependency audits; both should report 0 vulnerabilities.                                                                  |

GitHub Actions runs `npm run ci:verify` on Node 22.x and 24.x for pushes to `main`, pull requests,
and manual dispatches.

Linting and formatting are check-only CI gates. ESLint and Prettier intentionally ignore
`node_modules`, `dist`, `coverage`, `*.tgz`, vendored Marketplace docs, manifest schemas, and
generated Clockify models.

## Git / publish workflow

- For direct `main` publishes, first run `npm run ci:verify`, then `git fetch origin`, confirm ancestry,
  commit the branch, fast-forward `main`, and push `origin main`.
- Do not open a PR when the user explicitly asks to push to `main`.
- Do not push generated drift, a stale `dist/`, or a dry-run `.tgz` artifact.

## Notes

- Independent, unofficial project — not affiliated with Clockify or CAKE.com.
