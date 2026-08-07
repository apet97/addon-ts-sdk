import type { AddonErrorReporter } from "../shared/addon";
import type { AddonRequest } from "../shared/request";
import type { AddonResponse } from "../shared/response";
import type { ClockifyAddonClaims } from "./clockify-signature-parser";
import type {
  ClockifyDeletedLifecyclePayload,
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecycleMatchedClaims,
  ClockifySettingsUpdatedLifecyclePayload,
  ClockifyStatusChangedLifecyclePayload,
} from "./clockify-lifecycle";

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
  expectedWebhookAuthToken: string;
}

export interface ClockifyTokenVerificationOptions {
  expectedWorkspaceId?: string;
  expectedAddonId?: string;
  requireExpiration?: boolean;
}

export type ClockifyRequestVerificationFailureReason =
  | "missing-signature"
  | "ambiguous-signature"
  | "invalid-signature"
  | "missing-event-type"
  | "ambiguous-event-type"
  | "event-type-mismatch"
  | "workspace-id-mismatch"
  | "addon-id-mismatch";

export type ClockifyWebhookVerificationFailureReason =
  | ClockifyRequestVerificationFailureReason
  | "missing-expected-event-type"
  | "missing-expected-webhook-auth-token"
  | "missing-installation-context"
  | "webhook-token-mismatch";

export type ClockifyTokenVerificationFailureReason =
  | "ambiguous-token"
  | "missing-token"
  | "invalid-token"
  | "missing-expiration"
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

export interface ClockifyStatusChangedLifecycleRequestContext {
  claims: ClockifyLifecycleMatchedClaims;
  payload: ClockifyStatusChangedLifecyclePayload;
}

export interface ClockifySettingsUpdatedLifecycleRequestContext {
  claims: ClockifyLifecycleMatchedClaims;
  payload: ClockifySettingsUpdatedLifecyclePayload;
}

export interface ClockifyDeletedLifecycleRequestContext {
  claims: ClockifyLifecycleMatchedClaims;
  payload: ClockifyDeletedLifecyclePayload;
}

export type ClockifyInstalledLifecycleRequestHandler = (
  request: AddonRequest,
  payload: ClockifyInstalledLifecyclePayload,
  claims: ClockifyLifecycleMatchedClaims,
  context: ClockifyInstalledLifecycleRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export type ClockifyStatusChangedLifecycleRequestHandler = (
  request: AddonRequest,
  payload: ClockifyStatusChangedLifecyclePayload,
  claims: ClockifyLifecycleMatchedClaims,
  context: ClockifyStatusChangedLifecycleRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export type ClockifySettingsUpdatedLifecycleRequestHandler = (
  request: AddonRequest,
  payload: ClockifySettingsUpdatedLifecyclePayload,
  claims: ClockifyLifecycleMatchedClaims,
  context: ClockifySettingsUpdatedLifecycleRequestContext,
) => AddonResponse | Promise<AddonResponse>;

export type ClockifyDeletedLifecycleRequestHandler = (
  request: AddonRequest,
  payload: ClockifyDeletedLifecyclePayload,
  claims: ClockifyLifecycleMatchedClaims,
  context: ClockifyDeletedLifecycleRequestContext,
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
      /** Observes a misconfigured token lookup (e.g. an empty/missing stored token). */
      onError?: AddonErrorReporter;
    })
  | (Omit<ClockifyWebhookVerificationOptions, "expectedWebhookAuthToken"> & {
      getExpectedWebhookAuthToken: ClockifyWebhookAuthTokenLookup;
      expectedWebhookAuthToken?: never;
      /** Observes a misconfigured token lookup (e.g. an empty/missing stored token). */
      onError?: AddonErrorReporter;
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

// --- Unified handler shape -------------------------------------------------
//
// Every `withClockify*` wrapper above calls its handler with a different arity
// (2, 3, or 4 positional arguments) because each grew independently from its
// own verification result. `withClockifyHandler` is an additive alternative
// that normalizes all of them to one `(request, context)` shape, at the cost
// of a discriminated `kind` option selecting which underlying verification to
// run. It does not replace or change any `withClockify*` export above.

export type ClockifyHandlerOptions =
  | ({ kind: "verified" } & ClockifyRequestVerificationOptions)
  | ({ kind: "component" } & ClockifyTokenVerificationOptions)
  | ({ kind: "lifecycle" } & ClockifyTokenVerificationOptions)
  | ({ kind: "installed" } & ClockifyTokenVerificationOptions)
  | ({ kind: "statusChanged" } & ClockifyTokenVerificationOptions)
  | ({ kind: "settingsUpdated" } & ClockifyTokenVerificationOptions)
  | ({ kind: "deleted" } & ClockifyTokenVerificationOptions)
  | ({ kind: "webhook" } & ClockifyVerifiedWebhookRequestOptions);

type ClockifyHandlerKind = ClockifyHandlerOptions["kind"];

type ClockifyLifecyclePayloadHandlerKind =
  "installed" | "statusChanged" | "settingsUpdated" | "deleted";

// Maps a lifecycle-payload kind to its exact matched payload type — kept in sync with
// withClockifyInstalledLifecycleRequest/withClockifyStatusChangedLifecycleRequest/
// withClockifySettingsUpdatedLifecycleRequest/withClockifyDeletedLifecycleRequest above.
type ClockifyHandlerPayloadFor<Kind extends ClockifyLifecyclePayloadHandlerKind> =
  Kind extends "installed"
    ? ClockifyInstalledLifecyclePayload
    : Kind extends "statusChanged"
      ? ClockifyStatusChangedLifecyclePayload
      : Kind extends "settingsUpdated"
        ? ClockifySettingsUpdatedLifecyclePayload
        : ClockifyDeletedLifecyclePayload;

/**
 * Normalized handler context for `withClockifyHandler`, parameterized on `Kind` so `claims` keeps
 * the same narrowing each underlying `withClockify*` wrapper already provides: a lifecycle-payload
 * kind gets required `workspaceId`/`addonId` via `ClockifyLifecycleMatchedClaims` and its exact
 * matched `payload` type; every other kind gets plain `ClockifyAddonClaims` and no `payload`.
 * `eventType` is required only for `"webhook"` (matching `ClockifyVerifiedWebhookRequestContext`);
 * `"verified"` carries it optionally, matching `ClockifyVerifiedRequestContext`.
 */
export type ClockifyHandlerContext<Kind extends ClockifyHandlerKind = ClockifyHandlerKind> =
  Kind extends ClockifyLifecyclePayloadHandlerKind
    ? {
        claims: ClockifyLifecycleMatchedClaims;
        payload: ClockifyHandlerPayloadFor<Kind>;
        eventType?: undefined;
      }
    : Kind extends "webhook"
      ? { claims: ClockifyAddonClaims; payload?: undefined; eventType: string }
      : { claims: ClockifyAddonClaims; payload?: undefined; eventType?: string };

export type ClockifyHandler<Kind extends ClockifyHandlerKind = ClockifyHandlerKind> = (
  request: AddonRequest,
  context: ClockifyHandlerContext<Kind>,
) => AddonResponse | Promise<AddonResponse>;
