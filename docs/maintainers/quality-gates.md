# Quality Gates: @apet97/clockify-addon-sdk

This maintainer runbook explains what each repository gate proves and which freshness boundaries
remain manual. Builders generally need the focused commands in the task guides, not this full gate
inventory.

The root `npm run ci:verify` script is the canonical local and CI gate. It runs the package checks
through npm workspaces, includes the package's `prepack` chain, and adds installed-package checks so
the publishable artifacts are always built and verified from a green tree.

For day-to-day SDK hacking, use **`npm run verify:fast`** from the repo root. It runs type-check,
generated drift, the local Clockify replay tests, build, and `verify:dist` without pack, package
consumer, audit, or live-schema checks.

1. **`npm run verify:deps`** — `npm ls --workspaces --depth=0`. Confirms the workspace dependency
   tree resolves before the heavier package checks run.
2. **`npm run type-check`** — `tsc -p tsconfig.typecheck.json`. Compiles `src`, the generator,
   `snippets`, and the type-state probes under `tests/types/*.probe.ts` (guarded by
   `tests/typecheck-gate.test.ts`), so a weakened builder fails this gate.
3. **`npm run verify:generated`** — verifies schema provenance, generates fresh output in a temporary
   directory, compares it with committed `src/clockify/generated/**`, and removes the temporary files
   before exit.
4. **`npm run verify:docs`** — checks active authored Markdown links and anchors, required builder
   navigation, the synchronized `AGENTS.md`/`CLAUDE.md` body, and configured stale claims. Captured
   upstream snapshots, generated evidence, historical plans, archives, and ignored local execution
   notes remain outside the active-doc set.
5. **`npm run test:coverage`** — the full `vitest` suite plus enforced handwritten-code floors of
   97% statements, 92% branches, 98% functions, and 98% lines.
   - **`npm run test:replay`** — focused local Clockify replay coverage for component auth-token,
     installed lifecycle, stored-token webhook verification, and negative token/workspace cases.
6. **`npm run test`** — the full non-coverage Vitest suite for local development.
7. **`npm run lint`** — check-only ESLint over the package plus every root `scripts/*.mjs` release
   tool through the shared flat configuration.
8. **`npm run format:check`** — check-only Prettier over the package and root release tools. Vendored
   Marketplace docs, manifest schemas, generated Clockify models, build output, coverage, and
   tarballs are ignored.
9. **`npm run build`** — emits the ESM and CJS outputs with type declarations.
10. **`npm run verify:public-api`** — compares the built ESM declaration surface for the root,
    `/clockify`, `/adapters`, `/client`, `/ui`, and `/testing` entry points against
    `addon-sdk/public-api.snapshot.md`. Intentional public API changes must run
    `npm run build` and then
    `npm run verify:public-api -w @apet97/clockify-addon-sdk -- --update` from the repository root and
    include the snapshot diff.
11. **`npm run verify:dist`** — imports the **built** ESM and CJS and boots the README quick-start; a
    green `build` alone does not prove the package imports.
12. **`npm run pack:dry-run`** — confirms the SDK tarball contains its built output, docs, vendored
    schemas, license, and README, while the creator tarball contains its bin, typed source export,
    license, and README.
13. **`npm run verify:package-lint`** — packs both artifacts with `--ignore-scripts`, then runs
    `publint --strict` and Are The Types Wrong against each tarball. The dual-format SDK uses the
    Node16 profile; the ESM-only creator uses the `esm-only` profile. Node10 findings are not release
    blockers because both packages require Node 22.13.0 or newer.
14. **`npm run verify:package-consumer`** — packs the already-built package with `--ignore-scripts`,
    installs that tarball into temporary runtime ESM/CJS and TypeScript ESM/CJS consumers, imports
    the root and subpath entry points, checks `generated.v1_5`, type-checks declarations without
    requiring Express types, signs/verifies JWTs through `jose@6` dynamic imports, and boots a
    `/manifest` server smoke from the installed package.
