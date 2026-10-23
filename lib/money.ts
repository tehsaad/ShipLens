/**
 * Money in PKR with two decimals (Decimal(14,2), section 5). Amounts are handled as integer
 * paisa (bigint) so sums and comparisons never suffer floating-point rounding.
 */

/** Up to 12 digits before the point (Decimal(14,2)), optional sign, at most 2 decimals. */
const AMOUNT = /^(-)?(\d{1,12})(?:\.(\d{1,2}))?$/;

/** Parses "1234.5" or "-20.00" into paisa. Throws on anything else. */
export function toPaisa(value: string): bigint {
  const match = AMOUNT.exec(value.trim());
  if (!match) throw new Error(`Invalid amount "${value}"`);
  const [, sign, whole, fraction = ""] = match;
  const paisa = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign ? -paisa : paisa;
}

export function isAmount(value: string): boolean {
  return AMOUNT.test(value.trim());
}

/** Formats paisa as a plain decimal string with two places, e.g. "-20.50". */
export function fromPaisa(paisa: bigint): string {
  const sign = paisa < 0n ? "-" : "";
  const absolute = paisa < 0n ? -paisa : paisa;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

/** Normalises any accepted amount to two decimals, e.g. "5" -> "5.00". */
export function normaliseAmount(value: string): string {
  return fromPaisa(toPaisa(value));
}

/** Display format for PKR, e.g. "PKR 1,234.50". */
export function formatPkr(value: string | { toString(): string }): string {
  const paisa = toPaisa(value.toString());
  const sign = paisa < 0n ? "-" : "";
  const [whole, fraction] = fromPaisa(paisa < 0n ? -paisa : paisa).split(".");
  return `${sign}PKR ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
