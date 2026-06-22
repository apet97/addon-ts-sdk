import * as path from "node:path";
import {
  AddonResponse,
  ClockifyAddon,
  ClockifyAddonClaims,
  ClockifyComponent,
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecycleEvent,
  ClockifyLifecycleMatchedClaims,
  ClockifyManifest,
  ClockifyWebhook,
  clockifyLifecyclePayloadMatchesClaims,
  createClockifySignatureParser,
  isClockifyAdminRole,
  isClockifyInstalledLifecyclePayload,
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
  verifyClockifyWebhookRequest,
} from "../../src";
import { createNodeHttpAddonServer } from "../../src/adapters";

const EXPENSE_CREATED_WEBHOOK_PATH = "/webhooks/expense-created";

interface StoredWebhookTokenLookup {
  workspaceId: string;
  addonId: string;
  path: string;
  eventType: string;
}

interface SecureServerStore {
  saveInstallation(
    payload: ClockifyInstalledLifecyclePayload,
    claims: ClockifyLifecycleMatchedClaims,
  ): void | Promise<void>;
  findWebhookAuthToken(
    input: StoredWebhookTokenLookup,
  ): string | undefined | Promise<string | undefined>;
}

interface SecureServerOptions {
  key: string;
  name: string;
  baseUrl: string;
  store: SecureServerStore;
  renderComponent?: (claims: ClockifyAddonClaims) => AddonResponse | Promise<AddonResponse>;
  onExpenseCreated?: (payload: unknown, claims: ClockifyAddonClaims) => void | Promise<void>;
}

function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function normalizeWebhookPath(path: string, baseUrl?: string): string {
  let pathname = path;
  try {
    pathname = new URL(path).pathname;
  } catch {
    // Relative manifest paths are expected.
  }

  if (baseUrl) {
    try {
      const basePath = normalizePath(new URL(baseUrl).pathname);
      if (basePath !== "/" && pathname.startsWith(`${basePath}/`)) {
        pathname = pathname.slice(basePath.length);
      }
    } catch {
      // Invalid example base URLs should not hide the original path.
    }
  }

  return normalizePath(pathname.startsWith("/") ? pathname : `/${pathname}`);
}

export function createSecureServerAddon(
  options: SecureServerOptions,
): ClockifyAddon<ClockifyManifest<"1.5">> {
  const parser = createClockifySignatureParser(options.key);
  const manifest = ClockifyManifest.v1_5Builder()
    .key(options.key)
    .name(options.name)
    .baseUrl(options.baseUrl)
    .requireProPlan()
    .build();

  const addon = new ClockifyAddon(manifest);

  addon.registerComponent(
    ClockifyComponent.v1_5Builder()
      .activityTab()
      .allowAdmins()
      .path("/component")
      .label("Secure component")
      .build(),
    async (request) => {
      const result = await verifyClockifyComponentRequest(parser, request);
      if (!result.ok) return { status: 401, body: "Unauthorized" };
      if (!isClockifyAdminRole(result.claims.workspaceRole)) {
        return { status: 403, body: "Admins only" };
      }
      return options.renderComponent
        ? options.renderComponent(result.claims)
        : {
            status: 200,
            headers: { "content-type": "text/html" },
            body: "<html><body>Secure Clockify component</body></html>",
          };
    },
  );

  addon.registerLifecycleEvent(
    ClockifyLifecycleEvent.v1_5Builder().path("/lifecycle/installed").onInstalled().build(),
    async (request) => {
      const result = await verifyClockifyLifecycleRequest(parser, request);
      if (!result.ok) return { status: 401, body: "Unauthorized" };

      if (
        !isClockifyInstalledLifecyclePayload(request.body) ||
        !clockifyLifecyclePayloadMatchesClaims(request.body, result.claims)
      ) {
        return { status: 401, body: "Unauthorized" };
      }

      await options.store.saveInstallation(request.body, result.claims);
      return { status: 204 };
    },
  );

  addon.registerWebhook(
    ClockifyWebhook.v1_5Builder().onExpenseCreated().path(EXPENSE_CREATED_WEBHOOK_PATH).build(),
    async (request) => {
      const firstPass = await verifyClockifyWebhookRequest(parser, request, {
        expectedEventType: "EXPENSE_CREATED",
      });
      if (!firstPass.ok) return { status: 401, body: "Unauthorized" };

      const storedToken = await options.store.findWebhookAuthToken({
        workspaceId: firstPass.claims.workspaceId ?? "",
        addonId: firstPass.claims.addonId ?? "",
        path: EXPENSE_CREATED_WEBHOOK_PATH,
        eventType: firstPass.eventType,
      });
      if (!storedToken) return { status: 401, body: "Unauthorized" };

      const verified = await verifyClockifyWebhookRequest(parser, request, {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: storedToken,
        expectedWorkspaceId: firstPass.claims.workspaceId,
        expectedAddonId: firstPass.claims.addonId,
      });
      if (!verified.ok) return { status: 401, body: "Unauthorized" };

      await options.onExpenseCreated?.(request.body, verified.claims);
      return { status: 204 };
    },
  );

  return addon;
}

export function createInMemorySecureServerStore(baseUrl?: string): SecureServerStore {
  const webhookTokens = new Map<string, string>();
  const key = (workspaceId: string, addonId: string, path: string) =>
    `${workspaceId}:${addonId}:${normalizeWebhookPath(path, baseUrl)}`;

  return {
    saveInstallation(payload, claims) {
      for (const webhook of payload.webhooks ?? []) {
        webhookTokens.set(key(claims.workspaceId, claims.addonId, webhook.path), webhook.authToken);
      }
    },
    findWebhookAuthToken(input) {
      return webhookTokens.get(key(input.workspaceId, input.addonId, input.path));
    },
  };
}

export function startSecureServerExample(): void {
  const baseUrl = "https://example.com/addon";
  const addon = createSecureServerAddon({
    key: "secure-addon",
    name: "Secure Addon Example",
    baseUrl,
    store: createInMemorySecureServerStore(baseUrl),
  });

  createNodeHttpAddonServer(addon).listen(3000, () => {
    console.log("Secure addon server listening on http://localhost:3000");
  });
}

function isSecureServerExampleEntrypoint(): boolean {
  const entrypoint = process.argv[1];
  return (
    entrypoint !== undefined &&
    path.basename(path.dirname(entrypoint)) === "secure-server" &&
    path.basename(entrypoint).startsWith("index.")
  );
}

if (isSecureServerExampleEntrypoint()) {
  startSecureServerExample();
}
