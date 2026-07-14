import type { ClockifyManifest, ClockifySchemaVersion } from "./clockify-manifest";
import {
  validateManifest1_2,
  validateManifest1_3,
  validateManifest1_4,
  validateManifest1_5,
} from "./generated/manifest-validators";

/** A normalized manifest-validation issue suitable for logs and developer tooling. */
export interface ClockifyManifestValidationIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
  readonly message: string;
}

/** The non-throwing result returned by {@link validateClockifyManifest}. */
export type ClockifyManifestValidationResult =
  | { readonly ok: true; readonly value: ClockifyManifest<ClockifySchemaVersion> }
  | { readonly ok: false; readonly issues: readonly ClockifyManifestValidationIssue[] };

/** Error thrown when a manifest does not satisfy its declared Clockify schema. */
export class ClockifyManifestValidationError extends Error {
  readonly issues: readonly ClockifyManifestValidationIssue[];

  constructor(issues: readonly ClockifyManifestValidationIssue[]) {
    super(`Invalid Clockify manifest: ${issues.map((entry) => entry.message).join("; ")}`);
    this.name = "ClockifyManifestValidationError";
    this.issues = issues;
  }
}

interface GeneratedManifestValidationError {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
  readonly message?: string;
}

interface GeneratedManifestValidator {
  (value: unknown): boolean;
  readonly errors?: readonly GeneratedManifestValidationError[] | null;
}

const validatorsByVersion: Readonly<Record<ClockifySchemaVersion, GeneratedManifestValidator>> = {
  "1.2": validateManifest1_2 as GeneratedManifestValidator,
  "1.3": validateManifest1_3 as GeneratedManifestValidator,
  "1.4": validateManifest1_4 as GeneratedManifestValidator,
  "1.5": validateManifest1_5 as GeneratedManifestValidator,
};

function isSchemaVersion(value: unknown): value is ClockifySchemaVersion {
  return value === "1.2" || value === "1.3" || value === "1.4" || value === "1.5";
}

function normalizeIssue(error: GeneratedManifestValidationError): ClockifyManifestValidationIssue {
  return {
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
  };
}

/** Validates an unknown value against the schema named by its `schemaVersion` field. */
export function validateClockifyManifest(value: unknown): ClockifyManifestValidationResult {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) {
    return {
      ok: false,
      issues: [
        {
          instancePath: "",
          schemaPath: "#/schemaVersion",
          keyword: "required",
          message: "schemaVersion is required",
        },
      ],
    };
  }

  const version = (value as { readonly schemaVersion?: unknown }).schemaVersion;
  if (!isSchemaVersion(version)) {
    return {
      ok: false,
      issues: [
        {
          instancePath: "/schemaVersion",
          schemaPath: "#/schemaVersion",
          keyword: "enum",
          message: "schemaVersion must be one of 1.2, 1.3, 1.4, or 1.5",
        },
      ],
    };
  }

  const validator = validatorsByVersion[version];
  if (validator(value))
    return { ok: true, value: value as ClockifyManifest<ClockifySchemaVersion> };
  return { ok: false, issues: (validator.errors ?? []).map(normalizeIssue) };
}

/** Asserts that a value is a valid supported Clockify manifest. */
export function assertClockifyManifest(
  value: unknown,
): asserts value is ClockifyManifest<ClockifySchemaVersion> {
  const result = validateClockifyManifest(value);
  if (!result.ok) throw new ClockifyManifestValidationError(result.issues);
}
