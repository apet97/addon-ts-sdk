# Getting Started

## Prerequisites

You need Node 22.13.0 or newer, npm, a Clockify developer workspace, and a public HTTPS URL before
installing the add-on in Clockify.

## Create a project

Create the default Node project with component, lifecycle, and webhook routes:

```bash
npm create clockify-addon@latest my-addon
cd my-addon
```

The creator accepts both separated and equals forms for its options. Pass options after npm's `--`
separator:

```bash
npm create clockify-addon@latest my-addon -- --runtime worker --features minimal
```

| Option       | Values             | Default | Result                                                        |
| ------------ | ------------------ | ------- | ------------------------------------------------------------- |
| `--runtime`  | `node` or `worker` | `node`  | Generates a Node HTTP or Fetch/Worker bootstrap               |
| `--features` | `all` or `minimal` | `all`   | Includes lifecycle and webhook routes, or the component alone |

All generated variants use the SDK's schema 1.5 manifest builders.

## Understand the generated files

- `src/addon.ts` defines the shared `createAddon` function, builds the schema 1.5 manifest, and
  registers the component plus the selected lifecycle and webhook routes.
- `src/index.ts` is the runtime entry point. It starts the Node HTTP server or exports the
  Fetch/Worker handler.
- `.env.example` lists the public origin, iframe parent origin, and explicit local-development
  switches.
- `package.json` contains the SDK dependency and the runtime-specific `start` command.

## Configure it

Copy `.env.example` to `.env`, replace the manifest key in `src/addon.ts`, and configure:

- `PUBLIC_BASE_URL`: the public HTTPS origin used by the manifest and browser security helpers.
- `CLOCKIFY_PARENT_ORIGIN`: the exact Clockify origin that embeds the component. Use
  `https://developer.clockify.me` in a developer workspace or `https://app.clockify.me` in the
  production app.
- `ALLOW_LOCAL_REQUEST_ORIGIN`: permits a request-derived canonical loopback origin only during
  explicit local Fetch/Worker development. It does not relax the production HTTPS requirement.
- `ALLOW_EPHEMERAL_STORAGE`: enables the generated in-memory installation store for local
  development only. Keep it disabled in production.

Before a real installation, replace the generated in-memory storage seam with durable storage and
wrap credential persistence with the SDK's encryption helper. The default all-features scaffold
returns setup errors for installation, deletion, and webhook handling until storage and processing
are wired or the explicit local-only switch is enabled.

## Run it

For the Node project:

```bash
npm install
cp .env.example .env
npm start
curl http://localhost:8080/manifest
```

The concrete URL above exercises the `GET /manifest` route. The response should be the generated
schema 1.5 manifest with your configured public base URL and registered descriptors.

Worker projects use the generated `npm start` command, which runs `wrangler dev src/index.ts`. See
the [creator package reference](../create-clockify-addon/README.md) for the current command and
option details.

## Install it in Clockify

Expose the running application through HTTPS, set `PUBLIC_BASE_URL` to that public origin, and add
`${PUBLIC_BASE_URL}/manifest` in the Clockify developer workspace. Clockify reads the manifest and,
for the default all-features project, sends the declared `INSTALLED` lifecycle callback. Verify that
request and persist its installation and webhook credentials server-side before returning success.

## Verify the first component

Clockify renders the declared `/component` route in a Clockify-hosted iframe and supplies a signed
`auth_token` query value. The generated route uses `withClockifyVerifiedComponentRequest` to verify
that value before returning iframe-safe HTML. Keep the token out of logs, browser storage, and
application-generated links, and keep `CLOCKIFY_PARENT_ORIGIN` exact.

## Continue

- [Understand the complete lifecycle and responsibility model](how-an-addon-works.md)
- [Browse the documentation index](README.md)
- [Use the SDK package reference](../addon-sdk/README.md)
- [Review the creator package reference](../create-clockify-addon/README.md)
