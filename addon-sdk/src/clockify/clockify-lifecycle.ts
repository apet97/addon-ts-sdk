import type { ClockifyAddonClaims } from "./clockify-signature-parser";

export type ClockifyLifecycleMatchedClaims = ClockifyAddonClaims & {
  workspaceId: string;
  addonId: string;
};

export type ClockifyLifecycleEventType =
  "INSTALLED" | "STATUS_CHANGED" | "SETTINGS_UPDATED" | "DELETED";

export type ClockifyLifecycleStatus = "ACTIVE" | "INACTIVE";

export interface ClockifyLifecycleWebhookToken {
  path: string;
  webhookType: "ADDON";
  authToken: string;
}

export interface ClockifyInstalledLifecyclePayload {
  addonId: string;
  authToken: string;
  workspaceId: string;
  asUser: string;
  apiUrl: string;
  addonUserId: string;
  webhooks?: ClockifyLifecycleWebhookToken[];
}

export interface ClockifyStatusChangedLifecyclePayload {
  addonId: string;
  workspaceId: string;
  status: ClockifyLifecycleStatus;
}

export interface ClockifySettingsUpdatedSetting {
  id: string;
  name: string;
  value: unknown;
}

export interface ClockifySettingsUpdatedLifecyclePayload {
  addonId: string;
  workspaceId: string;
  settings: ClockifySettingsUpdatedSetting[];
}

export interface ClockifyDeletedLifecyclePayload {
  addonId: string;
  workspaceId: string;
  asUser: string;
}

export type ClockifyLifecyclePayload =
  | ClockifyInstalledLifecyclePayload
  | ClockifyStatusChangedLifecyclePayload
  | ClockifySettingsUpdatedLifecyclePayload
  | ClockifyDeletedLifecyclePayload;

/** Converts a lifecycle webhook path or absolute HTTP(S) URL to one stable path key. */
export function normalizeClockifyWebhookPath(path: string): string {
  let pathname = path;
  if (/^https?:\/\//i.test(path)) {
    try {
      pathname = new URL(path).pathname;
    } catch {
      // Keep the original text when an HTTP(S) URL is malformed.
    }
  }
  const collapsed = `/${pathname.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasNonEmptyString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && (value[key] as string).trim() !== "";
}

function isClockifyLifecycleWebhookToken(value: unknown): value is ClockifyLifecycleWebhookToken {
  return (
    isRecord(value) &&
    hasNonEmptyString(value, "path") &&
    value.webhookType === "ADDON" &&
    hasNonEmptyString(value, "authToken")
  );
}

export function isClockifyInstalledLifecyclePayload(
  value: unknown,
): value is ClockifyInstalledLifecyclePayload {
  if (
    !isRecord(value) ||
    !hasNonEmptyString(value, "addonId") ||
    !hasNonEmptyString(value, "authToken") ||
    !hasNonEmptyString(value, "workspaceId") ||
    !hasNonEmptyString(value, "asUser") ||
    !hasNonEmptyString(value, "apiUrl") ||
    !hasNonEmptyString(value, "addonUserId")
  ) {
    return false;
  }

  return (
    value.webhooks === undefined ||
    (Array.isArray(value.webhooks) && value.webhooks.every(isClockifyLifecycleWebhookToken))
  );
}

export function isClockifyStatusChangedLifecyclePayload(
  value: unknown,
): value is ClockifyStatusChangedLifecyclePayload {
  return (
    isRecord(value) &&
    hasNonEmptyString(value, "addonId") &&
    hasNonEmptyString(value, "workspaceId") &&
    (value.status === "ACTIVE" || value.status === "INACTIVE")
  );
}

function isClockifySettingsUpdatedSetting(value: unknown): value is ClockifySettingsUpdatedSetting {
  return (
    isRecord(value) &&
    hasNonEmptyString(value, "id") &&
    hasNonEmptyString(value, "name") &&
    "value" in value
  );
}

export function isClockifySettingsUpdatedLifecyclePayload(
  value: unknown,
): value is ClockifySettingsUpdatedLifecyclePayload {
  return (
    isRecord(value) &&
    hasNonEmptyString(value, "addonId") &&
    hasNonEmptyString(value, "workspaceId") &&
    Array.isArray(value.settings) &&
    value.settings.every(isClockifySettingsUpdatedSetting)
  );
}

export function isClockifyDeletedLifecyclePayload(
  value: unknown,
): value is ClockifyDeletedLifecyclePayload {
  return (
    isRecord(value) &&
    hasNonEmptyString(value, "addonId") &&
    hasNonEmptyString(value, "workspaceId") &&
    hasNonEmptyString(value, "asUser")
  );
}

export function clockifyLifecyclePayloadMatchesClaims(
  payload: unknown,
  claims: ClockifyAddonClaims,
): claims is ClockifyLifecycleMatchedClaims {
  return (
    isRecord(payload) &&
    typeof payload.workspaceId === "string" &&
    payload.workspaceId.trim() !== "" &&
    typeof payload.addonId === "string" &&
    payload.addonId.trim() !== "" &&
    payload.workspaceId === claims.workspaceId &&
    payload.addonId === claims.addonId
  );
}
