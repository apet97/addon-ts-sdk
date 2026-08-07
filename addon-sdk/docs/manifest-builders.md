# Manifest and Component Builders

This document describes how the type-safe builders are structured and generated.

## Versioned Manifest Builders

Builders are generated from the vendored Clockify manifest schemas for versions 1.2, 1.3, 1.4, 1.5,
and 1.6. They use a **type-state pattern** to enforce that required fields are set in sequence. Schema
descriptions are emitted as JSDoc on public generated interfaces and builder steps, so editor help
stays tied to the provenance-checked schema source.

```typescript
import { ClockifyManifest } from "@apet97/clockify-addon-sdk";

// Compile-time checks force you to chain required fields: key -> name -> baseUrl -> minimalSubscriptionPlan
const manifest = ClockifyManifest.v1_5Builder()
  .key("my-addon")
  .name("My Add-on")
  .baseUrl("https://example.com")
  .requireBasicPlan()
  .build();
```

Schema 1.5 is the main path for new manifests. `ClockifyManifest.builder()` is a canonical alias
for `v1_5Builder()`; use whichever name reads better. The explicit `v1_2Builder()`,
`v1_3Builder()`, `v1_4Builder()`, and `v1_6Builder()` factories remain available for compatibility
and for schema 1.6's additive surface. Root model type parameters and convenience enum aliases
still default to 1.4 for Java parity, so use the explicit `v1_5Builder()`/`v1_6Builder()` (or
`builder()`) and the matching `generated.v1_5`/`generated.v1_6` types when new code needs a later
schema's surface.

A missing required field raises `Error("Required field '<name>' is missing.")` from `build()`
before an incomplete manifest is ever constructed.

## Enum Helper Methods

The builders generate idiomatic helper methods from the schema enums:

- **Subscription Plans**:
  - `requireFreePlan()`
  - `requireBasicPlan()`
  - `requireStandardPlan()`
  - `requireProPlan()`
  - `requireEnterprisePlan()`

- **Access Level**:
  - `allowAdmins()`
  - `allowEveryone()`

- **Lifecycle Events**:
  - `onInstalled()`
  - `onDeleted()`
  - `onSettingsUpdated()`
  - `onStatusChanged()`

- **Components**:
  - `sidebar()`
  - `widget()`
  - `activityTab()`
  - `scheduleTab()`
    // and so on.

## Schema 1.5 Coverage

The v1.5 builders are generated from the vendored schema captured from Clockify's live manifest
schema endpoint and include:

- webhook events such as `TIME_ENTRY_SPLIT`
- lifecycle `STATUS_CHANGED`
- component `invoices.action`
- both self-hosted settings paths (`settings("/iframe/settings")`) and structured settings objects

Use `generated.v1_5.*` for version-specific enum constants and model types when you need to prove a
value is present only in v1.5.

## Schema 1.6 Coverage

Schema 1.6 is additive over 1.5: one new webhook event (`TIME_OFF_REQUEST_STARTED`, exposed as
`onTimeOffRequestStarted()`) and one new component type (`timeentries.action.uiblocks`, exposed as
`timeentriesActionUiblocks()`). No fields were added, removed, or changed from required to optional,
so the v1.6 builders otherwise mirror v1.5. Use `ClockifyManifest.v1_6Builder()` and
`generated.v1_6.*` when a manifest needs either new surface.

Clockify's live schema endpoint also serves an intermediate `1.5.1` schema — the webhook event
listed above alone, without the 1.6 component type — that this SDK does not vendor a dedicated
builder or validator for. A manifest built with `v1_6Builder()` satisfies every field `1.5.1`
requires, so `1.6` is a safe drop-in replacement for `1.5.1` manifests; only a manifest whose
`schemaVersion` literally must read `"1.5.1"` is unsupported. `validateClockifyManifest()` fails
closed with an unsupported-version issue for that exact string rather than validating it against
the wrong schema.

`validateClockifyManifest()`, `assertClockifyManifest()`, and
`createValidatedClockifyAddon()` dispatch by `schemaVersion` to generated static Draft-04
validators. AJV runs during repository code generation, not during request handling; the committed
validators do not import the AJV compiler or use string code generation, so the same validation path
works in Node and Worker runtimes.

## Runtime Marketplace Helpers

Manifest builders cover the schema surface only. Runtime Marketplace rules such as webhook event
headers, lifecycle token headers, `X-Addon-Token`, and region-specific URL claims are covered by the
request verification helpers documented in [Token Signature Verification](./token-validation.md).

For structured settings, the generated builders stay faithful to the schema. The SDK also exports
small helper creators such as `createClockifyNumberSetting()` and
`createClockifyDropdownSingleSetting()` when you want plain schema-compatible setting objects with
the setting type paired to the right TypeScript value type.
