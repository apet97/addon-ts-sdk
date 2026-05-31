# CLAUDE.md

Guidance for Claude Code working in this repository. See [AGENTS.md](./AGENTS.md) for the full
conventions.

## What this is

A TypeScript SDK for the server side of a Clockify add-on: typed manifest builders, a request
router, runtime adapters, and RS256 webhook-signature verification. The package lives in
`addon-sdk/`. Independent, unofficial project — not affiliated with Clockify or CAKE.com.

## Working here

- Run all commands from `addon-sdk/`.
- **Never edit `addon-sdk/src/clockify/generated/**` by hand.** It is generated from
  `addon-sdk/schemas/clockify-manifests/*.json`. Change the schema or the generator, then
  `npm run generate`.
- Builder step order follows each schema's `required` array (matching the upstream Java SDK).

## Before claiming done — all gates green (from `addon-sdk/`)

```bash
npm run type-check        # compiles the type-state probes; a weakened builder must fail this
npm run verify:generated  # regenerates from schemas, fails on drift
npm run test
npm run build && npm run verify:dist   # build alone does NOT prove the package imports — verify:dist does
npm pack --dry-run        # tarball is dist + README only
```

## Gotchas (learned the hard way)

- A green `type-check` means nothing unless the probe files are actually in the program. The probes
  live in `tests/types/*.probe.ts`; `tests/typecheck-gate.test.ts` guards that they are compiled.
- A green `build` does not mean the published package works. `verify:dist` imports the **built** ESM
  and CJS and boots the README quick-start; it is wired into `prepack`.

## Schemas

1.2–1.5 are vendored and byte-identical to the live Clockify schema API; `?version=1.6` → HTTP 400.
