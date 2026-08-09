// Parity guard for the generator's name derivation against the Java add-on SDK (the law).
//
// `verify:generated` only proves the generator is reproducible (TS regenerates to the committed TS);
// nothing else checks that a generated method/class name matches what the Java SDK's annotation
// processor would emit. This test pins `toMethodName` / `toClassName` to the Java behaviour so a
// future divergence (the original port lowercased leading-capital words, e.g. "Name" -> "name")
// cannot ship silently.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toMethodName, toClassName } from "../scripts/naming";

describe("generator naming parity with the Java SDK", () => {
  // Values that appear in schemas 1.2-1.6 today — the live surface must stay byte-identical.
  const realSurface: ReadonlyArray<readonly [string, string]> = [
    ["on_NEW_TIME_ENTRY", "onNewTimeEntry"],
    ["on_TIME_OFF_REQUEST_WITHDRAWN", "onTimeOffRequestWithdrawn"],
    ["allow_ADMINS", "allowAdmins"],
    ["as_DROPDOWN_SINGLE", "asDropdownSingle"],
    ["require_BASIC_plan", "requireBasicPlan"],
    ["timeoff.tab", "timeoffTab"],
    ["invoices.action", "invoicesAction"],
    ["baseUrl", "baseUrl"],
    ["readOnly", "readOnly"],
    ["minimalSubscriptionPlan", "minimalSubscriptionPlan"],
  ];
  for (const [input, expected] of realSurface) {
    it(`toMethodName(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
      expect(toMethodName(input)).toBe(expected);
    });
  }

  // Leading-capital / mixed-case inputs: Java preserves the leading capital instead of camelCasing.
  // The original ASCII `[A-Z]` + JS-split port produced the right-hand camelCase form and diverged.
  const javaPascalCase: ReadonlyArray<readonly [string, string]> = [
    ["Name", "Name"],
    ["Foo", "Foo"],
    ["NewProject", "NewProject"],
    ["Standard", "Standard"],
  ];
  for (const [input, expected] of javaPascalCase) {
    it(`preserves Java casing: toMethodName(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
      expect(toMethodName(input)).toBe(expected);
    });
  }

  const classNames: ReadonlyArray<readonly [string, string]> = [
    ["Clockify_scope", "ClockifyScope"],
    ["Clockify_minimalSubscriptionPlan", "ClockifyMinimalSubscriptionPlan"],
    ["Clockify_lifecycleEvent", "ClockifyLifecycleEvent"],
    ["Clockify_settingsTab", "ClockifySettingsTab"],
  ];
  for (const [input, expected] of classNames) {
    it(`toClassName(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
      expect(toClassName(input)).toBe(expected);
    });
  }

  // Integration: the webhook event helpers committed in generated/v1_4.ts must be exactly what the
  // current toMethodName derives from "on_" + EVENT — generator and helpers cannot drift apart.
  it("committed webhook helpers in generated/v1_4.ts match toMethodName('on_' + EVENT)", () => {
    const generated = readFileSync(
      join(process.cwd(), "src", "clockify", "generated", "v1_4.ts"),
      "utf-8",
    );
    const events = [
      "NEW_PROJECT",
      "NEW_TIME_ENTRY",
      "TIME_OFF_REQUEST_WITHDRAWN",
      "APPROVAL_REQUEST_STATUS_UPDATED",
      "BALANCE_UPDATED",
    ];
    for (const event of events) {
      const method = toMethodName("on_" + event);
      expect(generated).toContain(`${method}(): ClockifyWebhookBuilder_path;`);
    }
  });
});
