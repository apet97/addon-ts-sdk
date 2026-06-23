import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createNodeHttpAddonServer } from "../src/adapters";
import {
  createInMemorySecureServerStore,
  createSecureServerAddon,
} from "../examples/secure-server";
import { generateTestKeys, signTestToken } from "../src/testing";

const ADDON_KEY = "secure-addon";
const ADDON_ID = "addon-local";
const WORKSPACE_ID = "workspace-local";
const OTHER_WORKSPACE_ID = "other-workspace";
const BASE_URL = "https://local.clockify.example/addon";
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const FIXTURE_PATH = join(
  process.cwd(),
  "tests",
  "fixtures",
  "clockify-replay",
  "replay-cases.json",
);

interface CliOptions {
  once: boolean;
  port: number;
  host: string;
}

interface ReplayFixture {
  cases: ReplayCase[];
}

interface ReplayCase {
  name: string;
  request: FixtureRequest;
  expectedStatus: number;
}

interface FixtureRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query?: Array<[string, string]>;
  body?: unknown;
}

interface TokenSet {
  componentAdminToken: string;
  componentUserToken: string;
  lifecycleToken: string;
  webhookToken: string;
  wrongWorkspaceToken: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { once: false, port: DEFAULT_PORT, host: DEFAULT_HOST };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--once") {
      options.once = true;
      continue;
    }
    if (arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new Error("--port requires a value");
      const port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error("--port must be an integer between 0 and 65535");
      }
      options.port = port;
      index += 1;
      continue;
    }
    if (arg === "--host") {
      const value = argv[index + 1];
      if (!value) throw new Error("--host requires a value");
      options.host = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function loadFixture(): ReplayFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as ReplayFixture;
}

function replacePlaceholders(value: unknown, tokens: TokenSet): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (_match, tokenName: keyof TokenSet) => {
      const token = tokens[tokenName];
      if (!token) throw new Error(`Unknown token placeholder: ${tokenName}`);
      return token;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, tokens));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, tokens)]),
    );
  }
  return value;
}

function requestUrl(origin: string, request: FixtureRequest, tokens: TokenSet): string {
  const url = new URL(request.path, origin);
  const query = replacePlaceholders(request.query, tokens) as Array<[string, string]> | undefined;
  for (const [key, value] of query ?? []) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

async function createTokens(): Promise<{
  publicKey: Awaited<ReturnType<typeof generateTestKeys>>["publicKey"];
  tokens: TokenSet;
}> {
  const keys = await generateTestKeys();
  const baseClaims = {
    workspaceId: WORKSPACE_ID,
    addonId: ADDON_ID,
    backendUrl: "https://developer.clockify.local/api",
    reportsUrl: "https://reports.clockify.local",
    locationsUrl: "https://locations.clockify.local",
    screenshotsUrl: "https://screenshots.clockify.local",
  };

  return {
    publicKey: keys.publicKey,
    tokens: {
      componentAdminToken: await signTestToken(keys.privateKey, ADDON_KEY, {
        ...baseClaims,
        user: "admin-user-local",
        workspaceRole: "OWNER",
        language: "EN",
        theme: "DEFAULT",
      }),
      componentUserToken: await signTestToken(keys.privateKey, ADDON_KEY, {
        ...baseClaims,
        user: "regular-user-local",
        workspaceRole: "USER",
        language: "EN",
        theme: "DARK",
      }),
      lifecycleToken: await signTestToken(keys.privateKey, ADDON_KEY, {
        ...baseClaims,
        user: "admin-user-local",
      }),
      webhookToken: await signTestToken(keys.privateKey, ADDON_KEY, baseClaims),
      wrongWorkspaceToken: await signTestToken(keys.privateKey, ADDON_KEY, {
        ...baseClaims,
        workspaceId: OTHER_WORKSPACE_ID,
      }),
    },
  };
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function installSignalHandlers(server: Server): void {
  let closing = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    console.log(`\nReceived ${signal}; stopping local Clockify emulator.`);
    server.close((error) => {
      if (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }
      process.exitCode = 0;
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function replayCase(
  origin: string,
  replayCase: ReplayCase,
  tokens: TokenSet,
): Promise<{ line: string; ok: boolean }> {
  const request = replayCase.request;
  const headers = replacePlaceholders(request.headers, tokens) as Record<string, string>;
  const body = replacePlaceholders(request.body, tokens);
  const response = await fetch(requestUrl(origin, request, tokens), {
    method: request.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ok = response.status === replayCase.expectedStatus;
  return {
    line: `${replayCase.name} ${request.method} ${request.path} -> ${response.status}`,
    ok,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { publicKey, tokens } = await createTokens();
  const addon = createSecureServerAddon({
    key: ADDON_KEY,
    name: "Secure Addon Example",
    baseUrl: BASE_URL,
    store: createInMemorySecureServerStore(BASE_URL),
    publicKey,
    expectedWorkspaceId: WORKSPACE_ID,
    expectedAddonId: ADDON_ID,
  });
  const server = createNodeHttpAddonServer(addon);
  const port = await listen(server, options.port, options.host);
  const origin = `http://${options.host}:${port}`;
  installSignalHandlers(server);

  try {
    console.log(`Local Clockify emulator listening on ${origin}`);
    console.log("Generated fake local JWTs with the SDK testing helpers.");
    console.log("");

    const results = [];
    for (const replayCaseInput of loadFixture().cases) {
      const result = await replayCase(origin, replayCaseInput, tokens);
      results.push(result);
      console.log(result.line);
    }

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      throw new Error(`Replay failed: ${failed.map((result) => result.line).join(", ")}`);
    }

    console.log("");
    console.log("Local Clockify replay OK");
    console.log("");
    console.log("Sample local URLs:");
    console.log(`${origin}/manifest`);
    console.log(`${origin}/component?auth_token=${tokens.componentAdminToken}`);
    console.log("");

    if (options.once) {
      await close(server);
      return;
    }

    console.log("Press Ctrl+C to stop.");
  } catch (error) {
    await close(server);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
