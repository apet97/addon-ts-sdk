import type { AddonRequest } from "../shared/request";
import type { ClockifyAddonClaims } from "./clockify-signature-parser";

export const ClockifyHeaders = {
  SIGNATURE: "clockify-signature",
  WEBHOOK_EVENT_TYPE: "clockify-webhook-event-type",
  LIFECYCLE_TOKEN: "x-addon-lifecycle-token",
  ADDON_TOKEN: "x-addon-token",
} as const;

export const ClockifyQueryParams = {
  AUTH_TOKEN: "auth_token",
} as const;

export interface ClockifyEnvironmentContext {
  backendUrl?: string;
  ptoUrl?: string;
  reportsUrl?: string;
  locationsUrl?: string;
  screenshotsUrl?: string;
  workspaceId?: string;
  addonId?: string;
  user?: string;
  workspaceRole?: string;
  language?: string;
  theme?: string;
}

export function getClockifyHeader(
  headers: AddonRequest["headers"],
  name: string,
): string | undefined {
  const expected = name.toLowerCase();

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== expected) continue;
    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}

export function getClockifyQueryParam(
  query: AddonRequest["query"],
  name: string,
): string | undefined {
  return query?.get(name) ?? undefined;
}

export function isClockifyAdminRole(role: unknown): boolean {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

function normalizeClockifyVersionedBaseUrl(value: string | undefined): string | undefined {
  const root = value?.trim().replace(/\/+$/, "");
  if (!root) return undefined;
  return root.endsWith("/v1") ? root : `${root}/v1`;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

export function resolveClockifyApiBaseUrl(input: {
  apiUrl?: string;
  backendUrl?: string;
}): string | undefined {
  return normalizeClockifyVersionedBaseUrl(firstNonEmpty(input.apiUrl, input.backendUrl));
}

export function resolveClockifyReportsBaseUrl(input: { reportsUrl?: string }): string | undefined {
  return normalizeClockifyVersionedBaseUrl(input.reportsUrl);
}

export function getClockifyEnvironmentContext(
  claims: ClockifyAddonClaims,
): ClockifyEnvironmentContext {
  return {
    backendUrl: claims.backendUrl,
    ptoUrl: claims.ptoUrl,
    reportsUrl: claims.reportsUrl,
    locationsUrl: claims.locationsUrl,
    screenshotsUrl: claims.screenshotsUrl,
    workspaceId: claims.workspaceId,
    addonId: claims.addonId,
    user: claims.user,
    workspaceRole: claims.workspaceRole,
    language: claims.language,
    theme: claims.theme,
  };
}
