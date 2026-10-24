import { describe, expect, it } from "vitest";
import { clientIpFrom, requestContextFrom, requestIdFrom } from "@/lib/request-context";

describe("request context", () => {
  it("takes the client IP from the first forwarded entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
    expect(clientIpFrom(new Headers({ "x-real-ip": "203.0.113.6" }))).toBe("203.0.113.6");
    expect(clientIpFrom(new Headers())).toBeNull();
  });

  it("keeps a well-formed upstream request ID and replaces anything else", () => {
    expect(requestIdFrom(new Headers({ "x-request-id": "abc123-def456" }))).toBe("abc123-def456");
    expect(requestIdFrom(new Headers({ "rndr-id": "7d1e0b2c-6c7e-4c" }))).toBe("7d1e0b2c-6c7e-4c");
    const injected = requestIdFrom(new Headers({ "x-request-id": 'x" {"level":"info"}' }));
    expect(injected).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom(new Headers())).not.toBe(requestIdFrom(new Headers()));
  });

  it("caps the user agent length", () => {
    const context = requestContextFrom(new Headers({ "user-agent": "x".repeat(2_000) }));
    expect(context.userAgent).toHaveLength(512);
  });
});
