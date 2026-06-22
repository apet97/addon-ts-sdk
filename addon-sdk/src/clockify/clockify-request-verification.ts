import { AddonRequest } from "../shared/request";
import { AddonResponse } from "../shared/response";
import { RequestHandler } from "../shared/handler";
import { ClockifyAddonClaims, ClockifySignatureParser } from "./clockify-signature-parser";
import {
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecycleMatchedClaims,
  clockifyLifecyclePayloadMatchesClaims,
  isClockifyInstalledLifecyclePayload,
} from "./clockify-lifecycle";

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

export interface ClockifyWebhookVerificationOptions {
  signatureHeader?: string;
  eventHeader?: string;
  expectedEventType: string;
  expectedWorkspaceId?: string;
  expectedAddonId?: string;
  expectedWebhookAuthToken?: string;
}

export interface ClockifyTokenVerificationOptions {
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

export type ClockifyWebhookVerificationFailureReason =
  | ClockifyRequestVerificationFailureReason
  | "missing-expected-event-type"
  | "webhook-token-mismatch";

export type ClockifyTokenVerificationFailureReason =
  | "missing-token"
  | "invalid-token"
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

export type ClockifyWebhookVerificationResult =
  | {
      ok: true;
      claims: ClockifyAddonClaims;
      eventType: string;
    }
  | {
      ok: false;
      reason: ClockifyWebhookVerificationFailureReason;
    };

export type ClockifyTokenVerificationResult =
  | {
      ok: true;
      claims: ClockifyAddonClaims;
    }
  | {
      ok: false;
      reason: ClockifyTokenVerificationFailureReason;
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

export interface ClockifyVerifiedTokenRequestContext {
  claims: ClockifyAddonClaims;
}

export type ClockifyVerifiedTokenRequestHandler = (
  request: AddonRequest,
  claims: ClockifyAddonClaims,
  context: ClockifyVerifiedTokenRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export type ClockifyVerifiedComponentRequestContext = ClockifyVerifiedTokenRequestContext;

export type ClockifyVerifiedComponentRequestHandler = (
  request: AddonRequest,
  claims: ClockifyAddonClaims,
  context: ClockifyVerifiedComponentRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export type ClockifyVerifiedLifecycleRequestContext = ClockifyVerifiedTokenRequestContext;

export type ClockifyVerifiedLifecycleRequestHandler = (
  request: AddonRequest,
  claims: ClockifyAddonClaims,
  context: ClockifyVerifiedLifecycleRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export interface ClockifyInstalledLifecycleRequestContext {
  claims: ClockifyLifecycleMatchedClaims;
  payload: ClockifyInstalledLifecyclePayload;
}

export type ClockifyInstalledLifecycleRequestHandler = (
  request: AddonRequest,
  payload: ClockifyInstalledLifecyclePayload,
  claims: ClockifyLifecycleMatchedClaims,
  context: ClockifyInstalledLifecycleRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export interface ClockifyWebhookAuthTokenLookupInput {
  workspaceId: string;
  addonId: string;
  eventType: string;
}

export type ClockifyWebhookAuthTokenLookup = (
  input: ClockifyWebhookAuthTokenLookupInput,
) => string | undefined | Promise<string | undefined>;

export type ClockifyVerifiedWebhookRequestOptions =
  | (ClockifyWebhookVerificationOptions & {
      getExpectedWebhookAuthToken?: undefined;
    })
  | (Omit<ClockifyWebhookVerificationOptions, "expectedWebhookAuthToken"> & {
      getExpectedWebhookAuthToken: ClockifyWebhookAuthTokenLookup;
      expectedWebhookAuthToken?: never;
    });

export interface ClockifyVerifiedWebhookRequestContext {
  claims: ClockifyAddonClaims;
  eventType: string;
}

export type ClockifyVerifiedWebhookRequestHandler = (
  request: AddonRequest,
  claims: ClockifyAddonClaims,
  context: ClockifyVerifiedWebhookRequestContext,
) => AddonResponse | Promise<AddonResponse>;

function unauthorizedResponse(): AddonResponse {
  return { status: 401, body: "Unauthorized" };
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
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

function checkClockifyClaimContext(
  claims: ClockifyAddonClaims,
  options: ClockifyTokenVerificationOptions,
): "workspace-id-mismatch" | "addon-id-mismatch" | undefined {
  if (
    options.expectedWorkspaceId !== undefined &&
    claims.workspaceId !== options.expectedWorkspaceId
  ) {
    return "workspace-id-mismatch";
  }
  if (options.expectedAddonId !== undefined && claims.addonId !== options.expectedAddonId) {
    return "addon-id-mismatch";
  }
  return undefined;
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

  const contextMismatch = checkClockifyClaimContext(claims, options);
  if (contextMismatch) {
    return { ok: false, reason: contextMismatch };
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

export async function verifyClockifyWebhookRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyWebhookVerificationOptions,
): Promise<ClockifyWebhookVerificationResult> {
  if (
    options == null ||
    typeof options.expectedEventType !== "string" ||
    options.expectedEventType.trim() === ""
  ) {
    return { ok: false, reason: "missing-expected-event-type" };
  }

  const signatureHeader = options.signatureHeader ?? ClockifyHeaders.SIGNATURE;
  const token = getClockifyHeader(request.headers, signatureHeader);

  if (!token) {
    return { ok: false, reason: "missing-signature" };
  }

  if (
    options.expectedWebhookAuthToken !== undefined &&
    token !== options.expectedWebhookAuthToken
  ) {
    return { ok: false, reason: "webhook-token-mismatch" };
  }

  const result = await verifyClockifyRequest(parser, request, {
    signatureHeader,
    eventHeader: options.eventHeader,
    expectedEventType: options.expectedEventType,
    expectedWorkspaceId: options.expectedWorkspaceId,
    expectedAddonId: options.expectedAddonId,
  });

  if (!result.ok) return result;
  return { ok: true, claims: result.claims, eventType: result.eventType! };
}

export async function verifyClockifyToken(
  parser: ClockifySignatureParser,
  token: string | undefined | null,
  options: ClockifyTokenVerificationOptions = {},
): Promise<ClockifyTokenVerificationResult> {
  if (!token || token.trim() === "") {
    return { ok: false, reason: "missing-token" };
  }

  let claims: ClockifyAddonClaims;
  try {
    claims = await parser.parseClaims(token);
  } catch {
    return { ok: false, reason: "invalid-token" };
  }

  const contextMismatch = checkClockifyClaimContext(claims, options);
  if (contextMismatch) {
    return { ok: false, reason: contextMismatch };
  }

  return { ok: true, claims };
}

export function verifyClockifyComponentRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyTokenVerificationOptions = {},
): Promise<ClockifyTokenVerificationResult> {
  return verifyClockifyToken(
    parser,
    getClockifyQueryParam(request.query, ClockifyQueryParams.AUTH_TOKEN),
    options,
  );
}

export function verifyClockifyLifecycleRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyTokenVerificationOptions = {},
): Promise<ClockifyTokenVerificationResult> {
  return verifyClockifyToken(
    parser,
    getClockifyHeader(request.headers, ClockifyHeaders.LIFECYCLE_TOKEN),
    options,
  );
}

export function withClockifyVerifiedRequest(
  parser: ClockifySignatureParser,
  options: ClockifyRequestVerificationOptions,
  handler: ClockifyVerifiedRequestHandler,
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyRequest(parser, request, options);
    if (!result.ok) {
      return unauthorizedResponse();
    }

    return handler(request, result.claims, {
      claims: result.claims,
      eventType: result.eventType,
    });
  };
}

export function withClockifyVerifiedComponentRequest(
  parser: ClockifySignatureParser,
  handler: ClockifyVerifiedComponentRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyComponentRequest(parser, request, options);
    if (!result.ok) {
      return unauthorizedResponse();
    }

    return handler(request, result.claims, { claims: result.claims });
  };
}

export function withClockifyVerifiedLifecycleRequest(
  parser: ClockifySignatureParser,
  handler: ClockifyVerifiedLifecycleRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyLifecycleRequest(parser, request, options);
    if (!result.ok) {
      return unauthorizedResponse();
    }

    return handler(request, result.claims, { claims: result.claims });
  };
}

export function withClockifyInstalledLifecycleRequest(
  parser: ClockifySignatureParser,
  handler: ClockifyInstalledLifecycleRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyLifecycleRequest(parser, request, options);
    if (!result.ok) {
      return unauthorizedResponse();
    }

    if (
      !isClockifyInstalledLifecyclePayload(request.body) ||
      !clockifyLifecyclePayloadMatchesClaims(request.body, result.claims)
    ) {
      return unauthorizedResponse();
    }

    return handler(request, request.body, result.claims, {
      claims: result.claims,
      payload: request.body,
    });
  };
}

export function withClockifyVerifiedWebhookRequest(
  parser: ClockifySignatureParser,
  options: ClockifyVerifiedWebhookRequestOptions,
  handler: ClockifyVerifiedWebhookRequestHandler,
): RequestHandler {
  return async (request) => {
    if (options == null) {
      return unauthorizedResponse();
    }

    if (
      options.getExpectedWebhookAuthToken !== undefined &&
      options.expectedWebhookAuthToken !== undefined
    ) {
      return unauthorizedResponse();
    }

    if (options.getExpectedWebhookAuthToken === undefined) {
      const result = await verifyClockifyWebhookRequest(parser, request, options);
      if (!result.ok) {
        return unauthorizedResponse();
      }

      return handler(request, result.claims, {
        claims: result.claims,
        eventType: result.eventType,
      });
    }

    const {
      getExpectedWebhookAuthToken,
      expectedWebhookAuthToken: _expectedWebhookAuthToken,
      ...firstPassOptions
    } = options;
    const firstPass = await verifyClockifyWebhookRequest(parser, request, firstPassOptions);
    if (!firstPass.ok) {
      return unauthorizedResponse();
    }

    const { workspaceId, addonId } = firstPass.claims;
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(addonId)) {
      return unauthorizedResponse();
    }

    const expectedWebhookAuthToken = await getExpectedWebhookAuthToken({
      workspaceId,
      addonId,
      eventType: firstPass.eventType,
    });
    if (!isNonEmptyString(expectedWebhookAuthToken)) {
      return unauthorizedResponse();
    }

    const verified = await verifyClockifyWebhookRequest(parser, request, {
      ...firstPassOptions,
      expectedWorkspaceId: workspaceId,
      expectedAddonId: addonId,
      expectedWebhookAuthToken,
    });
    if (!verified.ok) {
      return unauthorizedResponse();
    }

    return handler(request, verified.claims, {
      claims: verified.claims,
      eventType: verified.eventType,
    });
  };
}
