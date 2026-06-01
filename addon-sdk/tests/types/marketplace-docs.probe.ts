import {
  ClockifyAddonClaims,
  ClockifyDeletedLifecyclePayload,
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecyclePayload,
  ClockifySettingsUpdatedLifecyclePayload,
  ClockifyStatusChangedLifecyclePayload,
  getClockifyEnvironmentContext,
} from "../../src";

const installed: ClockifyInstalledLifecyclePayload = {
  addonId: "addon-1",
  authToken: "installation-token",
  workspaceId: "workspace-1",
  asUser: "user-admin",
  apiUrl: "https://api.clockify.example",
  addonUserId: "addon-user-1",
  webhooks: [
    {
      path: "/webhook/time-entry-split",
      webhookType: "ADDON",
      authToken: "webhook-token",
    },
  ],
};

const statusChanged: ClockifyStatusChangedLifecyclePayload = {
  addonId: "addon-1",
  workspaceId: "workspace-1",
  status: "ACTIVE",
};

const settingsUpdated: ClockifySettingsUpdatedLifecyclePayload = {
  addonId: "addon-1",
  workspaceId: "workspace-1",
  settings: [
    {
      id: "distance-unit",
      name: "Distance unit",
      value: "km",
    },
  ],
};

const deleted: ClockifyDeletedLifecyclePayload = {
  addonId: "addon-1",
  workspaceId: "workspace-1",
  asUser: "user-admin",
};

const lifecyclePayloads: ClockifyLifecyclePayload[] = [
  installed,
  statusChanged,
  settingsUpdated,
  deleted,
];

const claims: ClockifyAddonClaims = {
  type: "addon",
  iss: "clockify",
  sub: "my-addon",
  backendUrl: "https://api.clockify.example",
  reportsUrl: "https://reports.clockify.example",
  locationsUrl: "https://locations.clockify.example",
  screenshotsUrl: "https://screenshots.clockify.example",
  workspaceId: "workspace-1",
  addonId: "addon-1",
  user: "user-1",
  language: "en",
  theme: "dark",
  workspaceRole: "OWNER",
};

const context = getClockifyEnvironmentContext(claims);
const backendUrl: string | undefined = context.backendUrl;
const reportsUrl: string | undefined = context.reportsUrl;
const locationsUrl: string | undefined = context.locationsUrl;
const screenshotsUrl: string | undefined = context.screenshotsUrl;
const language: string | undefined = context.language;
const theme: string | undefined = context.theme;
const workspaceRole: string | undefined = context.workspaceRole;

export {
  backendUrl,
  reportsUrl,
  locationsUrl,
  screenshotsUrl,
  language,
  theme,
  workspaceRole,
  lifecyclePayloads,
};
