import "server-only";
import { headers } from "next/headers";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

const MAX_USER_AGENT_LENGTH = 512;

/**
 * Client details recorded in the audit log. X-Forwarded-For is trusted because the app runs
 * behind a reverse proxy in production (Render); it is used for auditing only, never for
 * authorization.
 */
export function requestContextFrom(source: Headers): RequestContext {
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || source.get("x-real-ip")?.trim() || null;
  const userAgent = source.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;
  return { ipAddress, userAgent };
}

export async function getRequestContext(): Promise<RequestContext> {
  return requestContextFrom(await headers());
}
