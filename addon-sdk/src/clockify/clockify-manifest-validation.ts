import Ajv from "ajv-draft-04";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import { clockifyManifestSchemas } from "./generated/manifest-schemas";
import type { ClockifyManifest, ClockifySchemaVersion } from "./clockify-manifest";

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

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
});
const validators = new Map<ClockifySchemaVersion, ValidateFunction>();

function isSchemaVersion(value: unknown): value is ClockifySchemaVersion {
  return value === "1.2" || value === "1.3" || value === "1.4" || value === "1.5";
}

function normalizeIssue(error: ErrorObject): ClockifyManifestValidationIssue {
  return {
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
  };
}

function validatorFor(version: ClockifySchemaVersion): ValidateFunction {
  const existing = validators.get(version);
  if (existing) return existing;
  const validator = ajv.compile(clockifyManifestSchemas[version] as AnySchema);
  validators.set(version, validator);
  return validator;
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

  const validator = validatorFor(version);
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
