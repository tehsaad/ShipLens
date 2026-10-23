import { describe, expect, it } from "vitest";
import { BranchStatus } from "@/lib/generated/prisma/enums";
import {
  canChangeBranchStatus,
  cityCodePrefix,
  formatBranchCode,
  nextBranchNumber,
} from "@/lib/rules/branch";

describe("branch lifecycle (section 6.1)", () => {
  const allowed = new Set([
    "FORMING->ACTIVE",
    "ACTIVE->PAUSED",
    "PAUSED->ACTIVE",
    "ACTIVE->CLOSED",
    "PAUSED->CLOSED",
  ]);
  const statuses = Object.values(BranchStatus);

  for (const from of statuses) {
    for (const to of statuses) {
      const key = `${from}->${to}`;
      it(`${allowed.has(key) ? "allows" : "rejects"} ${key}`, () => {
        expect(canChangeBranchStatus(from, to)).toBe(allowed.has(key));
      });
    }
  }
});

describe("branch codes (section 6.1)", () => {
  it.each([
    ["Karachi", "KAR"],
    ["lahore", "LAH"],
    ["D.I. Khan", "DIK"],
    ["Mérida", "MER"],
    ["  Islamabad ", "ISL"],
  ])("takes the first three letters of %s", (city, prefix) => {
    expect(cityCodePrefix(city)).toBe(prefix);
  });

  it("rejects a city with fewer than three Latin letters", () => {
    expect(cityCodePrefix("Ab")).toBeNull();
    expect(cityCodePrefix("کراچی")).toBeNull();
    expect(cityCodePrefix("A-1 B")).toBeNull();
  });

  it("formats the number with three digits", () => {
    expect(formatBranchCode("KAR", 1)).toBe("BR-KAR-001");
    expect(formatBranchCode("KAR", 42)).toBe("BR-KAR-042");
    expect(formatBranchCode("KAR", 999)).toBe("BR-KAR-999");
  });

  it("starts at 001 for a new city", () => {
    expect(nextBranchNumber("PES", [])).toBe(1);
  });

  it("uses one above the highest number, never filling gaps", () => {
    expect(nextBranchNumber("KAR", ["BR-KAR-001", "BR-KAR-003"])).toBe(4);
  });

  it("ignores codes of other cities", () => {
    expect(nextBranchNumber("KAR", ["BR-KAT-007", "BR-LAH-002"])).toBe(1);
  });

  it("reports when a city has used every number", () => {
    expect(nextBranchNumber("KAR", ["BR-KAR-999"])).toBeNull();
    expect(nextBranchNumber("KAR", ["BR-KAR-998"])).toBe(999);
  });
});
