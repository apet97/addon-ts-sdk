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
