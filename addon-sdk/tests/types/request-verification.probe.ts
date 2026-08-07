import type {
  ClockifyHandler,
  ClockifyVerifiedWebhookRequestOptions,
  ClockifyWebhookVerificationOptions,
} from "../../src";

const rawWebhookOptions: ClockifyWebhookVerificationOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
};

// @ts-expect-error raw webhook verification always requires a fixed stored token
const missingRawWebhookToken: ClockifyWebhookVerificationOptions = {
  expectedEventType: "EXPENSE_CREATED",
};

const fixedWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
};

const lookupWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  getExpectedWebhookAuthToken: () => "stored-token",
};

// @ts-expect-error webhook wrappers must configure exactly one token source
const missingWebhookTokenSource: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
};

// @ts-expect-error webhook wrappers must choose either a fixed token or a lookup, not both
const ambiguousWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
  getExpectedWebhookAuthToken: () => "stored-token",
};

void rawWebhookOptions;
void missingRawWebhookToken;
void fixedWebhookOptions;
void lookupWebhookOptions;
void missingWebhookTokenSource;
void ambiguousWebhookOptions;

// withClockifyHandler's `Kind` parameter must keep the narrowing each underlying wrapper already
// provides. A lifecycle-payload kind resolves `claims.workspaceId`/`addonId` to required `string`
// (not `string | undefined`) and `payload` to its exact matched type — never the wider
// ClockifyAddonClaims | ClockifyLifecycleMatchedClaims union a naive unification would produce.
const installedHandler: ClockifyHandler<"installed"> = (_request, context) => {
  const workspaceId: string = context.claims.workspaceId;
  const addonId: string = context.claims.addonId;
  const authToken: string = context.payload.authToken;
  void workspaceId;
  void addonId;
  void authToken;
  return { status: 200 };
};

const componentHandler: ClockifyHandler<"component"> = (_request, context) => {
  // @ts-expect-error component claims are not lifecycle-matched — workspaceId stays optional
  const workspaceId: string = context.claims.workspaceId;
  void workspaceId;
  return { status: 200 };
};

const webhookHandler: ClockifyHandler<"webhook"> = (_request, context) => {
  const eventType: string = context.eventType;
  void eventType;
  return { status: 200 };
};

void installedHandler;
void componentHandler;
void webhookHandler;
