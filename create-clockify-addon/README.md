# create-clockify-addon

Scaffolds fail-closed Node or Fetch/Worker Clockify add-on projects using
`@apet97/clockify-addon-sdk`.

The creator and SDK are source-only today. From this repository checkout, run:

```bash
node ./create-clockify-addon/bin/create-clockify-addon.mjs ./my-addon --runtime node --features all
```

Both separated and equals forms are accepted. `--runtime` is `node` or `worker`; `--features` is
`all` or `minimal`. Defaults are Node plus all features. Run `--help` for the complete CLI usage.
Worker projects start with `wrangler dev src/index.ts`, so Wrangler receives the generated module
entry point explicitly.

The ESM-only package also exposes a typed programmatic API for tooling:

```ts
import { scaffoldClockifyAddon } from "create-clockify-addon";

await scaffoldClockifyAddon({
  directory: "./my-addon",
  runtime: "worker",
  features: "minimal",
});
```

The generated dependency points at the future `^1.0.0` SDK release. Until that registry release
exists, pack the SDK locally and replace the generated dependency with the tarball's absolute
`file:` path before installing. `npm create clockify-addon` becomes the supported invocation only
after the creator package is actually published.

Repository verification packs both packages, imports this API from the installed creator tarball,
generates all four runtime/feature combinations, and compiles both Worker entry points with
Wrangler. The generated projects never rely on creator or SDK workspace-source imports.

Generated projects require explicit `PUBLIC_BASE_URL` and `CLOCKIFY_PARENT_ORIGIN` values. They
fail closed until a durable installation store is wired; `ALLOW_EPHEMERAL_STORAGE=true` enables the
generated in-memory store for local development only and must not be used in production. The
generated `DELETED` handler performs normal unqualified uninstall cleanup. Clockify's payload has no
installation generation, so stale-event protection requires application-supplied correlation.

`CLOCKIFY_PARENT_ORIGIN` must be the exact Clockify origin embedding the component. Use
`https://app.clockify.me` for the production app and `https://developer.clockify.me` when validating
inside a developer workspace. A mismatched origin is intentionally rejected by the managed
`frame-ancestors` policy.
