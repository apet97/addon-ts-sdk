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
