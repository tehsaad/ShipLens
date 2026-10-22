import { AppError } from "@/lib/errors";

/**
 * User-facing messages for the SQLSTATE codes raised by the database rules in
 * prisma/migrations/*_integrity_rules. They describe the rule, never the query.
 */
const RULE_MESSAGES: Record<string, string> = {
  SL001: "This collection is locked: entries can only be edited for 7 days.",
  SL002: "The weekly report for this date is approved. Record the entry in the current week.",
  SL003: "The collection date cannot be in the future.",
  SL004: "This branch is closed and accepts no new entries.",
  SL005: "A correction must reference an original collection from the same branch.",
  SL006: "A correction cannot reduce the original collection below zero.",
  SL007: "Records of this kind cannot be deleted.",
  SL008: "This field cannot be changed.",
  SL009: "The audit log cannot be changed.",
  SL010: "An approved weekly report is locked.",
};

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

/** The PostgreSQL SQLSTATE behind a Prisma error, when there is one. */
export function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const meta = (error as { meta?: unknown }).meta;
  if (meta && typeof meta === "object") {
    const cause = (meta as { driverAdapterError?: { cause?: { originalCode?: unknown } } })
      .driverAdapterError?.cause;
    if (cause && typeof cause.originalCode === "string") return cause.originalCode;
  }
  const code = (error as { code?: unknown }).code;
  // Raw pg errors carry the SQLSTATE directly (five characters).
  if (typeof code === "string" && code.length === 5 && !code.startsWith("P")) return code;
  return null;
}

/**
 * Converts a database rule violation into a safe AppError. Returns null for anything else,
 * which callers should rethrow so it is handled as an internal error.
 */
export function toRuleViolation(error: unknown): AppError | null {
  const code = databaseErrorCode(error);
  if (!code) return null;
  const message = RULE_MESSAGES[code];
  if (message) return new AppError("RULE_VIOLATION", message);
  if (code === UNIQUE_VIOLATION) {
    return new AppError("CONFLICT", "A record with these details already exists.");
  }
  if (code === CHECK_VIOLATION) {
    return new AppError("VALIDATION", "Some of the values are not valid.");
  }
  return null;
}
