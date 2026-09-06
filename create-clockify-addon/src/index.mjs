import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { WRANGLER_COMPATIBILITY_DATE } from "./wrangler-date.mjs";

function packageName(directory) {
  const cleaned = basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return cleaned.slice(0, 63).replace(/[-_]+$/g, "") || "clockify-addon";
}

function assertScaffoldOptions(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("options must be an object.");
  }
  if (
    typeof options.directory !== "string" ||
    options.directory.trim() === ""
  ) {
    throw new TypeError("directory must be a non-empty string.");
  }
  if (
    options.sdkSpec !== undefined &&
    (typeof options.sdkSpec !== "string" || options.sdkSpec.trim() === "")
  ) {
    throw new TypeError("sdkSpec must be a non-empty string when provided.");
  }
}

function commonSource(features) {
  const all = features === "all";
  const imports = [
    "ClockifyComponent",
    ...(all ? ["ClockifyLifecycleEvent"] : []),
    "ClockifyManifest",
    ...(all ? ["ClockifyWebhook", "InMemoryClockifyInstallationStore"] : []),
    "createClockifyHtmlResponse",
    "createClockifySignatureParser",
    "createValidatedClockifyAddon",
    ...(all ? ["normalizeClockifyWebhookPath"] : []),
    "resolveClockifyPublicOrigin",
    ...(all
      ? [
          "withClockifyDeletedLifecycleRequest",
          "withClockifyInstalledLifecycleRequest",
        ]
      : []),
    "withClockifyVerifiedComponentRequest",
    ...(all ? ["withClockifyVerifiedWebhookRequest"] : []),
  ];
  const extraDefinitions = all
    ? `
  const installed = ClockifyLifecycleEvent.v1_5Builder()
    .path("/lifecycle/installed")
    .onInstalled()
    .build();
  const deleted = ClockifyLifecycleEvent.v1_5Builder()
    .path("/lifecycle/deleted")
    .onDeleted()
    .build();
  const webhook = ClockifyWebhook.v1_5Builder()
    .onNewTimeEntry()
    .path("/webhooks/time-entry")
    .build();`
    : "";
  const extraRegistrations = all
    ? `
  addon.registerLifecycleEvent(
    installed,
    withClockifyInstalledLifecycleRequest(parser, async (_request, payload) => {
      if (environment.ALLOW_EPHEMERAL_STORAGE !== "true") {
        return { status: 503, body: "Configure a persistent encrypted installation store." };
      }
      await installations.save({ ...payload, installedAt: Date.now() });
      return { status: 204 };
    }),
  );
  addon.registerLifecycleEvent(
    deleted,
    withClockifyDeletedLifecycleRequest(parser, async (_request, payload) => {
      if (environment.ALLOW_EPHEMERAL_STORAGE !== "true") {
        return { status: 503, body: "Configure installation cleanup before enabling deletion." };
      }
      await installations.delete({
        workspaceId: payload.workspaceId,
        addonId: payload.addonId,
      });
      return { status: 204 };
    }),
  );
  addon.registerWebhook(
    webhook,
    withClockifyVerifiedWebhookRequest(
      parser,
      {
        expectedEventType: "NEW_TIME_ENTRY",
        getExpectedWebhookAuthToken: async ({ workspaceId, addonId }) => {
          if (environment.ALLOW_EPHEMERAL_STORAGE !== "true") return undefined;
          const installation = await installations.load(workspaceId, addonId);
          return installation?.webhooks?.find((entry) =>
            normalizeClockifyWebhookPath(entry.path) === webhook.path,
          )?.authToken;
        },
      },
      async () => {
        // TODO(prod): make webhook processing idempotent — Clockify can redeliver an
        // event. Claim a lease keyed by a stable identifier from the payload (not the
        // request) before doing work, with a durable ClockifyIdempotencyLeaseStore.
        // InMemoryClockifyIdempotencyLeaseStore retains completed keys forever by
        // default — replace it with a durable store, or bound it explicitly:
        //   new InMemoryClockifyIdempotencyLeaseStore(Date.now, {
        //     completedTtlMs: 7 * 24 * 60 * 60 * 1000,
        //     maxCompletedEntries: 10_000,
        //   })
        //
        //   const result = await runClockifyIdempotentWebhook(
        //     leaseStore,
        //     { key: stableEventKey, owner: crypto.randomUUID(), leaseMs: 30_000 },
        //     () => handleBusinessLogic(request.body, claims),
        //   );
        //   if (result.status === "duplicate") return { status: 204 };
        return {
          status: environment.ALLOW_EPHEMERAL_STORAGE === "true" ? 204 : 503,
          ...(environment.ALLOW_EPHEMERAL_STORAGE === "true"
            ? {}
            : { body: "Configure stored-token verification and background processing." }),
        };
      },
    ),
  );`
    : "";
  const installationStore = all
    ? "\n\nconst installations = new InMemoryClockifyInstallationStore();"
    : "";
  return `import {
${imports.map((name) => `  ${name},`).join("\n")}
} from "@apet97/clockify-addon-sdk";${installationStore}

export interface AddonEnvironment {
  readonly PUBLIC_BASE_URL?: string;
  readonly CLOCKIFY_PARENT_ORIGIN?: string;
  readonly ALLOW_LOCAL_REQUEST_ORIGIN?: string;
  readonly ALLOW_EPHEMERAL_STORAGE?: string;
}

export function createAddon(environment: AddonEnvironment, requestUrl?: string) {
  const origin = resolveClockifyPublicOrigin({
    publicBaseUrl: environment.PUBLIC_BASE_URL,
    requestUrl,
    allowLocalRequestOrigin: environment.ALLOW_LOCAL_REQUEST_ORIGIN === "true",
  });
  const component = ClockifyComponent.v1_5Builder()
    .sidebar()
    .allowEveryone()
    .path("/component")
    .label("Clockify Add-on")
    .build();${extraDefinitions}

  const manifest = ClockifyManifest.v1_5Builder()
    .key("replace-with-your-unique-addon-key")
    .name("Clockify Add-on")
    .baseUrl(origin)
    .requireBasicPlan()
    .build();
  const addon = createValidatedClockifyAddon(manifest);
  const parser = createClockifySignatureParser(manifest.key);
  addon.registerComponent(
    component,
    withClockifyVerifiedComponentRequest(parser, async () => {
      const parentOrigin = environment.CLOCKIFY_PARENT_ORIGIN;
      if (!parentOrigin) {
        return { status: 503, body: "CLOCKIFY_PARENT_ORIGIN is not configured." };
      }
      return createClockifyHtmlResponse(
        "<!doctype html><html><body><main>Clockify add-on ready.</main></body></html>",
        { frameAncestors: [parentOrigin] },
      );
    }),
  );${extraRegistrations}

  return addon;
}
`;
}

