# Quality Gates: @apet97/clockify-addon-sdk

The root `npm run ci:verify` script is the canonical local and CI gate. It runs the package checks
through npm workspaces and mirrors the package's `prepack` chain, so the published tarball is always
built and verified from a green tree.

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
4. **`npm run test`** — the full `vitest` suite.
   - **`npm run test:replay`** — focused local Clockify replay coverage for component auth-token,
     installed lifecycle, stored-token webhook verification, and negative token/workspace cases.
5. **`npm run lint`** — check-only ESLint over the package source, tests, scripts, examples, and docs
   where applicable.
6. **`npm run format:check`** — check-only Prettier over the package. Vendored Marketplace docs,
   manifest schemas, generated Clockify models, build output, coverage, and tarballs are ignored.
7. **`npm run build`** — emits the ESM and CJS outputs with type declarations.
8. **`npm run verify:public-api`** — compares the built ESM declaration surface for the root,
   `/clockify`, `/adapters`, and `/testing` entry points against
   `addon-sdk/public-api.snapshot.md`. Intentional public API changes must run
   `npm run build && npm run verify:public-api -- --update` and include the snapshot diff.
9. **`npm run verify:dist`** — imports the **built** ESM and CJS and boots the README quick-start; a
   green `build` alone does not prove the package imports.
10. **`npm run pack:dry-run`** — confirms the tarball contents (`dist` + `docs` + vendored
    `schemas/clockify-manifests` + `LICENSE` + `README`).
11. **`npm run verify:package-consumer`** — packs the already-built package with `--ignore-scripts`,
    installs that tarball into temporary ESM, CJS, and TypeScript consumers, imports the root and
    subpath entry points, checks `generated.v1_5`, type-checks declarations without requiring
    Express types, and boots a `/manifest` server smoke from the installed package.
12. **`npm audit --omit=dev --json` and `npm audit --json`** — production and full dependency audit;
    both should report 0 vulnerabilities.

Manual freshness check:

- **`npm run verify:schema-live`** — fetches the live Clockify manifest schema endpoint, verifies
  versions 1.2–1.5 are structurally identical to the vendored schemas, and confirms version 1.6 still
  returns HTTP 400. This is intentionally outside `ci:verify` so CI remains deterministic and does not
  depend on Clockify network availability.

GitHub Actions runs the same root gate on Node 22.x and 24.x for pushes to `main`, pull requests,
and manual dispatches. Node 22 is the minimum supported runtime.

The package `prepack` chain includes type-check, generated drift, tests, lint, format check, build,
`verify:public-api`, and `verify:dist`; `npm pack --dry-run` is therefore both a contents check and
a final package smoke. `verify:package-consumer` stays outside `prepack` to avoid recursive package
creation while still proving the tarball works exactly as an installed dependency.
