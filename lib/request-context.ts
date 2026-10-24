import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  /** Correlates log lines of one request (section 8, A09); not stored in the audit log. */
  requestId?: string;
};

const MAX_USER_AGENT_LENGTH = 512;

/** Request IDs from upstream are echoed into logs, so only plain tokens are accepted. */
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * The client's IP address: the first X-Forwarded-For entry, which the reverse proxy in front
 * of the app (Render) sets to the client it saw. Used for the audit log and rate limiting,
 * never for authorization.
 */
export function clientIpFrom(source: Headers): string | null {
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || source.get("x-real-ip")?.trim() || null;
}

/** The upstream request ID (X-Request-Id, or Render's Rndr-Id) when valid, else a new one. */
export function requestIdFrom(source: Headers): string {
  for (const name of ["x-request-id", "rndr-id"]) {
    const value = source.get(name)?.trim();
    if (value && REQUEST_ID.test(value)) return value;
  }
  return randomUUID();
}

/** Client details for the audit log and logs. */
export function requestContextFrom(source: Headers): RequestContext {
  return {
    ipAddress: clientIpFrom(source),
    userAgent: source.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    requestId: requestIdFrom(source),
  };
}

export async function getRequestContext(): Promise<RequestContext> {
  return requestContextFrom(await headers());
}
