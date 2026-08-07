export class ValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationException";
    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}

export class IllegalArgumentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalArgumentException";
    Object.setPrototypeOf(this, IllegalArgumentException.prototype);
  }
}

/** True for the SDK's own registration/input-validation errors (bad wiring), never a runtime verification failure. */
export function isAddonInputError(
  error: unknown,
): error is ValidationException | IllegalArgumentException {
  return error instanceof ValidationException || error instanceof IllegalArgumentException;
}
