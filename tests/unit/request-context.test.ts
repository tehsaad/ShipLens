import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIpFrom, requestContextFrom, requestIdFrom } from "@/lib/request-context";

afterEach(() => vi.restoreAllMocks());

describe("request context", () => {
  it("takes the client IP from the first forwarded entry when no header is trusted", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
    expect(clientIpFrom(new Headers({ "x-real-ip": "203.0.113.6" }))).toBe("203.0.113.6");
    expect(clientIpFrom(new Headers())).toBeNull();
    // Only IP addresses are kept; anything else falls through.
    expect(
      clientIpFrom(new Headers({ "x-forwarded-for": "unknown", "x-real-ip": "2001:db8::1" })),
    ).toBe("2001:db8::1");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });

  it("reads only the trusted header when one is configured", () => {
    const spoofed = {
      "x-forwarded-for": "203.0.113.77, 198.51.100.4",
      "x-real-ip": "203.0.113.78",
    };
    expect(
      clientIpFrom(
        new Headers({ ...spoofed, "cf-connecting-ip": "198.51.100.4" }),
        "cf-connecting-ip",
      ),
    ).toBe("198.51.100.4");
    // Without the trusted header the address is unknown, never the client-supplied one.
    expect(clientIpFrom(new Headers(spoofed), "cf-connecting-ip")).toBeNull();
    expect(
      clientIpFrom(new Headers({ "cf-connecting-ip": "not-an-ip" }), "cf-connecting-ip"),
    ).toBeNull();
  });

  it("logs once which forwarding headers arrive, by name only", () => {
    (globalThis as { hamqadamForwardingLogged?: boolean }).hamqadamForwardingLogged = false;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const source = new Headers({
      "x-forwarded-for": "203.0.113.77, 198.51.100.4, 10.0.0.2",
      "cf-connecting-ip": "198.51.100.4",
    });
    requestContextFrom(source);
    requestContextFrom(source);
    expect(log).toHaveBeenCalledOnce();
    const line = log.mock.calls[0]![0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: "clientIp.headers",
      present: "cf-connecting-ip x-forwarded-for",
      forwardedEntries: 3,
    });
    expect(line).not.toContain("198.51.100.4");
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
