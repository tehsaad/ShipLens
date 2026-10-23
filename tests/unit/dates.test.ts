import { describe, expect, it } from "vitest";
import { addDays, businessToday, formatDateOnly, parseDateOnly, weekStartOf } from "@/lib/dates";

describe("date-only helpers", () => {
  it("round-trips YYYY-MM-DD and rejects impossible dates", () => {
    expect(formatDateOnly(parseDateOnly("2026-02-28"))).toBe("2026-02-28");
    expect(() => parseDateOnly("2026-02-30")).toThrow();
    expect(() => parseDateOnly("28/02/2026")).toThrow();
  });

  it("finds the Monday of the ISO week, with Sunday ending the week", () => {
    expect(formatDateOnly(weekStartOf(parseDateOnly("2026-10-12")))).toBe("2026-10-12"); // Mon
    expect(formatDateOnly(weekStartOf(parseDateOnly("2026-10-15")))).toBe("2026-10-12"); // Thu
    expect(formatDateOnly(weekStartOf(parseDateOnly("2026-10-18")))).toBe("2026-10-12"); // Sun
    expect(formatDateOnly(weekStartOf(parseDateOnly("2026-10-19")))).toBe("2026-10-19"); // Mon
  });

  it("adds days across month and year boundaries", () => {
    expect(formatDateOnly(addDays(parseDateOnly("2025-12-30"), 3))).toBe("2026-01-02");
    expect(formatDateOnly(addDays(parseDateOnly("2026-03-01"), -1))).toBe("2026-02-28");
  });

  it("uses the Asia/Karachi calendar date for business today", () => {
    // 20:30 UTC on 21 October is 01:30 on 22 October in Karachi (UTC+5).
    expect(formatDateOnly(businessToday(new Date("2026-10-21T20:30:00Z")))).toBe("2026-10-22");
    expect(formatDateOnly(businessToday(new Date("2026-10-21T18:59:00Z")))).toBe("2026-10-21");
  });
});
