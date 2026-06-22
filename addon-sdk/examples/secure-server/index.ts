import {
  AddonResponse,
  ClockifyAddon,
  ClockifyAddonClaims,
  ClockifyComponent,
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecycleEvent,
  ClockifyManifest,
  ClockifyWebhook,
  createClockifySignatureParser,
  isClockifyAdminRole,
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
  verifyClockifyWebhookRequest,
} from "../../src";
import { createNodeHttpAddonServer } from "../../src/adapters";

interface StoredWebhookTokenLookup {
  workspaceId: string;
  addonId: string;
  path: string;
  eventType: string;
}

type VerifiedInstallationClaims = ClockifyAddonClaims & {
  workspaceId: string;
  addonId: string;
};

interface SecureServerStore {
  saveInstallation(
    payload: ClockifyInstalledLifecyclePayload,
    claims: VerifiedInstallationClaims,
  ): void | Promise<void>;
  findWebhookAuthToken(input: StoredWebhookTokenLookup): string | undefined | Promise<string | undefined>;
}

interface SecureServerOptions {
  key: string;
  name: string;
  baseUrl: string;
  store: SecureServerStore;
  renderComponent?: (claims: ClockifyAddonClaims) => AddonResponse | Promise<AddonResponse>;
  onExpenseCreated?: (payload: unknown, claims: ClockifyAddonClaims) => void | Promise<void>;
}

function isInstalledPayload(value: unknown): value is ClockifyInstalledLifecyclePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ClockifyInstalledLifecyclePayload).workspaceId === "string" &&
    typeof (value as ClockifyInstalledLifecyclePayload).addonId === "string"
  );
}

function installationPayloadMatchesClaims(
  payload: ClockifyInstalledLifecyclePayload,
  claims: ClockifyAddonClaims,
): claims is VerifiedInstallationClaims {
  return payload.workspaceId === claims.workspaceId && payload.addonId === claims.addonId;
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
    ClockifyLifecycleEvent.v1_5Builder()
      .path("/lifecycle/installed")
      .onInstalled()
      .build(),
    async (request) => {
      const result = await verifyClockifyLifecycleRequest(parser, request);
      if (!result.ok) return { status: 401, body: "Unauthorized" };

      if (
        !isInstalledPayload(request.body) ||
        !installationPayloadMatchesClaims(request.body, result.claims)
      ) {
        return { status: 401, body: "Unauthorized" };
      }

      await options.store.saveInstallation(request.body, result.claims);
      return { status: 204 };
    },
  );

  addon.registerWebhook(
    ClockifyWebhook.v1_5Builder()
      .onExpenseCreated()
      .path("/webhooks/expense-created")
      .build(),
    async (request) => {
      const firstPass = await verifyClockifyWebhookRequest(parser, request, {
        expectedEventType: "EXPENSE_CREATED",
      });
      if (!firstPass.ok) return { status: 401, body: "Unauthorized" };

      const storedToken = await options.store.findWebhookAuthToken({
        workspaceId: firstPass.claims.workspaceId ?? "",
        addonId: firstPass.claims.addonId ?? "",
        path: "/webhooks/expense-created",
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

const webhookTokens = new Map<string, string>();

const addon = createSecureServerAddon({
  key: "secure-addon",
  name: "Secure Addon Example",
  baseUrl: "https://example.com/addon",
  store: {
    saveInstallation(payload, claims) {
      for (const webhook of payload.webhooks ?? []) {
        webhookTokens.set(`${claims.workspaceId}:${claims.addonId}:${webhook.path}`, webhook.authToken);
      }
    },
    findWebhookAuthToken(input) {
      return webhookTokens.get(`${input.workspaceId}:${input.addonId}:${input.path}`);
    },
  },
});

createNodeHttpAddonServer(addon).listen(3000, () => {
  console.log("Secure addon server listening on http://localhost:3000");
});
