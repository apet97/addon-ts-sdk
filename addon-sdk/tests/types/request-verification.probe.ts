import type { ClockifyVerifiedWebhookRequestOptions } from "../../src";

const fixedWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
};

const lookupWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  getExpectedWebhookAuthToken: () => "stored-token",
};

// @ts-expect-error webhook wrappers must choose either a fixed token or a lookup, not both
const ambiguousWebhookOptions: ClockifyVerifiedWebhookRequestOptions = {
  expectedEventType: "EXPENSE_CREATED",
  expectedWebhookAuthToken: "stored-token",
  getExpectedWebhookAuthToken: () => "stored-token",
};

void fixedWebhookOptions;
void lookupWebhookOptions;
void ambiguousWebhookOptions;
