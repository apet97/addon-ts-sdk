# Dependency Strategy

This package ships both ESM and CommonJS entry points. The `verify:dist` gate imports both built
formats and boots the README quick start, so dependency upgrades must preserve those package-format
guarantees.

## Published dependency boundary

The published package declares `jose` as its one direct dependency. Express is a separate optional
peer. `ajv` and `ajv-draft-04` are `devDependencies`: repository code generation uses them to produce
the committed schema 1.2-1.6 validators, but consumers never install them.

- Signing and verification paths dynamically import ESM-only `jose@6`.
- Repository code generation uses AJV Draft-04 and AJV standalone output to create the committed
  schema 1.2-1.6 validators at generation time, not at consumer install time.
- Runtime manifest validation imports those static generated validators. It does not import an AJV
  compiler, call `eval` or `Function`, or generate code at request time, which keeps the validation
  path compatible with Workers that prohibit string code generation.

Do not describe the package as loading AJV at runtime, and do not add `ajv`/`ajv-draft-04` back as
direct dependencies without deliberate review. Dependency placement is a package decision separate
from the Worker-safe runtime implementation.

## `jose`

SDK 1.x uses `jose@6` while preserving CommonJS support. `jose@6` is ESM-only (`"type": "module"`
with no `require` export condition), so SDK runtime code must not statically import it in files that
also build to CommonJS. Use dynamic `import("jose")` inside the signing and verification paths
instead.

The public SDK does not expose `jose`'s removed `KeyLike` type. Use the SDK-owned aliases
`ClockifyCryptoKey`, `ClockifyPublicKeyInput`, and `ClockifyPrivateKeyInput`, which map to the key
inputs accepted by `jose@6`.

`npm run verify:package-consumer` installs the packed SDK into runtime and TypeScript ESM/CJS
consumers and exercises the signing and verification path. Source development starts at Node
22.13.0; the published package runtime contract remains Node 22 or newer.

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
- Vite 8 powers Vitest and requires Node 22.12+ within the supported Node 22 line. ESLint 10 sets the
  effective source-development floor at Node 22.13.0, which is pinned in root metadata and CI. The
  published package runtime support remains `>=22`; do not raise it just because source-build tools
  have a narrower patch-level requirement.
- TypeScript stays on major 6 and `@types/node` stays on major 22 until their compatibility lanes are
  reviewed deliberately. Dependabot groups routine tooling updates as minor/patch changes and
  ignores those two unsupported majors.

## Express

The Express adapter is intentionally thin. Express stays an optional peer dependency and the SDK test
fixture runs against Express 5 so the peer range can include both `^4.17.0` and `^5.0.0`.
