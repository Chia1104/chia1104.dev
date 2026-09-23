export class EmailDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("Failed to deliver the email");
    this.name = "EmailDeliveryError";
    this.cause = cause;
  }
}
