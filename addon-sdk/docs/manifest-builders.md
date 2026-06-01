# Manifest and Component Builders

This document describes how the type-safe builders are structured and generated.

## Versioned Manifest Builders

Builders are generated directly from Clockify's manifest schemas for versions 1.2, 1.3, 1.4, and 1.5. They use a **type-state pattern** to enforce that required fields are set in sequence.

```typescript
import { ClockifyManifest } from "@apet97/clockify-addon-sdk";

// Compile-time checks force you to chain required fields: key -> name -> baseUrl -> minimalSubscriptionPlan
const manifest = ClockifyManifest.v1_4Builder()
  .key("my-addon")
  .name("My Add-on")
  .baseUrl("https://example.com")
  .requireBasicPlan()
  .build();
```

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

The v1.5 builders are generated from the live Clockify manifest schema endpoint and include the
latest Marketplace surface, including:

- webhook events such as `TIME_ENTRY_SPLIT`
- lifecycle `STATUS_CHANGED`
- component `invoices.action`
- both self-hosted settings paths (`settings("/iframe/settings")`) and structured settings objects

Use `generated.v1_5.*` for version-specific enum constants and model types when you need to prove a
value is present only in v1.5.

## Runtime Marketplace Helpers

Manifest builders cover the schema surface only. Runtime Marketplace rules such as webhook event
headers, lifecycle token headers, `X-Addon-Token`, and region-specific URL claims are covered by the
request verification helpers documented in `docs/token-validation.md`.
