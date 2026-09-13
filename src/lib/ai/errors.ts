/** Thrown by any AIProvider when a call fails or returns unusable output. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}
