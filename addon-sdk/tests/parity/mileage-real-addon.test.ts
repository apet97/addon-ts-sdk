// Real-world end-to-end parity check.
//
// Reconstructs the PRODUCTION manifest of the working Java add-on
// `addons-me/mileage-for-clockify` (com.cake.clockify.addon.mileage.config.MileageManifestV15,
// schema 1.5) using ONLY the TypeScript SDK's v1_5 builders, then proves the serialized output
// matches the real add-on's manifest and is served correctly through the Addon router.
//
// Golden values are transcribed verbatim from MileageManifestV15.java + the addon.* properties
// asserted in MileageManifestTest.java.
import { describe, it, expect } from "vitest";
import { ClockifyAddon, ClockifyManifest, generated } from "../../src";

const KEY = "mileage-for-clockify";
const NAME = "Mileage for Clockify";
const DESCRIPTION =
  "Create and convert precise mileage reimbursements into real Clockify flat expenses.";
const BASE_URL = "https://mileage.example.com";
const ICON = "/assets/mileage/icon.png";

// The exact JSON the Java add-on serves at GET /manifest (Jackson @JsonInclude(NON_NULL)).
const EXPECTED_MANIFEST = {
  schemaVersion: "1.5",
  key: KEY,
  name: NAME,
  baseUrl: BASE_URL,
  minimalSubscriptionPlan: "PRO",
  description: DESCRIPTION,
  iconPath: ICON,
  scopes: ["EXPENSE_READ", "EXPENSE_WRITE", "USER_READ", "PROJECT_READ", "WORKSPACE_READ"],
  lifecycle: [
    { path: "/lifecycle/installed", type: "INSTALLED" },
    { path: "/lifecycle/deleted", type: "DELETED" },
    { path: "/lifecycle/settings-updated", type: "SETTINGS_UPDATED" },
    { path: "/lifecycle/status-changed", type: "STATUS_CHANGED" },
  ],
  webhooks: [
    { event: "EXPENSE_CREATED", path: "/webhook/expense-created" },
    { event: "EXPENSE_UPDATED", path: "/webhook/expense-updated" },
    { event: "EXPENSE_DELETED", path: "/webhook/expense-deleted" },
    { event: "EXPENSE_RESTORED", path: "/webhook/expense-restored" },
  ],
  components: [
    {
      type: "sidebar",
      label: "Mileage",
      accessLevel: "EVERYONE",
      path: "/iframe/mileage",
      iconPath: ICON,
    },
  ],
  settings: "/iframe/settings",
};

function buildMileageManifest() {
  const lifecycle = [
    generated.v1_5
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/installed")
      .onInstalled()
      .build(),
    generated.v1_5.ClockifyLifecycleEventBuilder().path("/lifecycle/deleted").onDeleted().build(),
    generated.v1_5
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/settings-updated")
      .onSettingsUpdated()
      .build(),
    generated.v1_5
      .ClockifyLifecycleEventBuilder()
      .path("/lifecycle/status-changed")
      .onStatusChanged()
      .build(),
  ];

  const webhooks = [
    generated.v1_5
      .ClockifyWebhookBuilder()
      .event("EXPENSE_CREATED")
      .path("/webhook/expense-created")
      .build(),
    generated.v1_5
      .ClockifyWebhookBuilder()
      .event("EXPENSE_UPDATED")
      .path("/webhook/expense-updated")
      .build(),
    generated.v1_5
      .ClockifyWebhookBuilder()
      .event("EXPENSE_DELETED")
      .path("/webhook/expense-deleted")
      .build(),
    generated.v1_5
      .ClockifyWebhookBuilder()
      .event("EXPENSE_RESTORED")
      .path("/webhook/expense-restored")
      .build(),
  ];

  const components = [
    generated.v1_5
      .ClockifyComponentBuilder()
      .type("sidebar")
      .allowEveryone()
      .path("/iframe/mileage")
      .label("Mileage")
      .iconPath(ICON)
      .build(),
  ];

  return ClockifyManifest.v1_5Builder()
    .key(KEY)
    .name(NAME)
    .baseUrl(BASE_URL)
    .requireProPlan()
    .scopes(["EXPENSE_READ", "EXPENSE_WRITE", "USER_READ", "PROJECT_READ", "WORKSPACE_READ"])
    .description(DESCRIPTION)
    .iconPath(ICON)
    .lifecycle(lifecycle)
    .webhooks(webhooks)
    .components(components)
    .settings("/iframe/settings")
    .build();
}

describe("Real add-on parity: mileage-for-clockify (schema 1.5)", () => {
  it("the TS v1_5 builders reproduce the production manifest exactly", () => {
    const manifest = buildMileageManifest();
    // Mirror what goes over the wire (Jackson NON_NULL ⇔ JSON.stringify drops undefined).
    const serialized = JSON.parse(JSON.stringify(manifest));
    expect(serialized).toEqual(EXPECTED_MANIFEST);
  });

  it("serves that manifest through the Addon router at GET /manifest", async () => {
    const addon = new ClockifyAddon(buildMileageManifest());
    const res = await addon.handle({ method: "GET", path: "/manifest", headers: {} });
    expect(res.status).toBe(200);
    expect(res.headers?.["content-type"]).toBe("application/json");
    const served = JSON.parse(JSON.stringify(res.body));
    expect(served).toEqual(EXPECTED_MANIFEST);
  });
});
