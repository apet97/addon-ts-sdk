import * as generated from "./generated";
import { ClockifySchemaVersion } from "./clockify-manifest";

export type ClockifyWebhook<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifyWebhook
    : V extends "1.3"
      ? generated.v1_3.ClockifyWebhook
      : V extends "1.4"
        ? generated.v1_4.ClockifyWebhook
        : generated.v1_5.ClockifyWebhook;

export const ClockifyWebhook = {
  v1_2Builder: generated.v1_2.ClockifyWebhook.builder,
  v1_3Builder: generated.v1_3.ClockifyWebhook.builder,
  v1_4Builder: generated.v1_4.ClockifyWebhook.builder,
  v1_5Builder: generated.v1_5.ClockifyWebhook.builder,
};

export type ClockifyLifecycleEvent<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifyLifecycleEvent
    : V extends "1.3"
      ? generated.v1_3.ClockifyLifecycleEvent
      : V extends "1.4"
        ? generated.v1_4.ClockifyLifecycleEvent
        : generated.v1_5.ClockifyLifecycleEvent;

export const ClockifyLifecycleEvent = {
  v1_2Builder: generated.v1_2.ClockifyLifecycleEvent.builder,
  v1_3Builder: generated.v1_3.ClockifyLifecycleEvent.builder,
  v1_4Builder: generated.v1_4.ClockifyLifecycleEvent.builder,
  v1_5Builder: generated.v1_5.ClockifyLifecycleEvent.builder,
};

export type ClockifyComponent<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifyComponent
    : V extends "1.3"
      ? generated.v1_3.ClockifyComponent
      : V extends "1.4"
        ? generated.v1_4.ClockifyComponent
        : generated.v1_5.ClockifyComponent;

export const ClockifyComponent = {
  v1_2Builder: generated.v1_2.ClockifyComponent.builder,
  v1_3Builder: generated.v1_3.ClockifyComponent.builder,
  v1_4Builder: generated.v1_4.ClockifyComponent.builder,
  v1_5Builder: generated.v1_5.ClockifyComponent.builder,
};

export type ClockifySetting<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifySetting
    : V extends "1.3"
      ? generated.v1_3.ClockifySetting
      : V extends "1.4"
        ? generated.v1_4.ClockifySetting
        : generated.v1_5.ClockifySetting;

export const ClockifySetting = {
  v1_2Builder: generated.v1_2.ClockifySetting.builder,
  v1_3Builder: generated.v1_3.ClockifySetting.builder,
  v1_4Builder: generated.v1_4.ClockifySetting.builder,
  v1_5Builder: generated.v1_5.ClockifySetting.builder,
};

export type ClockifySettingsHeader<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifySettingsHeader
    : V extends "1.3"
      ? generated.v1_3.ClockifySettingsHeader
      : V extends "1.4"
        ? generated.v1_4.ClockifySettingsHeader
        : generated.v1_5.ClockifySettingsHeader;

export const ClockifySettingsHeader = {
  v1_2Builder: generated.v1_2.ClockifySettingsHeader.builder,
  v1_3Builder: generated.v1_3.ClockifySettingsHeader.builder,
  v1_4Builder: generated.v1_4.ClockifySettingsHeader.builder,
  v1_5Builder: generated.v1_5.ClockifySettingsHeader.builder,
};

export type ClockifySettingsGroup<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifySettingsGroup
    : V extends "1.3"
      ? generated.v1_3.ClockifySettingsGroup
      : V extends "1.4"
        ? generated.v1_4.ClockifySettingsGroup
        : generated.v1_5.ClockifySettingsGroup;

export const ClockifySettingsGroup = {
  v1_2Builder: generated.v1_2.ClockifySettingsGroup.builder,
  v1_3Builder: generated.v1_3.ClockifySettingsGroup.builder,
  v1_4Builder: generated.v1_4.ClockifySettingsGroup.builder,
  v1_5Builder: generated.v1_5.ClockifySettingsGroup.builder,
};

export type ClockifySettingsTab<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifySettingsTab
    : V extends "1.3"
      ? generated.v1_3.ClockifySettingsTab
      : V extends "1.4"
        ? generated.v1_4.ClockifySettingsTab
        : generated.v1_5.ClockifySettingsTab;

export const ClockifySettingsTab = {
  v1_2Builder: generated.v1_2.ClockifySettingsTab.builder,
  v1_3Builder: generated.v1_3.ClockifySettingsTab.builder,
  v1_4Builder: generated.v1_4.ClockifySettingsTab.builder,
  v1_5Builder: generated.v1_5.ClockifySettingsTab.builder,
};

export type ClockifySettings<V extends ClockifySchemaVersion = "1.4"> =
  V extends "1.2"
    ? generated.v1_2.ClockifySettings
    : V extends "1.3"
      ? generated.v1_3.ClockifySettings
      : V extends "1.4"
        ? generated.v1_4.ClockifySettings
        : generated.v1_5.ClockifySettings;

export const ClockifySettings = {
  v1_2Builder: generated.v1_2.ClockifySettings.builder,
  v1_3Builder: generated.v1_3.ClockifySettings.builder,
  v1_4Builder: generated.v1_4.ClockifySettings.builder,
  v1_5Builder: generated.v1_5.ClockifySettings.builder,
};

// Top-level convenience exports for the manifest-level enums. These mirror the default
// schema version (1.4); per-version variants remain available under `generated.vX_Y.*`.
export const ClockifyScope = generated.v1_4.ClockifyScope;
export type ClockifyScope = generated.v1_4.ClockifyScope;

export const ClockifyMinimalSubscriptionPlan = generated.v1_4.ClockifyMinimalSubscriptionPlan;
export type ClockifyMinimalSubscriptionPlan = generated.v1_4.ClockifyMinimalSubscriptionPlan;

