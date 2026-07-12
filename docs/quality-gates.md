# Quality Gates: @apet97/clockify-addon-sdk

The root `npm run ci:verify` script is the canonical local and CI gate. It runs the package checks
through npm workspaces, includes the package's `prepack` chain, and adds installed-package checks so
the publishable artifacts are always built and verified from a green tree.

For day-to-day SDK hacking, use **`npm run verify:fast`** from the repo root. It runs type-check,
generated drift, the local Clockify replay tests, build, and `verify:dist` without pack, package
consumer, audit, or live-schema checks.

1. **`npm run verify:deps`** — `npm ls --workspaces --depth=0`. Confirms the workspace dependency
   tree resolves before the heavier package checks run.
2. **`npm run type-check`** — `tsc -p tsconfig.typecheck.json`. Compiles `src`, the generator,
   `examples`, and the type-state probes under `tests/types/*.probe.ts` (guarded by
   `tests/typecheck-gate.test.ts`), so a weakened builder fails this gate.
3. **`npm run verify:generated`** — verifies schema provenance, generates fresh output in a temporary
   directory, compares it with committed `src/clockify/generated/**`, and removes the temporary files
   before exit.
4. **`npm run test:coverage`** — the full `vitest` suite plus enforced handwritten-code floors of
   97% statements, 92% branches, 98% functions, and 98% lines.
   - **`npm run test:replay`** — focused local Clockify replay coverage for component auth-token,
     installed lifecycle, stored-token webhook verification, and negative token/workspace cases.
5. **`npm run test`** — a focused non-coverage unit-test shortcut for local development.
6. **`npm run lint`** — check-only ESLint over the package source, tests, scripts, examples, and docs
   where applicable.
7. **`npm run format:check`** — check-only Prettier over the package. Vendored Marketplace docs,
   manifest schemas, generated Clockify models, build output, coverage, and tarballs are ignored.
8. **`npm run build`** — emits the ESM and CJS outputs with type declarations.
9. **`npm run verify:public-api`** — compares the built ESM declaration surface for the root,
   `/clockify`, `/adapters`, `/client`, `/ui`, and `/testing` entry points against
   `addon-sdk/public-api.snapshot.md`. Intentional public API changes must run
   `npm run build && npm run verify:public-api -- --update` and include the snapshot diff.
10. **`npm run verify:dist`** — imports the **built** ESM and CJS and boots the README quick-start; a
    green `build` alone does not prove the package imports.
11. **`npm run pack:dry-run`** — confirms the SDK tarball contains its built output, docs, vendored
    schemas, license, and README, while the creator tarball contains its bin, typed source export,
    license, and README.
12. **`npm run verify:package-lint`** — packs both artifacts with `--ignore-scripts`, then runs
    `publint --strict` and Are The Types Wrong against each tarball. The dual-format SDK uses the
    Node16 profile; the ESM-only creator uses the `esm-only` profile. Node10 findings are not release
    blockers because both packages support Node 22+.
13. **`npm run verify:package-consumer`** — packs the already-built package with `--ignore-scripts`,
    installs that tarball into temporary runtime ESM/CJS and TypeScript ESM/CJS consumers, imports
    the root and subpath entry points, checks `generated.v1_5`, type-checks declarations without
    requiring Express types, signs/verifies JWTs through `jose@6` dynamic imports, and boots a
    `/manifest` server smoke from the installed package.
14. **`npm run verify:scaffolds`** — packs both packages, installs the creator tarball into a
    temporary runner, and generates Node minimal, Node all-features, Worker minimal, and
    Worker all-features projects through that installed export. It installs and type-checks each
    project. It executes their runtime, requests `/manifest`, validates the response with the packed
    SDK, and asserts exact component/lifecycle/webhook counts. It also probes 404 handling, unsigned
    component rejection, and production configuration failure, then bundles both Worker entry
    points with Wrangler dry-runs. This is packed runtime proof, not a source grep or type-check
    proxy.
15. **`npm audit --omit=dev --json` and `npm audit --json`** — production and full dependency audit;
    both should report 0 vulnerabilities.

Manual freshness check:

- **`npm run verify:schema-live`** — fetches the live Clockify manifest schema endpoint, verifies
  versions 1.2–1.5 are structurally identical to the vendored schemas, and confirms version 1.6 still
  returns HTTP 400. This is intentionally outside `ci:verify` so CI remains deterministic and does not
  depend on Clockify network availability. `.github/workflows/schema-live.yml` runs this check on a
  Monday schedule and on manual dispatch; failures should be triaged as possible upstream schema
  drift or network outages, not as deterministic SDK regressions.

Dependency freshness:

- `.github/dependabot.yml` checks npm and GitHub Actions weekly. npm updates are grouped into
  SDK-tooling and SDK-runtime PRs so dependency review stays deliberate instead of noisy.
- Keep `@types/node` aligned to the Node 22 runtime floor (`^22`) unless the package support policy
  changes. Newer ambient Node majors are not routine maintenance bumps for this SDK.

Makefile shortcuts:

- `make verify-fast`, `make ci-verify`, `make release-verify`, `make schema-live`,
  `make package-lint`, and `make package-consumer` are thin aliases for the canonical root npm
  scripts. Legacy `addon-sdk-package` and `addon-sdk-parity` targets point at `ci-verify` and
  `verify-fast` respectively.

GitHub Actions runs the same root gate on Node 22.x and 24.x for pushes to `main`, pull requests,
and manual dispatches. Node 22 is the minimum supported runtime. The source-build toolchain is
TypeScript 6, Vitest 4, and Vite 8; Vite 8 requires Node 22.12+ within the supported Node 22 line.

The package `prepack` chain includes type-check, generated drift, tests, lint, format check, build,
`verify:public-api`, and `verify:dist`; `npm pack --dry-run` is therefore both a contents check and
a final package smoke. `verify:package-lint` and `verify:package-consumer` stay outside `prepack` to
avoid recursive package creation while still proving the tarball has a correct package shape and
works exactly as an installed dependency.
