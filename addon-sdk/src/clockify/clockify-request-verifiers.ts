import type { AddonRequest } from "../shared/request";
import { ClockifyAddonClaims, ClockifySignatureParser } from "./clockify-signature-parser";
import {
  ClockifyRequestVerificationOptions,
  ClockifyRequestVerificationResult,
  ClockifyTokenVerificationOptions,
  ClockifyTokenVerificationResult,
  ClockifyWebhookVerificationOptions,
  ClockifyWebhookVerificationResult,
} from "./clockify-request-types";
import {
  ClockifyHeaders,
  ClockifyQueryParams,
  getClockifyHeaderValues,
} from "./clockify-request-wire";

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

function getSingleClockifyHeader<
  Reason extends "ambiguous-signature" | "ambiguous-event-type" | "ambiguous-token",
>(
  headers: AddonRequest["headers"],
  name: string,
  ambiguousReason: Reason,
): { ok: true; value?: string } | { ok: false; reason: Reason } {
  const values = getClockifyHeaderValues(headers, name);
  if (values.length > 1) {
    return { ok: false, reason: ambiguousReason };
  }
  return { ok: true, value: values[0] };
}

function getSingleClockifyQueryParam(
  query: AddonRequest["query"],
  name: string,
): { ok: true; value?: string } | { ok: false; reason: "ambiguous-token" } {
  const values = query?.getAll(name) ?? [];
  if (values.length > 1) {
    return { ok: false, reason: "ambiguous-token" };
  }
  return { ok: true, value: values[0] };
}

export async function verifyClockifyRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyRequestVerificationOptions = {},
): Promise<ClockifyRequestVerificationResult> {
  const signatureHeader = options.signatureHeader ?? ClockifyHeaders.SIGNATURE;
  const signature = getSingleClockifyHeader(
    request.headers,
    signatureHeader,
    "ambiguous-signature",
  );

  if (!signature.ok) {
    return signature;
  }

  const token = signature.value;

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
  const event = getSingleClockifyHeader(request.headers, eventHeader, "ambiguous-event-type");

  if (!event.ok) {
    return event;
  }

  const eventType = event.value;

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
  const signature = getSingleClockifyHeader(
    request.headers,
    signatureHeader,
    "ambiguous-signature",
  );

  if (!signature.ok) {
    return signature;
  }

  const token = signature.value;

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

export async function verifyClockifyComponentRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyTokenVerificationOptions = {},
): Promise<ClockifyTokenVerificationResult> {
  const token = getSingleClockifyQueryParam(request.query, ClockifyQueryParams.AUTH_TOKEN);
  if (!token.ok) {
    return token;
  }

  return verifyClockifyToken(parser, token.value, options);
}

export async function verifyClockifyLifecycleRequest(
  parser: ClockifySignatureParser,
  request: AddonRequest,
  options: ClockifyTokenVerificationOptions = {},
): Promise<ClockifyTokenVerificationResult> {
  const token = getSingleClockifyHeader(
    request.headers,
    ClockifyHeaders.LIFECYCLE_TOKEN,
    "ambiguous-token",
  );
  if (!token.ok) {
    return token;
  }

  return verifyClockifyToken(parser, token.value, options);
}
