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
