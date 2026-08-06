import { isCanonicalLoopbackHostname } from "../shared/loopback";
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
  return getClockifyHeaderValues(headers, name)[0];
}

export function getClockifyHeaderValues(headers: AddonRequest["headers"], name: string): string[] {
  const expected = name.toLowerCase();
  const values: string[] = [];

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== expected) continue;
    if (Array.isArray(value)) {
      values.push(...value);
    } else if (value !== undefined) {
      // Node and the Fetch Headers object both fold a client-repeated header into
      // one comma-joined string instead of an array. None of Clockify's signature,
      // event-type, or lifecycle-token values ever legitimately contain a comma, so
      // splitting here surfaces every value the client actually sent for the
      // ambiguity checks below.
      values.push(...value.split(","));
    }
  }

  return values;
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

function normalizeClockifyVersionedBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const root = value.trim();
  if (root === "") return undefined;

  let url: URL;
  try {
    url = new URL(root);
  } catch {
    return undefined;
  }

  const loopback = isCanonicalLoopbackHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return undefined;
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    return undefined;
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.endsWith("/v1") ? pathname : `${pathname}/v1`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function resolveClockifyApiBaseUrl(input: {
  apiUrl?: string;
  backendUrl?: string;
}): string | undefined {
  if (input.apiUrl !== undefined) {
    if (typeof input.apiUrl !== "string") return undefined;
    if (input.apiUrl.trim() !== "") return normalizeClockifyVersionedBaseUrl(input.apiUrl);
  }
  return normalizeClockifyVersionedBaseUrl(input.backendUrl);
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
