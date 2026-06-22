import type { AddonRequest } from "../shared/request";
import type { AddonResponse } from "../shared/response";
import type { ClockifyAddonClaims } from "./clockify-signature-parser";
import type {
  ClockifyInstalledLifecyclePayload,
  ClockifyLifecycleMatchedClaims,
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
