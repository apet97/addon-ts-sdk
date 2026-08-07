import { isHttpsOrLoopbackHttp } from "../shared/loopback";
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
      // ambiguity checks below. Trim each split entry (a folded header commonly
      // carries "value1, value2" with a space after the comma) and drop empty
      // entries so a trailing/duplicate comma does not fabricate an extra value.
      values.push(
        ...value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry !== ""),
      );
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

  if (!isHttpsOrLoopbackHttp(url)) return undefined;
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
  // apiUrl is preferred, but only once it actually normalizes.
  // normalizeClockifyVersionedBaseUrl already treats a non-string, blank, or
  // malformed/policy-rejected value as "not usable" (returns undefined), so
  // any such apiUrl falls through to backendUrl here instead of this
  // function returning undefined outright — a valid backendUrl is a better
  // answer than none, and a stale-but-present apiUrl should not shadow it.
  return (
    normalizeClockifyVersionedBaseUrl(input.apiUrl) ??
    normalizeClockifyVersionedBaseUrl(input.backendUrl)
  );
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
