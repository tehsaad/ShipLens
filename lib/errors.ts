/**
 * Errors with a safe, user-facing message and an HTTP status. Anything else that escapes a
 * server action or route handler is treated as an internal error and never shown to users.
 */
export type AppErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "RULE_VIOLATION";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RULE_VIOLATION: 422,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in.");
export const forbidden = () => new AppError("FORBIDDEN", "You do not have permission to do that.");
export const notFound = () => new AppError("NOT_FOUND", "Not found.");

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
