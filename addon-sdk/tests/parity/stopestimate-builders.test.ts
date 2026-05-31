// Builder-API parity against a real, working SDK-based add-on: apet97/StopEstimate (schema 1.3).
//
// Unlike mileage (which hand-rolled its manifest POJO), StopEstimate builds its manifest with the
// Java add-on SDK's STEP BUILDERS:
//   ClockifyManifest.v1_3Builder()....build()
//   ClockifyComponent.builder().sidebar().allowAdmins().path("/sidebar").label(...).build()
//   ClockifyWebhook.builder().onNewTimerStarted().path("/webhook/new-timer-started").build()
//   ClockifyLifecycleEvent.builder().path("/lifecycle/installed").onInstalled().build()
//
// This reconstructs that manifest with the TS v1_3 builders using the IDENTICAL builder calls,
// proving the TS builder API matches real-world Java usage — including the component step order
// (type → accessLevel → path → label) that the §9 parity fix established.
import { describe, it, expect } from "vitest";
import { ClockifyManifest, generated } from "../../src";

const v13 = generated.v1_3;

function buildStopEstimateManifest() {
  const sidebar = v13
    .ClockifyComponentBuilder()
    .sidebar()
    .allowAdmins()
    .path("/sidebar")
    .label("Stop @ Estimate")
    .build();

  const lifecycle = [
    v13.ClockifyLifecycleEventBuilder().path("/lifecycle/installed").onInstalled().build(),
    v13.ClockifyLifecycleEventBuilder().path("/lifecycle/deleted").onDeleted().build(),
    v13.ClockifyLifecycleEventBuilder().path("/lifecycle/status-changed").onStatusChanged().build(),
    v13.ClockifyLifecycleEventBuilder().path("/lifecycle/settings-updated").onSettingsUpdated().build(),
  ];

  const webhooks = [
    v13.ClockifyWebhookBuilder().onNewTimerStarted().path("/webhook/new-timer-started").build(),
    v13.ClockifyWebhookBuilder().onTimerStopped().path("/webhook/timer-stopped").build(),
    v13.ClockifyWebhookBuilder().onNewTimeEntry().path("/webhook/new-time-entry").build(),
    v13.ClockifyWebhookBuilder().onTimeEntryUpdated().path("/webhook/time-entry-updated").build(),
    v13.ClockifyWebhookBuilder().onTimeEntryDeleted().path("/webhook/time-entry-deleted").build(),
  ];

  return ClockifyManifest.v1_3Builder()
    .key("stop-at-estimate")
    .name("Stop @ Estimate")
    .baseUrl("https://stopestimate.example.test")
    .requireProPlan()
    .components([sidebar])
    .lifecycle(lifecycle)
    .webhooks(webhooks)
    .scopes([
      "TIME_ENTRY_READ",
      "TIME_ENTRY_WRITE",
      "PROJECT_READ",
      "PROJECT_WRITE",
      "USER_READ",
      "EXPENSE_READ",
      "REPORTS_READ",
      "WORKSPACE_READ",
    ])
    .build();
}

describe("Builder parity: apet97/StopEstimate (schema 1.3, builder-based)", () => {
  const m = JSON.parse(JSON.stringify(buildStopEstimateManifest()));

  it("emits schemaVersion 1.3", () => {
    expect(m.schemaVersion).toBe("1.3");
  });

  it("webhook event helpers map to the correct events + paths (event → path order)", () => {
    expect(m.webhooks).toEqual([
      { event: "NEW_TIMER_STARTED", path: "/webhook/new-timer-started" },
      { event: "TIMER_STOPPED", path: "/webhook/timer-stopped" },
      { event: "NEW_TIME_ENTRY", path: "/webhook/new-time-entry" },
      { event: "TIME_ENTRY_UPDATED", path: "/webhook/time-entry-updated" },
      { event: "TIME_ENTRY_DELETED", path: "/webhook/time-entry-deleted" },
    ]);
  });

  it("lifecycle helpers map to the correct types (path → type order)", () => {
    expect(m.lifecycle).toEqual([
      { path: "/lifecycle/installed", type: "INSTALLED" },
      { path: "/lifecycle/deleted", type: "DELETED" },
      { path: "/lifecycle/status-changed", type: "STATUS_CHANGED" },
      { path: "/lifecycle/settings-updated", type: "SETTINGS_UPDATED" },
    ]);
  });

  it("sidebar component uses the real type→accessLevel→path→label chain", () => {
    expect(m.components).toEqual([
      { type: "sidebar", accessLevel: "ADMINS", path: "/sidebar", label: "Stop @ Estimate" },
    ]);
  });

  it("declares exactly the scopes StopEstimate requests", () => {
    expect(m.scopes).toEqual([
      "TIME_ENTRY_READ",
      "TIME_ENTRY_WRITE",
      "PROJECT_READ",
      "PROJECT_WRITE",
      "USER_READ",
      "EXPENSE_READ",
      "REPORTS_READ",
      "WORKSPACE_READ",
    ]);
  });
});
