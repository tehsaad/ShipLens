import "server-only";
import { logEvent } from "@/lib/log";
import { checkRateLimit, type RateLimitBucket } from "@/lib/rate-limit";
import type { RequestContext } from "@/lib/request-context";

/**
 * Counts a public form submission against the client's limit; true when it is over it.
 * Called after validation, so correcting field errors does not use up the allowance.
 */
export function rateLimitedForm(
  bucket: Extract<RateLimitBucket, "application" | "contact">,
  context: RequestContext,
): boolean {
  if (checkRateLimit(bucket, context.ipAddress).ok) return false;
  logEvent("warn", "rateLimit.exceeded", {
    bucket,
    ip: context.ipAddress,
    requestId: context.requestId,
  });
  return true;
}
