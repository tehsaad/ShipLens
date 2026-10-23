import { describe, expect, it } from "vitest";
import { parseDateOnly } from "@/lib/dates";
import { ReportStatus } from "@/lib/generated/prisma/enums";
import {
  nextReportStatus,
  notesEditable,
  overdueWeeks,
  submissionFor,
  totalsAreLive,
  weekCanBeOpened,
  weekIsComplete,
  type ReportTransition,
} from "@/lib/rules/report";

const d = parseDateOnly;

describe("report state machine (section 6.4)", () => {
  const expected: Record<string, ReportStatus | null> = {
    "DRAFT:submit": "SUBMITTED",
    "RETURNED:resubmit": "SUBMITTED",
    "SUBMITTED:approve": "APPROVED",
    "SUBMITTED:return": "RETURNED",
  };
  const transitions: ReportTransition[] = ["submit", "resubmit", "approve", "return"];

  for (const status of Object.values(ReportStatus)) {
    for (const transition of transitions) {
      const key = `${status}:${transition}`;
      const to = expected[key] ?? null;
      it(`${to ? "allows" : "rejects"} ${transition} from ${status}`, () => {
        expect(nextReportStatus(status, transition)).toBe(to);
      });
    }
  }

  it("never leaves APPROVED", () => {
    expect(transitions.map((t) => nextReportStatus("APPROVED", t))).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("picks submit or resubmit for the Branch Lead", () => {
    expect(submissionFor("DRAFT")).toBe("submit");
    expect(submissionFor("RETURNED")).toBe("resubmit");
    expect(submissionFor("SUBMITTED")).toBeNull();
    expect(submissionFor("APPROVED")).toBeNull();
  });

  it("keeps totals live and notes editable only while DRAFT or RETURNED", () => {
    expect(Object.values(ReportStatus).filter(totalsAreLive)).toEqual(["DRAFT", "RETURNED"]);
    expect(Object.values(ReportStatus).filter(notesEditable)).toEqual(["DRAFT", "RETURNED"]);
  });
});

describe("weeks", () => {
  it("is complete once its Sunday has passed", () => {
    expect(weekIsComplete(d("2026-10-12"), d("2026-10-18"))).toBe(false);
    expect(weekIsComplete(d("2026-10-12"), d("2026-10-19"))).toBe(true);
  });

  it("can be opened from its Monday on, never in the future", () => {
    expect(weekCanBeOpened(d("2026-10-19"), d("2026-10-19"))).toBe(true);
    expect(weekCanBeOpened(d("2026-10-19"), d("2026-10-18"))).toBe(false);
    expect(weekCanBeOpened(d("2026-10-12"), d("2026-10-18"))).toBe(true);
  });
});

describe("overdue reports (decision 9)", () => {
  it("lists completed weeks since opening that have no filed report", () => {
    // Opened on a Wednesday: its week counts. Today is Tuesday 3 November.
    const weeks = overdueWeeks(d("2026-10-07"), d("2026-11-03"), new Set(["2026-10-12"]));
    expect(weeks.map((w) => w.toISOString().slice(0, 10))).toEqual([
      "2026-10-05",
      "2026-10-19",
      "2026-10-26",
    ]);
  });

  it("ignores the current, incomplete week", () => {
    expect(overdueWeeks(d("2026-11-02"), d("2026-11-08"), new Set())).toEqual([]);
  });
});
