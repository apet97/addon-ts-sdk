import type {
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
