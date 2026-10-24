import type { Instrumentation } from "next";
import { logEvent, upstreamRequestId } from "./lib/log";

/** Runs once while the server starts. Node.js-only work lives in instrumentation-node.ts. */
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./instrumentation-node");
  }
}

/**
 * One structured line for every server error (section 8, A09). It carries the request ID,
 * the route and the error's digest (the reference users see on the error page) and type, but
 * not the message, stack, query string or headers, which can hold personal data or
 * connection details. Users are never shown more than the generic error page.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const detail = typeof error === "object" && error !== null ? error : {};
  logEvent("error", "request.failed", {
    requestId: upstreamRequestId(header),
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    digest: "digest" in detail ? String(detail.digest) : undefined,
    errorType: error instanceof Error ? error.name : typeof error,
    code: "code" in detail && typeof detail.code === "string" ? detail.code : undefined,
  });
};