15. **`npm run verify:scaffolds`** — packs both packages, installs the creator tarball into a
    temporary runner, and generates Node minimal, Node all-features, Worker minimal, and
    Worker all-features projects through that installed export. It installs and type-checks each
    project. It executes their runtime through Node processes and real `workerd` Worker sessions,
    requests `/manifest`, validates the response with the packed SDK, and asserts exact
    component/lifecycle/webhook counts. It also probes 404 handling, unsigned component rejection,
    and production configuration failure. Separate Wrangler dry-runs bundle both Worker entry
    points. This is packed runtime proof, not a source grep or type-check proxy.
16. **`npm audit --omit=dev --json` and `npm audit --json`** — production and full dependency audit;
    both should report 0 vulnerabilities.

Manual freshness check:

- **`npm run verify:schema-live`** — fetches the live Clockify manifest schema endpoint, verifies
  versions 1.2–1.6 are structurally identical to the vendored schemas, and confirms version 1.7 still
  returns HTTP 400. This is intentionally outside `ci:verify` so CI remains deterministic and does not
  depend on Clockify network availability. `.github/workflows/schema-live.yml` runs this check on a
  Monday schedule, on manual dispatch, and (non-blocking) on pull requests that touch vendored
  schemas or generated manifest code; failures should be triaged as possible upstream schema drift
  or network outages, not as deterministic SDK regressions.

Documentation-only maintenance against unchanged published workspace versions runs
`npm run ci:verify` and `npm run verify:schema-live` as separate checks. Do not run
`npm run release:verify` for that case: its final publish dry-run must reject npm's immutable
published versions. These checks prove the repository and live schema boundary only; they do not
create new registry or authenticated Marketplace evidence.

Manual registry boundary checks:

- **`npm run release:preflight`** — reads the SDK and creator versions from their workspace
  manifests and fails unless both exact versions are absent from the configured npm registry. It is
  intentionally one-shot and fail-fast.
- **`npm run verify:registry`** — requires both exact workspace versions to exist in the configured
  registry, installs them into a disposable consumer, exercises ESM/CommonJS/TypeScript imports and
  the installed creator CLI, then generates, installs, type-checks, and executes a Node minimal
  project with manifest-count and failure-path assertions. Before installation it allows seven
  exact-version visibility checks with five-second waits, reporting only missing package versions;
  HTTP, timeout, abort, and malformed-metadata failures remain immediate.

Both commands depend on registry state and therefore remain outside `ci:verify`, `release:verify`,
and normal pull-request CI. Run the preflight immediately before publishing and the registry
consumer verification immediately afterward. Because `release:verify` ends with `release:dry-run`,
run it only for unpublished workspace versions.

Successful local gates and `release:preflight` establish only that a workspace version is a verified,
currently unpublished candidate. They do not establish npm publication, exact-registry consumption,
Marketplace submission, or fresh authenticated Clockify behavior; those require the separate
post-publish and live receipts described in `docs/maintainers/release-readiness.md`.

Dependency freshness:

- `.github/dependabot.yml` checks npm and GitHub Actions weekly. npm updates are grouped into
  SDK-tooling and SDK-runtime PRs so dependency review stays deliberate instead of noisy. Tooling
  groups accept only minor and patch updates.
- Keep `@types/node` aligned to the Node 22 runtime floor (`^22`) unless the package support policy
  changes. Keep TypeScript on major 6 until its next major is reviewed separately; Dependabot ignores
  both unsupported majors.

Makefile shortcuts:

- `make verify-fast`, `make ci-verify`, `make release-verify`, `make schema-live`,
  `make package-lint`, and `make package-consumer` are thin aliases for the canonical root npm
  scripts. Legacy `addon-sdk-package` and `addon-sdk-parity` targets point at `ci-verify` and
  `verify-fast` respectively.

GitHub Actions runs the same root gate on Node 22.13.0 and 24.x for pushes to `main`, pull requests,
and manual dispatches. Source development and both published packages require Node 22.13.0 or
newer. The source-build toolchain remains TypeScript 6, Vitest 4, and Vite 8.

The package `prepack` chain includes type-check, generated drift, tests, lint, format check, build,
`verify:public-api`, and `verify:dist`; `npm pack --dry-run` is therefore both a contents check and
a final package smoke. `verify:package-lint` and `verify:package-consumer` stay outside `prepack` to
avoid recursive package creation while still proving the tarball has a correct package shape and
works exactly as an installed dependency.
