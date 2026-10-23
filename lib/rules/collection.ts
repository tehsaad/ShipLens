/**
 * Collection rules (docs/SPEC.md section 6.3, amendment A1 and decision 8), checked by the
 * service layer before PostgreSQL enforces the same rules with triggers. Pure functions.
 */
import { toPaisa } from "@/lib/money";

export type LockReason = "LOCKED" | "WEEK_APPROVED";

/**
 * Why a collection can no longer be edited, or null while it is editable: editing is
 * allowed only while now < lockedAt and the report for its week is not APPROVED.
 */
export function collectionLockReason(
  lockedAt: Date,
  weekApproved: boolean,
  now: Date = new Date(),
): LockReason | null {
  if (now.getTime() >= lockedAt.getTime()) return "LOCKED";
  if (weekApproved) return "WEEK_APPROVED";
  return null;
}

/**
 * Amendment A1: a normal entry is greater than zero; a correction entry is non-zero. Returns
 * an error message, or null when the amount is acceptable.
 */
export function amountError(amount: string, isCorrection: boolean): string | null {
  const paisa = toPaisa(amount);
  if (isCorrection) return paisa === 0n ? "A correction cannot be zero." : null;
  return paisa > 0n ? null : "The amount must be greater than zero.";
}

/**
 * Amendment A1: the original plus all its corrections must stay at or above zero. `amounts`
 * holds the original and every correction as they would be after the change.
 */
export function correctedTotalIsValid(amounts: readonly string[]): boolean {
  return amounts.reduce((sum, amount) => sum + toPaisa(amount), 0n) >= 0n;
}
