import { AddonRequest } from "../shared/request";
import { AddonResponse } from "../shared/response";
import { RequestHandler } from "../shared/handler";
import { ClockifyAddonClaims, ClockifySignatureParser } from "./clockify-signature-parser";

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

export interface ClockifyRequestVerificationOptions {
  signatureHeader?: string;
  eventHeader?: string;
  expectedEventType?: string;
  expectedWorkspaceId?: string;
  expectedAddonId?: string;
}

export type ClockifyRequestVerificationFailureReason =
  | "missing-signature"
  | "invalid-signature"
  | "missing-event-type"
  | "event-type-mismatch"
  | "workspace-id-mismatch"
  | "addon-id-mismatch";

export type ClockifyRequestVerificationResult =
  | {
      ok: true;
      claims: ClockifyAddonClaims;
      eventType?: string;
    }
  | {
      ok: false;
      reason: ClockifyRequestVerificationFailureReason;
    };

export interface ClockifyVerifiedRequestContext {
  claims: ClockifyAddonClaims;
  eventType?: string;
}

export type ClockifyVerifiedRequestHandler = (
  request: AddonRequest,
  claims: ClockifyAddonClaims,
  context: ClockifyVerifiedRequestContext,
) => AddonResponse | Promise<AddonResponse>;

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

export async function verifyClockifyRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyRequestVerificationOptions = {},
): Promise<ClockifyRequestVerificationResult> {
  const signatureHeader = options.signatureHeader ?? ClockifyHeaders.SIGNATURE;
  const token = getClockifyHeader(request.headers, signatureHeader);

  if (!token) {
    return { ok: false, reason: "missing-signature" };
  }

  let claims: ClockifyAddonClaims;
  try {
    claims = await parser.parseClaims(token);
  } catch {
    return { ok: false, reason: "invalid-signature" };
  }

  if (options.expectedWorkspaceId !== undefined && claims.workspaceId !== options.expectedWorkspaceId) {
    return { ok: false, reason: "workspace-id-mismatch" };
  }

  if (options.expectedAddonId !== undefined && claims.addonId !== options.expectedAddonId) {
    return { ok: false, reason: "addon-id-mismatch" };
  }

  const eventHeader = options.eventHeader ?? ClockifyHeaders.WEBHOOK_EVENT_TYPE;
  const eventType = getClockifyHeader(request.headers, eventHeader);

  if (options.expectedEventType !== undefined) {
    if (!eventType) {
      return { ok: false, reason: "missing-event-type" };
    }
    if (eventType !== options.expectedEventType) {
      return { ok: false, reason: "event-type-mismatch" };
    }
  }

  return eventType === undefined ? { ok: true, claims } : { ok: true, claims, eventType };
}

export function withClockifyVerifiedRequest(
  parser: ClockifySignatureParser,
  options: ClockifyRequestVerificationOptions,
  handler: ClockifyVerifiedRequestHandler,
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyRequest(parser, request, options);
    if (!result.ok) {
      return { status: 401, body: "Unauthorized" };
    }

    return handler(request, result.claims, {
      claims: result.claims,
      eventType: result.eventType,
    });
  };
}