function nodeSource() {
  return `import { pathToFileURL } from "node:url";

import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";
import { createAddon, type AddonEnvironment } from "./addon.js";

export interface NodeAddonEnvironment extends AddonEnvironment {
  readonly PORT?: string;
}

function parsePort(value: string | undefined): number {
  if (value !== undefined && !/^\\d+$/.test(value)) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }
  const port = Number(value ?? 8080);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }
  return port;
}

export function startNodeAddon(environment: NodeAddonEnvironment = process.env) {
  const port = parsePort(environment.PORT);
  const server = createNodeHttpAddonServer(createAddon(environment));
  return server.listen(port, () => {
    const address = server.address();
    const listeningPort =
      address && typeof address === "object" ? address.port : port;
    console.log(\`Clockify add-on listening on http://localhost:\${listeningPort}\`);
  });
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  process.loadEnvFile?.();
  startNodeAddon(process.env);
}
`;
}

function workerSource() {
  return `import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
import { createAddon, type AddonEnvironment } from "./addon.js";

export default {
  fetch(request: Request, environment: AddonEnvironment): Promise<Response> {
    return handleFetchRequest(createAddon(environment, request.url), request);
  },
};
`;
}

function projectReadme(runtime, features) {
  const start =
    runtime === "node"
      ? "Run `npm start` to start the Node HTTP server."
      : "Run `npm start`; the script invokes `wrangler dev src/index.ts`.";
  const featureFlow =
    features === "all"
      ? `- Clockify sends \`INSTALLED\` to \`/lifecycle/installed\`.
- Clockify sends \`NEW_TIME_ENTRY\` to \`/webhooks/time-entry\`.
- Clockify sends \`DELETED\` to \`/lifecycle/deleted\`.`
      : "Lifecycle and webhook routes were not generated for this minimal project.";
  const productionStorage =
    features === "all"
      ? `- Replace the in-memory development store with a persistent encrypted installation store.
- Back webhook processing with durable idempotency storage before handling \`NEW_TIME_ENTRY\` in production.`
      : `- If you add lifecycle routes, use a persistent encrypted installation store for credentials.
- If you add webhooks, add durable idempotency storage before processing them.`;

  return `# Clockify Add-on

## Run locally

1. Copy \`.env.example\` to \`.env\` and replace its example values.
2. Install dependencies with \`npm install\`.
3. ${start}
4. Request \`GET /manifest\` at the local URL printed by the runtime.

## Configure Clockify

- Replace \`replace-with-your-unique-addon-key\` in \`src/addon.ts\` with the manifest key from your Clockify add-on configuration.
- Set \`PUBLIC_BASE_URL\` to the public HTTPS origin that serves this project.
- Set \`CLOCKIFY_PARENT_ORIGIN\` to the exact Clockify origin that embeds the component. Do not use a wildcard or include a path.
- Keep \`ALLOW_LOCAL_REQUEST_ORIGIN\` limited to explicit canonical-loopback development.

## Project layout

- \`src/addon.ts\` builds the schema 1.5 manifest and registers the shared routes.
- \`src/index.ts\` is the ${runtime === "node" ? "Node HTTP" : "Fetch/Worker"} runtime entry point.
- \`.env.example\` lists the required origins and local-development switches.

## Request flow

- \`GET /manifest\` serves the validated manifest.
- \`/component\` verifies Clockify's signed component request before returning HTML.
${featureFlow}

## Before production

- Serve the add-on over HTTPS and keep \`PUBLIC_BASE_URL\` and \`CLOCKIFY_PARENT_ORIGIN\` explicit.
- Keep \`ALLOW_EPHEMERAL_STORAGE=false\`; the ephemeral path is for local development only.
${productionStorage}

## Learn more

- [Getting started](https://github.com/apet97/addon-ts-sdk/blob/main/docs/getting-started.md)
- [How a Clockify add-on works](https://github.com/apet97/addon-ts-sdk/blob/main/docs/how-an-addon-works.md)
`;
}

