# Quality Gates: @apet97/clockify-addon-sdk

The root `npm run ci:verify` script is the canonical local and CI gate. It runs the package checks
through npm workspaces and mirrors the package's `prepack` chain, so the published tarball is always
built and verified from a green tree.

1. **`npm run type-check`** — `tsc -p tsconfig.typecheck.json`. Compiles `src`, the generator,
   `examples`, and the type-state probes under `tests/types/*.probe.ts` (guarded by
   `tests/typecheck-gate.test.ts`), so a weakened builder fails this gate.
2. **`npm run verify:generated`** — regenerates `src/clockify/generated/**` from the vendored
   schemas and fails on any drift.
3. **`npm run test`** — the full `vitest` suite.
4. **`npm run build`** — emits the ESM and CJS outputs with type declarations.
5. **`npm run verify:dist`** — imports the **built** ESM and CJS and boots the README quick-start; a
   green `build` alone does not prove the package imports.
6. **`npm pack --dry-run`** — confirms the tarball contents (`dist` + `docs` + vendored
   `schemas/clockify-manifests` + `LICENSE` + `README`).
7. **`npm audit --omit=dev --json` and `npm audit --json`** — production and full dependency audit;
   both should report 0 vulnerabilities.

GitHub Actions runs the same root gate on Node 22.x and 24.x for pushes to `main`, pull requests,
and manual dispatches. Node 22 is the minimum supported runtime.

Linting and formatting are intentionally not configured for this lightweight build: `npm run lint`
and `npm run format:check` are no-op stubs. Add check-only ESLint/Prettier in a separate focused
change if the SDK grows enough to justify the extra dependencies and maintenance.
