import * as generated from "./generated";

export type ClockifySchemaVersion = "1.2" | "1.3" | "1.4" | "1.5" | "1.6";

export type ClockifyManifest<V extends ClockifySchemaVersion = "1.4"> = V extends "1.2"
  ? generated.v1_2.ClockifyManifest
  : V extends "1.3"
    ? generated.v1_3.ClockifyManifest
    : V extends "1.4"
      ? generated.v1_4.ClockifyManifest
      : V extends "1.5"
        ? generated.v1_5.ClockifyManifest
        : generated.v1_6.ClockifyManifest;

export const ClockifyManifest = {
  /**
   * Canonical entry point: the current schema version's builder (currently
   * 1.5). Schema 1.6 is also vendored and stable — it is additive over 1.5
   * (see `addon-sdk/docs/manifest-builders.md`) — and available via
   * {@link v1_6Builder} for a project that wants its newer fields.
   */
  builder: generated.v1_5.ClockifyManifest.builder,
  v1_2Builder: generated.v1_2.ClockifyManifest.builder,
  v1_3Builder: generated.v1_3.ClockifyManifest.builder,
  v1_4Builder: generated.v1_4.ClockifyManifest.builder,
  v1_5Builder: generated.v1_5.ClockifyManifest.builder,
  v1_6Builder: generated.v1_6.ClockifyManifest.builder,
};
