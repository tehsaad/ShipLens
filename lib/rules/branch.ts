/**
 * Branch codes and lifecycle (docs/SPEC.md section 6.1). Pure functions, shared by the
 * service layer and the admin screens.
 */
import type { BranchStatus } from "@/lib/generated/prisma/enums";

/**
 * Allowed status changes: FORMING -> ACTIVE -> PAUSED <-> ACTIVE, and ACTIVE or PAUSED ->
 * CLOSED. CLOSED is terminal. A FORMING branch never opened, so it cannot be closed or paused.
 */
export const BRANCH_TRANSITIONS: Record<BranchStatus, readonly BranchStatus[]> = {
  FORMING: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

export function canChangeBranchStatus(from: BranchStatus, to: BranchStatus): boolean {
  return BRANCH_TRANSITIONS[from].includes(to);
}

/** The highest NNN a city can use; the code format has three digits. */
export const MAX_BRANCH_NUMBER = 999;

/**
 * The CITY3 part of a branch code: the first three Latin letters of the city, uppercase.
 * Accents are dropped ("Mérida" -> "MER") and other characters skipped ("D.I. Khan" ->
 * "DIK"). Returns null when the city has fewer than three Latin letters.
 */
export function cityCodePrefix(city: string): string | null {
  const letters = city
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : null;
}

export function formatBranchCode(prefix: string, number: number): string {
  return `BR-${prefix}-${String(number).padStart(3, "0")}`;
}

/**
 * The next free number for a city, given the codes already used with that prefix: one
 * above the highest, so numbers are never reused. Returns null when the city has used 999.
 */
export function nextBranchNumber(prefix: string, existingCodes: readonly string[]): number | null {
  const pattern = new RegExp(`^BR-${prefix}-(\\d{3})$`);
  let highest = 0;
  for (const code of existingCodes) {
    const match = pattern.exec(code);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest >= MAX_BRANCH_NUMBER ? null : highest + 1;
}
