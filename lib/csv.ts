/**
 * CSV encoding for exports (section 7.3): RFC 4180 fields and CRLF line breaks, with a UTF-8
 * byte order mark so spreadsheet programs read Urdu names correctly.
 *
 * Spreadsheets run a cell that starts with =, +, -, @, tab or carriage return as a formula
 * (CSV injection), so such text gets a leading apostrophe. Plain numbers such as "-50.00" or
 * "+923001234567" cannot form a formula and are left as they are.
 */

export type CsvValue = string | number | bigint | boolean | null | undefined;

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(?:\.\d+)?$/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
