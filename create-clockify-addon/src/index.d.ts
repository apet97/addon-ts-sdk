export type ClockifyAddonRuntime = "node" | "worker";
export type ClockifyAddonFeatureSet = "all" | "minimal";

export interface ScaffoldClockifyAddonOptions {
  readonly directory: string;
  readonly runtime: ClockifyAddonRuntime;
  readonly features: ClockifyAddonFeatureSet;
  readonly sdkSpec?: string;
}

/** Creates a Clockify add-on project without overwriting existing files. */
export function scaffoldClockifyAddon(
  options: ScaffoldClockifyAddonOptions,
): Promise<string>;
