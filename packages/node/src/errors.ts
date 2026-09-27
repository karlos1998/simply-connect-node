import type { ProblemDetail } from "./types.js";

export class SimplyConnectError extends Error {
  override readonly name: string = "SimplyConnectError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class SimplyConnectApiError extends SimplyConnectError {
  override readonly name: string = "SimplyConnectApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly correlationId: string | null,
    readonly problem: ProblemDetail | null,
    readonly responseBody: string,
  ) {
    super(message);
  }
}

export class AuthenticationError extends SimplyConnectApiError {
  override readonly name: string = "AuthenticationError";
}

export class ValidationError extends SimplyConnectApiError {
  override readonly name: string = "ValidationError";
}

export class NotFoundError extends SimplyConnectApiError {
  override readonly name: string = "NotFoundError";
}

export class IdempotencyConflictError extends SimplyConnectApiError {
  override readonly name: string = "IdempotencyConflictError";
}

export class RateLimitError extends SimplyConnectApiError {
  override readonly name: string = "RateLimitError";

  constructor(
    message: string,
    status: number,
    correlationId: string | null,
    problem: ProblemDetail | null,
    responseBody: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message, status, correlationId, problem, responseBody);
  }
}
