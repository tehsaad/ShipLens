import { describe, expect, it } from "vitest";
import { formatPkr, fromPaisa, isAmount, normaliseAmount, toPaisa } from "@/lib/money";

describe("money", () => {
  it.each([
    ["0", 0n],
    ["5", 500n],
    ["5.5", 550n],
    ["1234.56", 123456n],
    ["-20.05", -2005n],
    ["999999999999.99", 99999999999999n],
  ])("parses %s", (value, paisa) => {
    expect(toPaisa(value)).toBe(paisa);
  });

  it.each(["", "1.234", "1e3", "abc", "1,000", "--1", "1234567890123"])("rejects %j", (value) => {
    expect(isAmount(value)).toBe(false);
    expect(() => toPaisa(value)).toThrow();
  });

  it("formats paisa with two decimals", () => {
    expect(fromPaisa(0n)).toBe("0.00");
    expect(fromPaisa(-5n)).toBe("-0.05");
    expect(normaliseAmount("7")).toBe("7.00");
  });

  it("formats PKR for display", () => {
    expect(formatPkr("1234567.5")).toBe("PKR 1,234,567.50");
    expect(formatPkr("-100")).toBe("-PKR 100.00");
    expect(formatPkr({ toString: () => "15.00" })).toBe("PKR 15.00");
  });
});
