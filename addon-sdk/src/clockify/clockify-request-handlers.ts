import type { AddonResponse } from "../shared/response";
import type { RequestHandler } from "../shared/handler";
import { reportAddonError } from "../shared/addon";
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
  ClockifyHandler,
  ClockifyHandlerOptions,
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
  // These are configuration mistakes, not verification failures: a request-time
  // 401 would hide a broken webhook registration behind an opaque
  // "Unauthorized" for every delivery until someone reads the logs. Failing
  // at wiring time surfaces the mistake immediately, during startup.
  if (options == null || !isNonEmptyString(options.expectedEventType)) {
    throw new Error("withClockifyVerifiedWebhookRequest requires a nonblank expectedEventType.");
  }
  const hasFixedToken = options.expectedWebhookAuthToken !== undefined;
  const hasTokenLookup = options.getExpectedWebhookAuthToken !== undefined;
  if (hasFixedToken === hasTokenLookup) {
    throw new Error(
      "withClockifyVerifiedWebhookRequest requires exactly one of expectedWebhookAuthToken or getExpectedWebhookAuthToken.",
    );
  }
  if (hasTokenLookup && typeof options.getExpectedWebhookAuthToken !== "function") {
    throw new Error("getExpectedWebhookAuthToken must be a function.");
  }

  return async (request) => {
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
      reportAddonError(
        options.onError,
        new Error(
          `getExpectedWebhookAuthToken returned no stored token for workspace ${workspaceId}, add-on ${addonId}, event ${eventType}.`,
        ),
        { source: "router", request },
      );
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

/**
 * Unified alternative to the `withClockify*` wrappers above: always calls
 * `handler(request, context)`, regardless of which verification `kind` ran.
 * Additive only — every existing `withClockify*` export keeps its own arity
 * and signature; use this when a single normalized shape is more convenient
 * than matching each wrapper's specific handler arity.
 *
 * @example
 * ```ts
 * const handleComponent = withClockifyHandler(
 *   parser,
 *   { kind: "component" },
 *   (request, { claims }) => ({ status: 200, body: `hello ${claims.addonId}` }),
 * );
 * ```
 */
export function withClockifyHandler(
  parser: ClockifySignatureParser,
  options: ClockifyHandlerOptions,
  handler: ClockifyHandler,
): RequestHandler {
  switch (options.kind) {
    case "verified": {
      const { kind: _kind, ...rest } = options;
      return withClockifyVerifiedRequest(parser, rest, (request, _claims, context) =>
        handler(request, context),
      );
    }
    case "component": {
      const { kind: _kind, ...rest } = options;
      return withClockifyVerifiedComponentRequest(
        parser,
        (request, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "lifecycle": {
      const { kind: _kind, ...rest } = options;
      return withClockifyVerifiedLifecycleRequest(
        parser,
        (request, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "installed": {
      const { kind: _kind, ...rest } = options;
      return withClockifyInstalledLifecycleRequest(
        parser,
        (request, _payload, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "statusChanged": {
      const { kind: _kind, ...rest } = options;
      return withClockifyStatusChangedLifecycleRequest(
        parser,
        (request, _payload, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "settingsUpdated": {
      const { kind: _kind, ...rest } = options;
      return withClockifySettingsUpdatedLifecycleRequest(
        parser,
        (request, _payload, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "deleted": {
      const { kind: _kind, ...rest } = options;
      return withClockifyDeletedLifecycleRequest(
        parser,
        (request, _payload, _claims, context) => handler(request, context),
        rest,
      );
    }
    case "webhook": {
      const { kind: _kind, ...rest } = options;
      return withClockifyVerifiedWebhookRequest(parser, rest, (request, _claims, context) =>
        handler(request, context),
      );
    }
  }
}
