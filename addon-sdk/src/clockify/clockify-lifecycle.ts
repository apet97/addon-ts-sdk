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
