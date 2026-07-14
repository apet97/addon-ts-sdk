# create-clockify-addon

Scaffold a fail-closed Node or Fetch/Worker Clockify add-on project using
`@apet97/clockify-addon-sdk`.

## Quick start

Create the default Node project with a component, lifecycle routes, and a webhook route:

```bash
npm create clockify-addon@latest ./my-addon
cd ./my-addon
npm install
cp .env.example .env
npm start
```

The default is `--runtime node --features all`.

## CLI options

Pass creator options after npm's `--` separator. Separated values work:

```bash
npm create clockify-addon@latest ./my-addon -- --runtime node --features all
```

Equals forms work too:

```bash
npm create clockify-addon@latest ./my-addon -- --runtime=worker --features=minimal
```

| Runtime  | Features  | Generated project                                                            |
| -------- | --------- | ---------------------------------------------------------------------------- |
| `node`   | `all`     | Node HTTP bootstrap, component, `INSTALLED`/`DELETED`, and webhook routes    |
| `node`   | `minimal` | Node HTTP bootstrap and component route only                                 |
| `worker` | `all`     | Fetch/Worker bootstrap, component, `INSTALLED`/`DELETED`, and webhook routes |
| `worker` | `minimal` | Fetch/Worker bootstrap and component route only                              |

Run `npm create clockify-addon@latest -- --help` for the complete usage. Unknown flags, missing or
unsupported option values, and missing or extra target directories exit non-zero and print usage.
The creator also refuses to overwrite a non-empty target directory.

## Generated project

Every variant contains:

```text
my-addon/
├── .env.example
├── README.md
├── package.json
├── tsconfig.json
└── src/
    ├── addon.ts
    └── index.ts
```

- `src/addon.ts` builds the schema 1.5 manifest and registers the routes shared by both runtimes.
- `src/index.ts` starts the Node HTTP server or exports the Fetch/Worker handler.
- `package.json` installs the published `^1.0.0` SDK and provides `typecheck` and `start` scripts.
- The generated README explains the selected runtime, request flow, and production checklist.

## Configuration

Copy `.env.example` to `.env`, replace the manifest key in `src/addon.ts`, and configure:

| Variable                     | Purpose                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `PUBLIC_BASE_URL`            | Public HTTPS origin used in the generated manifest                                      |
| `CLOCKIFY_PARENT_ORIGIN`     | Exact Clockify origin that embeds the component; no wildcard or path                    |
| `ALLOW_LOCAL_REQUEST_ORIGIN` | Allows request-derived canonical loopback origins for explicit local Worker development |
| `ALLOW_EPHEMERAL_STORAGE`    | Enables the generated in-memory all-features store for local development only           |

Use `https://developer.clockify.me` as the parent origin for a developer workspace and
`https://app.clockify.me` for the production Clockify app.

## Runtime commands

After installing dependencies and configuring `.env`:

- Node projects run `npm start`, which executes `tsx src/index.ts` and listens on `PORT` or `8080`.
- Worker projects run `npm start`, which executes `wrangler dev src/index.ts`.

Request `GET /manifest` at the local URL printed by the runtime before configuring Clockify.

## Programmatic usage

The ESM-only package also exposes a typed programmatic API for tooling:

```bash
npm install create-clockify-addon
```

```ts
import { scaffoldClockifyAddon } from "create-clockify-addon";

await scaffoldClockifyAddon({
  directory: "./my-addon",
  runtime: "worker",
  features: "minimal",
});
```

Importing `create-clockify-addon` does not run the CLI or touch the file system. Files are created
only when `scaffoldClockifyAddon()` is called. The optional `sdkSpec` field lets repository tooling
substitute a packed SDK; normal generated projects use `^1.0.0`.

## Before production

The all-features template deliberately uses an in-memory installation store behind an explicit
local-development switch. Before installing a real add-on:

- replace it with a persistent encrypted installation store;
- add durable idempotency storage before processing webhooks;
- keep `ALLOW_EPHEMERAL_STORAGE=false`;
- serve the application over HTTPS; and
- keep `PUBLIC_BASE_URL` and `CLOCKIFY_PARENT_ORIGIN` explicit and exact.

Minimal projects do not generate lifecycle or webhook routes. Follow the same storage and
idempotency requirements if you add those routes later.

## Builder guides

The repository guides own the complete installation, UI, lifecycle, webhook, and deployment flow:

- [Getting started](https://github.com/apet97/addon-ts-sdk/blob/main/docs/getting-started.md)
- [How a Clockify add-on works](https://github.com/apet97/addon-ts-sdk/blob/main/docs/how-an-addon-works.md)
- [Installation and storage](https://github.com/apet97/addon-ts-sdk/blob/main/docs/guides/installation-and-storage.md)
- [Components and UI](https://github.com/apet97/addon-ts-sdk/blob/main/docs/guides/components-and-ui.md)
- [Webhooks and idempotency](https://github.com/apet97/addon-ts-sdk/blob/main/docs/guides/webhooks-and-idempotency.md)
- [Deployment and operations](https://github.com/apet97/addon-ts-sdk/blob/main/docs/guides/deployment-and-operations.md)

## Repository development

From a repository checkout, run the creator directly with:

```bash
node ./create-clockify-addon/bin/create-clockify-addon.mjs ./my-addon
```

Repository verification packs both packages, imports the installed creator artifact, generates all
four variants, installs the packed SDK, executes the scaffolds, and Wrangler-dry-runs both Worker
entry points. Generated projects do not rely on monorepo source imports.
