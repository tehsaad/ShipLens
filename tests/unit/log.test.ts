import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";
import { logEvent, upstreamRequestId } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("structured logs (section 8, A09)", () => {
  it("writes one JSON object per line at the right level", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logEvent("warn", "rateLimit.exceeded", { bucket: "login", requestId: "req-12345678" });
    expect(warn).toHaveBeenCalledOnce();
    const line = JSON.parse(warn.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "warn",
      event: "rateLimit.exceeded",
      bucket: "login",
      requestId: "req-12345678",
    });
    expect(Date.parse(line.time)).not.toBeNaN();
  });

  it("accepts only plain upstream request IDs", () => {
    const from = (headers: Record<string, string>) => upstreamRequestId((name) => headers[name]);
    expect(from({ "x-request-id": "abc-123_45.6" })).toBe("abc-123_45.6");
    expect(from({ "rndr-id": "0a1b2c3d4e" })).toBe("0a1b2c3d4e");
    expect(from({ "x-request-id": '","level":"info' })).toBeNull();
    expect(from({ "x-request-id": "short" })).toBeNull();
    expect(from({})).toBeNull();
  });

  it("logs request errors without messages, stacks, queries or headers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(
      new Error("connect to postgresql://app:secret@db.internal failed"),
      { digest: "2891647173", code: "P1001" },
    );
    await onRequestError(
      failure,
      {
        path: "/admin/members?q=Ayesha",
        method: "GET",
        headers: { "x-request-id": "req-abcdef12", cookie: "authjs.session-token=xyz" },
      },
      {
        routerKind: "App Router",
        routePath: "/admin/(console)/members",
        routeType: "render",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      },
    );
    const text = error.mock.calls[0]![0] as string;
    expect(JSON.parse(text)).toMatchObject({
      level: "error",
      event: "request.failed",
      requestId: "req-abcdef12",
      method: "GET",
      path: "/admin/members",
      route: "/admin/(console)/members",
      routeType: "render",
      digest: "2891647173",
      errorType: "Error",
      code: "P1001",
    });
    for (const secret of ["secret", "Ayesha", "session-token", "postgresql"]) {
      expect(text).not.toContain(secret);
    }
  });
});
