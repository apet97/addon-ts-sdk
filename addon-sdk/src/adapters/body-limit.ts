export const DEFAULT_MAX_BODY_BYTES = 1_048_576;

export interface BodyLimitOptions {
  readonly maxBodyBytes?: number;
}

export class PayloadTooLargeError extends Error {
  constructor(readonly maxBodyBytes: number) {
    super(`Request body exceeds ${maxBodyBytes} bytes.`);
    this.name = "PayloadTooLargeError";
  }
}

/** Error raised when a declared request-body length is not a non-negative safe integer. */
export class InvalidContentLengthError extends Error {
  constructor(readonly value: string) {
    super("Content-Length must be a non-negative integer.");
    this.name = "InvalidContentLengthError";
  }
}

/** Parses an optional Content-Length header without accepting ambiguous numeric forms. */
export function parseContentLength(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new InvalidContentLengthError(value);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new InvalidContentLengthError(value);
  return parsed;
}

export function resolveMaxBodyBytes(options: BodyLimitOptions = {}): number {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new RangeError("maxBodyBytes must be a positive integer.");
  }
  return maxBodyBytes;
}

export function isPayloadTooLargeError(error: unknown): error is PayloadTooLargeError {
  return error instanceof PayloadTooLargeError;
}
