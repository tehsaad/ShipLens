import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("CSV escaping (section 11)", () => {
  it("leaves plain values unquoted and renders empty values as empty fields", () => {
    expect(csvCell("BR-KHI-001")).toBe("BR-KHI-001");
    expect(csvCell(1250)).toBe("1250");
    expect(csvCell(12n)).toBe("12");
    expect(csvCell(true)).toBe("yes");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });

  it("quotes commas, quotes and line breaks, doubling embedded quotes", () => {
    expect(csvCell("Food, clothes")).toBe('"Food, clothes"');
    expect(csvCell('The "winter" drive')).toBe('"The ""winter"" drive"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralises cells a spreadsheet would run as formulas", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell("\r=1")).toBe('"\'\r=1"');
  });

  it("keeps signed numbers and phone numbers as they are", () => {
    expect(csvCell("-50.00")).toBe("-50.00");
    expect(csvCell("+923001234567")).toBe("+923001234567");
    expect(csvCell(-12.5)).toBe("-12.5");
  });

  it("keeps Urdu text intact", () => {
    expect(csvCell("کراچی")).toBe("کراچی");
  });

  it("writes a byte order mark, a header row and CRLF line endings", () => {
    const csv = toCsv(
      ["Name", "Amount"],
      [
        ["Ali, Khan", "-50.00"],
        ["Sara", null],
      ],
    );
    expect(csv).toBe('﻿Name,Amount\r\n"Ali, Khan",-50.00\r\nSara,\r\n');
  });
});
