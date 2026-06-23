# Dependency Strategy

This package ships both ESM and CommonJS entry points. The `verify:dist` gate imports both built
formats and boots the README quick start, so dependency upgrades must preserve those package-format
guarantees.

## `jose`

SDK 1.x uses `jose@6` while preserving CommonJS support. `jose@6` is ESM-only (`"type": "module"`
with no `require` export condition), so SDK runtime code must not statically import it in files that
also build to CommonJS. Use dynamic `import("jose")` inside the signing and verification paths
instead.

The public SDK no longer exposes `jose`'s removed `KeyLike` type. Use the SDK-owned aliases
`ClockifyCryptoKey`, `ClockifyPublicKeyInput`, and `ClockifyPrivateKeyInput`, which map to the key
inputs accepted by `jose@6`.

Spike result on 2026-06-23:

- `npm run type-check`, `npm run build`, `npm run verify:public-api`, `npm run verify:dist`,
  `npm run verify:package-lint`, and `npm run verify:package-consumer` passed with `jose@6.2.3`.
- Direct `require("jose")` still emits an experimental warning on Node 22.12.0 and is clean on
  Node 22.13.0.
- The packed SDK's installed ESM/CJS runtime consumers and TypeScript ESM/CJS consumers passed under
  Node 22.12.0 and Node 22.13.0 because the SDK uses dynamic imports internally.

Do not reintroduce static `jose` runtime imports in CJS-built SDK files unless the package drops its
CommonJS build or raises its runtime floor with explicit owner approval.

## Build and test tooling

The source-build toolchain intentionally tracks current majors when they preserve the SDK runtime
contract:

- TypeScript 6 emits the ESM and CJS declaration surfaces. Emit configs set `rootDir: "./src"` and
  CJS uses `module`/`moduleResolution: "Node16"` so the package build avoids deprecated Node10
  resolution.
- Vitest 4 runs the test suite. `npm run test:coverage` uses the V8 coverage provider with text and
  JSON summary reporters.
- Vite 8 powers Vitest and requires Node 22.12+ within the supported Node 22 line. The published
  package runtime support remains `>=22`; do not raise it just because the source-build tools have a
  narrower patch-level requirement.

## Express

The Express adapter is intentionally thin. Express stays an optional peer dependency and the SDK test
fixture runs against Express 5 so the peer range can include both `^4.17.0` and `^5.0.0`.
