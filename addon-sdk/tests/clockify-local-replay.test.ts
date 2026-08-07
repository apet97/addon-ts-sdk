import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AddonRequest } from "../src";
import {
  createInMemorySecureServerStore,
  createSecureServerAddon,
} from "../snippets/secure-server";
import { generateTestKeys, signTestToken } from "../src/testing";

const ADDON_KEY = "secure-addon";
const ADDON_ID = "addon-local";
const WORKSPACE_ID = "workspace-local";
const OTHER_WORKSPACE_ID = "other-workspace";
const BASE_URL = "https://local.clockify.example/addon";
const FIXTURE_PATH = join(
  process.cwd(),
  "tests",
  "fixtures",
  "clockify-replay",
  "replay-cases.json",
);

type SecureServerOptions = Parameters<typeof createSecureServerAddon>[0];
type LocalSecureServerOptions = SecureServerOptions & {
  publicKey: Awaited<ReturnType<typeof generateTestKeys>>["publicKey"];
  expectedWorkspaceId: string;
  expectedAddonId: string;
};

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

function toAddonRequest(request: FixtureRequest, tokens: TokenSet): AddonRequest {
  return {
    method: request.method,
    path: request.path,
    headers: replacePlaceholders(request.headers, tokens) as AddonRequest["headers"],
    query: request.query
      ? new URLSearchParams(replacePlaceholders(request.query, tokens) as Array<[string, string]>)
      : undefined,
    body: replacePlaceholders(request.body, tokens),
  };
}

async function createTokens(): Promise<{
  keys: Awaited<ReturnType<typeof generateTestKeys>>;
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
    keys,
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

describe("local Clockify replay harness", () => {
  it("replays docs-shaped component, lifecycle, and webhook fixtures", async () => {
    const { keys, tokens } = await createTokens();
    const webhookPayloads: unknown[] = [];
    const options: LocalSecureServerOptions = {
      key: ADDON_KEY,
      name: "Secure Addon Example",
      baseUrl: BASE_URL,
      store: createInMemorySecureServerStore(BASE_URL),
      publicKey: keys.publicKey,
      expectedWorkspaceId: WORKSPACE_ID,
      expectedAddonId: ADDON_ID,
      onExpenseCreated(payload) {
        webhookPayloads.push(payload);
      },
    };
    const addon = createSecureServerAddon(options);

    for (const replayCase of loadFixture().cases) {
      const response = await addon.handle(toAddonRequest(replayCase.request, tokens));
      expect(response.status, replayCase.name).toBe(replayCase.expectedStatus);
      if (replayCase.name === "component:admin") {
        expect(response.headers?.["content-type"]).toBe("text/html");
        expect(response.body).toContain("Secure Clockify component");
      }
    }

    expect(webhookPayloads).toEqual([
      expect.objectContaining({
        id: "expense-local",
        workspaceId: WORKSPACE_ID,
        quantity: 12.4,
      }),
    ]);
  });

  it("runs the CLI replay once and prints a useful transcript", () => {
    const packageRoot = process.cwd();
    const tsxCli = resolve(packageRoot, "..", "node_modules", "tsx", "dist", "cli.mjs");
    const output = execFileSync(
      process.execPath,
      [tsxCli, "scripts/dev-clockify-local.ts", "--once", "--port", "0"],
      {
        cwd: packageRoot,
        encoding: "utf8",
      },
    );

    expect(output).toContain("Local Clockify replay OK");
    expect(output).toContain("manifest GET /manifest -> 200");
    expect(output).toContain("component:missing-token GET /component -> 401");
    expect(output).toContain("webhook:expense-created POST /webhooks/expense-created -> 204");
  });

  it("closes the default playground cleanly on Ctrl+C", async () => {
    const packageRoot = process.cwd();
    const tsxCli = resolve(packageRoot, "..", "node_modules", "tsx", "dist", "cli.mjs");
    const result = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      stderr: string;
      stdout: string;
    }>((resolvePromise, rejectPromise) => {
      const child = spawn(
        process.execPath,
        [tsxCli, "scripts/dev-clockify-local.ts", "--port", "0"],
        {
          cwd: packageRoot,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      let interrupted = false;
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        rejectPromise(new Error(`Timed out waiting for playground startup.\n${stdout}\n${stderr}`));
      }, 10_000);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (!interrupted && stdout.includes("Press Ctrl+C to stop.")) {
          interrupted = true;
          child.kill("SIGINT");
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        rejectPromise(error);
      });
      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        resolvePromise({ code, signal, stderr, stdout });
      });
    });

    expect(result.stdout).toContain("Local Clockify replay OK");
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
  }, 15_000);
});
