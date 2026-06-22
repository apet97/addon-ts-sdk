import type { ClockifyAddonClaims } from "./clockify-signature-parser";

export type ClockifyLifecycleMatchedClaims = ClockifyAddonClaims & {
  workspaceId: string;
  addonId: string;
};

export type ClockifyLifecycleEventType =
  | "INSTALLED"
  | "STATUS_CHANGED"
  | "SETTINGS_UPDATED"
  | "DELETED";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

function isClockifyLifecycleWebhookToken(value: unknown): value is ClockifyLifecycleWebhookToken {
  return (
    isRecord(value) &&
    hasString(value, "path") &&
    value.webhookType === "ADDON" &&
    hasString(value, "authToken")
  );
}

export function isClockifyInstalledLifecyclePayload(
  value: unknown,
): value is ClockifyInstalledLifecyclePayload {
  if (
    !isRecord(value) ||
    !hasString(value, "addonId") ||
    !hasString(value, "authToken") ||
    !hasString(value, "workspaceId") ||
    !hasString(value, "asUser") ||
    !hasString(value, "apiUrl") ||
    !hasString(value, "addonUserId")
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
    hasString(value, "addonId") &&
    hasString(value, "workspaceId") &&
    (value.status === "ACTIVE" || value.status === "INACTIVE")
  );
}

function isClockifySettingsUpdatedSetting(value: unknown): value is ClockifySettingsUpdatedSetting {
  return isRecord(value) && hasString(value, "id") && hasString(value, "name") && "value" in value;
}

export function isClockifySettingsUpdatedLifecyclePayload(
  value: unknown,
): value is ClockifySettingsUpdatedLifecyclePayload {
  return (
    isRecord(value) &&
    hasString(value, "addonId") &&
    hasString(value, "workspaceId") &&
    Array.isArray(value.settings) &&
    value.settings.every(isClockifySettingsUpdatedSetting)
  );
}

export function isClockifyDeletedLifecyclePayload(
  value: unknown,
): value is ClockifyDeletedLifecyclePayload {
  return (
    isRecord(value) &&
    hasString(value, "addonId") &&
    hasString(value, "workspaceId") &&
    hasString(value, "asUser")
  );
}

export function clockifyLifecyclePayloadMatchesClaims(
  payload: unknown,
  claims: ClockifyAddonClaims,
): claims is ClockifyLifecycleMatchedClaims {
  return (
    isRecord(payload) &&
    typeof payload.workspaceId === "string" &&
    payload.workspaceId !== "" &&
    typeof payload.addonId === "string" &&
    payload.addonId !== "" &&
    payload.workspaceId === claims.workspaceId &&
    payload.addonId === claims.addonId
  );
}