function tsconfig(runtime) {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib:
            runtime === "worker"
              ? ["ES2022", "DOM", "WebWorker"]
              : ["ES2022", "DOM"],
          types: runtime === "node" ? ["node"] : [],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ) + "\n"
  );
}

/** Creates a Clockify add-on project without overwriting existing files. */
function wranglerToml(name) {
  return `name = "${name}"
main = "src/index.ts"
compatibility_date = "${WRANGLER_COMPATIBILITY_DATE}"
`;
}

export async function scaffoldClockifyAddon(options) {
  assertScaffoldOptions(options);
  if (options.runtime !== "node" && options.runtime !== "worker")
    throw new Error("runtime must be node or worker");
  if (options.features !== "all" && options.features !== "minimal")
    throw new Error("features must be all or minimal");
  const directory = resolve(options.directory);
  try {
    if ((await readdir(directory)).length > 0)
      throw new Error("Target directory must be empty.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(resolve(directory, "src"), { recursive: true });
  const sdkSpec = options.sdkSpec ?? "^1.3.1";
  const manifest = {
    name: packageName(directory),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
      start:
        options.runtime === "node"
          ? "tsx src/index.ts"
          : "wrangler dev src/index.ts",
    },
    dependencies: { "@apet97/clockify-addon-sdk": sdkSpec },
    devDependencies: {
      typescript: "^6.0.3",
      ...(options.runtime === "node"
        ? { "@types/node": "^22.20.0", tsx: "^4.23.0" }
        : { wrangler: "^4.0.0" }),
    },
  };
  await Promise.all([
    writeFile(
      resolve(directory, "package.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    ),
    writeFile(resolve(directory, "tsconfig.json"), tsconfig(options.runtime)),
    writeFile(
      resolve(directory, ".env.example"),
      "PUBLIC_BASE_URL=https://your-addon.example\nCLOCKIFY_PARENT_ORIGIN=https://app.clockify.me\nALLOW_LOCAL_REQUEST_ORIGIN=false\nALLOW_EPHEMERAL_STORAGE=false\n",
    ),
    writeFile(
      resolve(directory, "src", "addon.ts"),
      commonSource(options.features),
    ),
    writeFile(
      resolve(directory, "src", "index.ts"),
      options.runtime === "node" ? nodeSource() : workerSource(),
    ),
    writeFile(
      resolve(directory, "README.md"),
      projectReadme(options.runtime, options.features),
    ),
    ...(options.runtime === "worker"
      ? [
          writeFile(
            resolve(directory, "wrangler.toml"),
            wranglerToml(packageName(directory)),
          ),
        ]
      : []),
  ]);
  return directory;
}
