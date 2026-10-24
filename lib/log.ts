/**
 * Structured logs (section 8, A09): one JSON object per line, with the request ID when there
 * is one. Callers pass identifiers and counts only, never passwords, tokens, form contents
 * or raw error messages (a database error message can include connection details).
 */

export type LogLevel = "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
