/**
 * Weekly report workflow (docs/SPEC.md section 6.4) and the overdue-report indicator
 * (decision 9). Pure functions, shared by the service layer and the admin screens.
 */
import { addDays, weekStartOf } from "@/lib/dates";
import type { ReportStatus } from "@/lib/generated/prisma/enums";

export type ReportTransition = "submit" | "resubmit" | "approve" | "return";

/**
 * DRAFT -> SUBMITTED (submit), SUBMITTED -> APPROVED (approve) or RETURNED (return, with a
 * comment), RETURNED -> SUBMITTED (resubmit). APPROVED is terminal.
 */
const TRANSITIONS: Record<ReportTransition, { from: ReportStatus; to: ReportStatus }> = {
  submit: { from: "DRAFT", to: "SUBMITTED" },
  resubmit: { from: "RETURNED", to: "SUBMITTED" },
  approve: { from: "SUBMITTED", to: "APPROVED" },
  return: { from: "SUBMITTED", to: "RETURNED" },
};

/** The status a transition leads to, or null when it is not allowed from `from`. */
export function nextReportStatus(
  from: ReportStatus,
  transition: ReportTransition,
): ReportStatus | null {
  const rule = TRANSITIONS[transition];
  return rule.from === from ? rule.to : null;
}

/** The Branch Lead's submission: first submit from DRAFT, resubmit after a return. */
export function submissionFor(status: ReportStatus): ReportTransition | null {
  if (status === "DRAFT") return "submit";
  if (status === "RETURNED") return "resubmit";
  return null;
}

/** Totals are live (recomputed) while DRAFT or RETURNED, and frozen once SUBMITTED. */
export function totalsAreLive(status: ReportStatus): boolean {
  return status === "DRAFT" || status === "RETURNED";
}

/** Lead notes can be edited while the Branch Lead owns the report. */
export function notesEditable(status: ReportStatus): boolean {
  return totalsAreLive(status);
}

/** A week is complete once its Sunday has passed in Asia/Karachi. */
export function weekIsComplete(weekStart: Date, today: Date): boolean {
  return addDays(weekStart, 7) <= today;
}

/** A week can be opened once it has started: the current week or an earlier one. */
export function weekCanBeOpened(weekStart: Date, today: Date): boolean {
  return weekStart <= weekStartOf(today);
}

/**
 * Decision 9: the completed weeks since the branch opened that have no SUBMITTED or APPROVED
 * report, oldest first. `filedWeeks` holds the weekStart of every SUBMITTED or APPROVED
 * report (as YYYY-MM-DD).
 */
export function overdueWeeks(openedAt: Date, today: Date, filedWeeks: ReadonlySet<string>): Date[] {
  const overdue: Date[] = [];
  for (let week = weekStartOf(openedAt); weekIsComplete(week, today); week = addDays(week, 7)) {
    if (!filedWeeks.has(week.toISOString().slice(0, 10))) overdue.push(week);
  }
  return overdue;
}
