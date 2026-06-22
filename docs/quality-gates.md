# Quality Gates: @apet97/clockify-addon-sdk

The root `npm run ci:verify` script is the canonical local and CI gate. It runs the package checks
through npm workspaces and mirrors the package's `prepack` chain, so the published tarball is always
built and verified from a green tree.

1. **`npm run type-check`** — `tsc -p tsconfig.typecheck.json`. Compiles `src`, the generator,
   `examples`, and the type-state probes under `tests/types/*.probe.ts` (guarded by
   `tests/typecheck-gate.test.ts`), so a weakened builder fails this gate.
2. **`npm run verify:generated`** — verifies schema provenance, generates fresh output in a temporary
   directory, compares it with committed `src/clockify/generated/**`, and removes the temporary files
   before exit.
3. **`npm run test`** — the full `vitest` suite.
4. **`npm run lint`** — check-only ESLint over the package source, tests, scripts, examples, and docs
   where applicable.
5. **`npm run format:check`** — check-only Prettier over the package. Vendored Marketplace docs,
   manifest schemas, generated Clockify models, build output, coverage, and tarballs are ignored.
6. **`npm run build`** — emits the ESM and CJS outputs with type declarations.
7. **`npm run verify:dist`** — imports the **built** ESM and CJS and boots the README quick-start; a
   green `build` alone does not prove the package imports.
8. **`npm pack --dry-run`** — confirms the tarball contents (`dist` + `docs` + vendored
   `schemas/clockify-manifests` + `LICENSE` + `README`).
9. **`npm audit --omit=dev --json` and `npm audit --json`** — production and full dependency audit;
   both should report 0 vulnerabilities.

GitHub Actions runs the same root gate on Node 22.x and 24.x for pushes to `main`, pull requests,
and manual dispatches. Node 22 is the minimum supported runtime.

The package `prepack` chain includes type-check, generated drift, tests, lint, format check, build,
and `verify:dist`; `npm pack --dry-run` is therefore both a contents check and a final package smoke.
