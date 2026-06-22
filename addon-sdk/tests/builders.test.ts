import { describe, it, expect } from "vitest";
import {
  ClockifyManifest,
  ClockifyComponent,
  ClockifyLifecycleEvent,
  ClockifySetting,
  ClockifySettings,
  ClockifySettingsGroup,
  ClockifySettingsHeader,
  ClockifySettingsTab,
  ClockifyWebhook,
} from "../src";

describe("Builders", () => {
  it("should build v1.2 manifest with scopes required", () => {
    const manifest = ClockifyManifest.v1_2Builder()
      .key("my-addon")
      .name("My Addon")
      .baseUrl("https://example.com/addon")
      .requireBasicPlan()
      .scopes(["CLIENT_READ"])
      .build();

    expect(manifest.schemaVersion).toBe("1.2");
    expect(manifest.key).toBe("my-addon");
    expect(manifest.minimalSubscriptionPlan).toBe("BASIC");
    expect(manifest.scopes).toEqual(["CLIENT_READ"]);
  });

  it("should build v1.3 manifest", () => {
    const manifest = ClockifyManifest.v1_3Builder()
      .key("my-addon-v3")
      .name("My Addon V3")
      .baseUrl("https://example.com/addon")
      .requireProPlan()
      .build();

    expect(manifest.schemaVersion).toBe("1.3");
    expect(manifest.key).toBe("my-addon-v3");
    expect(manifest.minimalSubscriptionPlan).toBe("PRO");
  });

  it("should build v1.4 manifest", () => {
    const manifest = ClockifyManifest.v1_4Builder()
      .key("my-addon-v4")
      .name("My Addon V4")
      .baseUrl("https://example.com/addon")
      .requireEnterprisePlan()
      .build();

    expect(manifest.schemaVersion).toBe("1.4");
    expect(manifest.key).toBe("my-addon-v4");
    expect(manifest.minimalSubscriptionPlan).toBe("ENTERPRISE");
  });

  it("should build v1.5 manifest", () => {
    const manifest = ClockifyManifest.v1_5Builder()
      .key("my-addon-v5")
      .name("My Addon V5")
      .baseUrl("https://example.com/addon")
      .requireFreePlan()
      .build();

    expect(manifest.schemaVersion).toBe("1.5");
    expect(manifest.key).toBe("my-addon-v5");
    expect(manifest.minimalSubscriptionPlan).toBe("FREE");
  });

  it("should build v1.5 component and settings tab", () => {
    const component = ClockifyComponent.v1_5Builder()
      .invoicesAction()
      .allowEveryone()
      .path("/invoices/action")
      .label("Send Invoice")
      .build();

    expect(component.type).toBe("invoices.action");
    expect(component.accessLevel).toBe("EVERYONE");
    expect(component.path).toBe("/invoices/action");
    expect(component.label).toBe("Send Invoice");
  });

  it("should build v1.5 webhook with new events", () => {
    const webhook = ClockifyWebhook.v1_5Builder()
      .onApprovalRequestStatusUpdated()
      .path("/webhooks/approval")
      .build();

    expect(webhook.event).toBe("APPROVAL_REQUEST_STATUS_UPDATED");
    expect(webhook.path).toBe("/webhooks/approval");
  });

  it("should build v1.5 latest marketplace entrypoints", () => {
    const webhook = ClockifyWebhook.v1_5Builder()
      .onTimeEntrySplit()
      .path("/webhooks/time-entry-split")
      .build();
    const lifecycle = ClockifyLifecycleEvent.v1_5Builder()
      .path("/lifecycle/status-changed")
      .onStatusChanged()
      .build();
    const invoiceAction = ClockifyComponent.v1_5Builder()
      .invoicesAction()
      .allowAdmins()
      .path("/invoice/send")
      .label("Send invoice")
      .build();

    expect(webhook).toEqual({
      event: "TIME_ENTRY_SPLIT",
      path: "/webhooks/time-entry-split",
    });
    expect(lifecycle).toEqual({
      path: "/lifecycle/status-changed",
      type: "STATUS_CHANGED",
    });
    expect(invoiceAction.type).toBe("invoices.action");
  });

  it("should build v1.5 structured and self-hosted settings manifests", () => {
    const header = ClockifySettingsHeader.v1_5Builder().title("Mileage settings").build();
    const rate = ClockifySetting.v1_5Builder()
      .id("rate")
      .name("Mileage rate")
      .allowAdmins()
      .asNumber()
      .value(0)
      .required(true)
      .build();
    const group = ClockifySettingsGroup.v1_5Builder()
      .id("reimbursement")
      .title("Reimbursement")
      .settings([rate])
      .header(header)
      .build();
    const tab = ClockifySettingsTab.v1_5Builder()
      .id("general")
      .name("General")
      .groups([group])
      .build();
    const settings = ClockifySettings.v1_5Builder().tabs([tab]).build();

    const structured = ClockifyManifest.v1_5Builder()
      .key("structured-settings")
      .name("Structured Settings")
      .baseUrl("https://example.com/addon")
      .requireProPlan()
      .settings(settings)
      .build();
    const selfHosted = ClockifyManifest.v1_5Builder()
      .key("self-hosted-settings")
      .name("Self Hosted Settings")
      .baseUrl("https://example.com/addon")
      .requireProPlan()
      .settings("/iframe/settings")
      .build();

    expect(structured.settings).toEqual(settings);
    expect(selfHosted.settings).toBe("/iframe/settings");
  });

  it("should build setting drop-down multiple with asDropdownMultiple", () => {
    const setting = ClockifySetting.v1_4Builder()
      .id("multiple-setting")
      .name("Multi Setting")
      .allowAdmins()
      .asDropdownMultiple()
      .value(["val1", "val2"])
      .allowedValues(["val1", "val2", "val3"])
      .build();

    expect(setting.id).toBe("multiple-setting");
    expect(setting.accessLevel).toBe("ADMINS");
    expect(setting.type).toBe("DROPDOWN_MULTIPLE");
    expect(setting.value).toEqual(["val1", "val2"]);
    expect(setting.allowedValues).toEqual(["val1", "val2", "val3"]);
  });

  it("should check missing required fields in builder", () => {
    const builder = ClockifyManifest.v1_4Builder()
      .key("test")
      .name("test")
      .baseUrl("https://example.com");
    // Missing minimalSubscriptionPlan
    expect(() => (builder as any).build()).toThrow(
      "Required field 'minimalSubscriptionPlan' is missing.",
    );
  });

  it("should throw when required array setters are skipped through any escape hatches", () => {
    const v12Manifest = ClockifyManifest.v1_2Builder()
      .key("test")
      .name("test")
      .baseUrl("https://example.com")
      .requireBasicPlan();
    expect(() => (v12Manifest as any).build()).toThrow("Required field 'scopes' is missing.");

    const settingsGroup = ClockifySettingsGroup.v1_5Builder().id("group").title("Group");
    expect(() => (settingsGroup as any).build()).toThrow("Required field 'settings' is missing.");

    const settings = ClockifySettings.v1_5Builder();
    expect(() => (settings as any).build()).toThrow("Required field 'tabs' is missing.");
  });

  it("should keep optional arrays defaulting to empty lists", () => {
    const tab = ClockifySettingsTab.v1_5Builder().id("general").name("General").build();

    expect(tab.groups).toEqual([]);
    expect(tab.settings).toEqual([]);
  });

  it("should allow falsy setting values like false and 0 without throwing", () => {
    const settingBool = ClockifySetting.v1_4Builder()
      .id("bool-setting")
      .name("Bool Setting")
      .allowEveryone()
      .asCheckbox()
      .value(false)
      .build();

    expect(settingBool.value).toBe(false);

    const settingNum = ClockifySetting.v1_4Builder()
      .id("num-setting")
      .name("Num Setting")
      .allowEveryone()
      .asNumber()
      .value(0)
      .build();

    expect(settingNum.value).toBe(0);
  });
});
