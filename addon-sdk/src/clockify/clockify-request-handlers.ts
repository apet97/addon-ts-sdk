import type { AddonResponse } from "../shared/response";
import type { RequestHandler } from "../shared/handler";
import type { ClockifySignatureParser } from "./clockify-signature-parser";
import type { ClockifyLifecycleMatchedClaims } from "./clockify-lifecycle";
import {
  clockifyLifecyclePayloadMatchesClaims,
  isClockifyDeletedLifecyclePayload,
  isClockifyInstalledLifecyclePayload,
  isClockifySettingsUpdatedLifecyclePayload,
  isClockifyStatusChangedLifecyclePayload,
} from "./clockify-lifecycle";
import {
  ClockifyDeletedLifecycleRequestHandler,
  ClockifyInstalledLifecycleRequestHandler,
  ClockifyRequestVerificationOptions,
  ClockifySettingsUpdatedLifecycleRequestHandler,
  ClockifyStatusChangedLifecycleRequestHandler,
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
import { ClockifyHeaders, getClockifyHeaderValues } from "./clockify-request-wire";

function unauthorizedResponse(): AddonResponse {
  return { status: 401, body: "Unauthorized" };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function withClockifyMatchedLifecycleRequest<Payload>(
  parser: ClockifySignatureParser,
  isPayload: (value: unknown) => value is Payload,
  handler: (
    request: Parameters<RequestHandler>[0],
    payload: Payload,
    claims: ClockifyLifecycleMatchedClaims,
    context: {
      claims: ClockifyLifecycleMatchedClaims;
      payload: Payload;
    },
  ) => ReturnType<RequestHandler>,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return async (request) => {
    const result = await verifyClockifyLifecycleRequest(parser, request, options);
    if (!result.ok) {
      return unauthorizedResponse();
    }

    if (
      !isPayload(request.body) ||
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
  return withClockifyMatchedLifecycleRequest(
    parser,
    isClockifyInstalledLifecyclePayload,
    handler,
    options,
  );
}

export function withClockifyStatusChangedLifecycleRequest(
  parser: ClockifySignatureParser,
  handler: ClockifyStatusChangedLifecycleRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return withClockifyMatchedLifecycleRequest(
    parser,
    isClockifyStatusChangedLifecyclePayload,
    handler,
    options,
  );
}

export function withClockifySettingsUpdatedLifecycleRequest(
  parser: ClockifySignatureParser,
  handler: ClockifySettingsUpdatedLifecycleRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return withClockifyMatchedLifecycleRequest(
    parser,
    isClockifySettingsUpdatedLifecyclePayload,
    handler,
    options,
  );
}

export function withClockifyDeletedLifecycleRequest(
  parser: ClockifySignatureParser,
  handler: ClockifyDeletedLifecycleRequestHandler,
  options: ClockifyTokenVerificationOptions = {},
): RequestHandler {
  return withClockifyMatchedLifecycleRequest(
    parser,
    isClockifyDeletedLifecyclePayload,
    handler,
    options,
  );
}

export function withClockifyVerifiedWebhookRequest(
  parser: ClockifySignatureParser,
  options: ClockifyVerifiedWebhookRequestOptions,
  handler: ClockifyVerifiedWebhookRequestHandler,
): RequestHandler {
  return async (request) => {
    if (options == null || !isNonEmptyString(options.expectedEventType)) {
      return unauthorizedResponse();
    }

    const hasFixedToken = options.expectedWebhookAuthToken !== undefined;
    const hasTokenLookup = options.getExpectedWebhookAuthToken !== undefined;
    if (hasFixedToken === hasTokenLookup) {
      return unauthorizedResponse();
    }
    if (hasTokenLookup && typeof options.getExpectedWebhookAuthToken !== "function") {
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
    const firstPass = await verifyClockifyRequest(parser, request, firstPassOptions);
    if (!firstPass.ok) {
      return unauthorizedResponse();
    }

    const { workspaceId, addonId } = firstPass.claims;
    const eventType = firstPass.eventType;
    if (
      !isNonEmptyString(workspaceId) ||
      !isNonEmptyString(addonId) ||
      !isNonEmptyString(eventType)
    ) {
      return unauthorizedResponse();
    }

    const expectedWebhookAuthToken = await getExpectedWebhookAuthToken({
      workspaceId,
      addonId,
      eventType,
    });
    if (!isNonEmptyString(expectedWebhookAuthToken)) {
      return unauthorizedResponse();
    }

    // firstPass already verified the JWT and confirmed the signature header is
    // unambiguous, so the raw token can be read directly instead of paying for
    // a second full verifyClockifyWebhookRequest (and its second JWT verify).
    const signatureHeader = firstPassOptions.signatureHeader ?? ClockifyHeaders.SIGNATURE;
    const token = getClockifyHeaderValues(request.headers, signatureHeader)[0];
    if (token !== expectedWebhookAuthToken) {
      return unauthorizedResponse();
    }

    return handler(request, firstPass.claims, {
      claims: firstPass.claims,
      eventType,
    });
  };
}
