import "server-only";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { logEvent, upstreamRequestId } from "@/lib/log";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  /** Correlates log lines of one request (section 8, A09); not stored in the audit log. */
  requestId?: string;
};

const MAX_USER_AGENT_LENGTH = 512;

/** The first entry of a header value, when it is an IP address. */
function ipFrom(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first && isIP(first) ? first : null;
}

/**
 * The client's IP address, for the audit log and rate limiting (never for authorization).
 *
 * Behind a proxy that keeps a client-supplied X-Forwarded-For and appends to it, as Render
 * does, the first entry is whatever the client sent. TRUSTED_CLIENT_IP_HEADER names the one
 * header the proxy sets itself (on Render, Cloudflare's CF-Connecting-IP); when it is set,
 * only that header is read, and a request without it has no known address. Without the
 * setting (local development, Docker Compose) the first X-Forwarded-For entry is used.
 */
export function clientIpFrom(
  source: Headers,
  trustedHeader = process.env["TRUSTED_CLIENT_IP_HEADER"],
): string | null {
  if (trustedHeader) return ipFrom(source.get(trustedHeader));
  return ipFrom(source.get("x-forwarded-for")) ?? ipFrom(source.get("x-real-ip"));
}

/** Headers that carry a client address on common proxies. */
const FORWARDING_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "forwarded",
  "x-client-ip",
];

const process_ = globalThis as typeof globalThis & { shiplensForwardingLogged?: boolean };

/**
 * Logs once per server start which forwarding headers requests arrive with, and how many
 * X-Forwarded-For entries: names and counts only, never values. It shows which header the
 * hosting proxy sets, to choose TRUSTED_CLIENT_IP_HEADER.
 */
function logForwardingHeaders(source: Headers): void {
  if (process_.shiplensForwardingLogged) return;
  process_.shiplensForwardingLogged = true;
  logEvent("info", "clientIp.headers", {
    present: FORWARDING_HEADERS.filter((name) => source.has(name)).join(" "),
    forwardedEntries: source.get("x-forwarded-for")?.split(",").length ?? 0,
    trustedHeader: process.env["TRUSTED_CLIENT_IP_HEADER"] ?? null,
  });
}

/** The upstream request ID (X-Request-Id, or Render's Rndr-Id) when valid, else a new one. */
export function requestIdFrom(source: Headers): string {
  return upstreamRequestId((name) => source.get(name)) ?? randomUUID();
}

/** Client details for the audit log and logs. */
export function requestContextFrom(source: Headers): RequestContext {
  logForwardingHeaders(source);
  return {
    ipAddress: clientIpFrom(source),
    userAgent: source.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    requestId: requestIdFrom(source),
  };
}

export async function getRequestContext(): Promise<RequestContext> {
  return requestContextFrom(await headers());
}
