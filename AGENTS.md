# AGENTS.md

Conventions for anyone (human or agent) working in this repository.

## Layout

- `addon-sdk/` — the published package (`clockify-addon-sdk-ts-115`). All SDK code, schemas,
  examples, and tests live here. Run package commands from this directory.

## Source of truth

- Behaviour mirrors the upstream Clockify add-on Java SDK; the TypeScript port stays faithful to it.
- Manifest schemas are vendored under `addon-sdk/schemas/clockify-manifests/*.json` and are
  byte-identical to the live Clockify schema endpoint. Supported versions: **1.2, 1.3, 1.4, 1.5**.
- `addon-sdk/src/clockify/generated/**` is generated from those schemas. **Never edit it by hand** —
  change the schema or the generator, then `npm run generate`.
- Builder step order follows each schema's `required` array (matching the upstream processor).

## Gates (from `addon-sdk/`)

| Command | Checks |
|---|---|
| `npm run type-check` | `src`, generator, examples, and the type-state probes. A weakened builder must fail this. |
| `npm run verify:generated` | Regenerates from the schemas; fails on drift. |
| `npm run test` | vitest suite. |
| `npm run build` | ESM + CJS output. |
| `npm run verify:dist` | Imports the **built** ESM and CJS and boots the quick-start. A green `build` alone does not prove the package imports. |
| `npm pack --dry-run` | Tarball contents (`dist` + README only). |

## Notes

- Independent, unofficial project — not affiliated with Clockify or CAKE.com.
