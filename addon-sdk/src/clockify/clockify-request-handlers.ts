import type { AddonResponse } from "../shared/response";
import type { RequestHandler } from "../shared/handler";
import type { ClockifySignatureParser } from "./clockify-signature-parser";
import {
  clockifyLifecyclePayloadMatchesClaims,
  isClockifyInstalledLifecyclePayload,
} from "./clockify-lifecycle";
import {
  ClockifyInstalledLifecycleRequestHandler,
  ClockifyRequestVerificationOptions,
  ClockifyTokenVerificationOptions,
  ClockifyVerifiedComponentRequestHandler,
  ClockifyVerifiedLifecycleRequestHandler,
  ClockifyVerifiedRequestHandler,
  ClockifyVerifiedWebhookRequestHandler,
  ClockifyVerifiedWebhookRequestOptions,
} from "./clockify-request-types";
import {
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
  verifyClockifyRequest,
  verifyClockifyWebhookRequest,
} from "./clockify-request-verifiers";

function unauthorizedResponse(): AddonResponse {
  return { status: 401, body: "Unauthorized" };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
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
