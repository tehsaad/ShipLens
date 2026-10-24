/**
 * Date-only helpers. Business dates (collectedOn, weekStart, joinedAt) are calendar dates in
 * Asia/Karachi (section 1). They are represented as Date objects at UTC midnight, which is
 * how Prisma reads and writes PostgreSQL `date` columns.
 */

export const BUSINESS_TIME_ZONE = "Asia/Karachi";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses YYYY-MM-DD into a Date at UTC midnight. */
export function parseDateOnly(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new Error(`Invalid calendar date "${value}"`);
  }
  return date;
}

/** Formats a date-only value as YYYY-MM-DD. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Monday of the ISO week containing the date (the WeeklyReport.weekStart convention). */
export function weekStartOf(date: Date): Date {
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDays(date, 1 - isoWeekday);
}

/** Today's calendar date in Asia/Karachi, as a date-only value. */
export function businessToday(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseDateOnly(parts);
}

/** A timestamp's calendar date in Asia/Karachi, as YYYY-MM-DD, for display. */
export function formatBusinessDate(timestamp: Date): string {
  return formatDateOnly(businessToday(timestamp));
}

const BUSINESS_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A timestamp in Asia/Karachi as "YYYY-MM-DD HH:mm", for exports. */
export function formatBusinessDateTime(timestamp: Date): string {
  const part = Object.fromEntries(
    BUSINESS_DATE_TIME.formatToParts(timestamp).map(({ type, value }) => [type, value]),
  );
  return `${part["year"]}-${part["month"]}-${part["day"]} ${part["hour"]}:${part["minute"]}`;
}
