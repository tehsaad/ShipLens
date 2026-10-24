import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

const byKey = (isDev: boolean) =>
  Object.fromEntries(securityHeaders({ isDev }).map((header) => [header.key, header.value]));

describe("security headers (section 8, A05)", () => {
  it("sends the required headers in production", () => {
    const headers = byKey(false);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}; includeSubDomains$/);
    expect(headers["Content-Security-Policy"]).toBe(contentSecurityPolicy(false));
  });

  it("forbids framing, plugins, foreign origins and eval in production", () => {
    const policy = contentSecurityPolicy(false);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/https?:|\*/);
  });

  it("allows eval and skips HSTS only in development", () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(byKey(true)["Strict-Transport-Security"]).toBeUndefined();
  });
});
