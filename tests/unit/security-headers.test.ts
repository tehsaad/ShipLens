import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_CSP_SOURCE,
  adminContentSecurityPolicy,
  contentSecurityPolicy,
  createNonce,
  securityHeaders,
} from "@/lib/security-headers";

const byKey = (isDev: boolean) =>
  Object.fromEntries(securityHeaders({ isDev }).map((header) => [header.key, header.value]));

describe("security headers (section 8, A05)", () => {
  it("sends the required headers in production", () => {
    const headers = byKey(false);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}; includeSubDomains$/);
  });

  it("skips HSTS in development", () => {
    expect(byKey(true)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("forbids framing, plugins, foreign origins and eval in both production policies", () => {
    for (const policy of [contentSecurityPolicy(false), adminContentSecurityPolicy("abc", false)]) {
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("base-uri 'self'");
      expect(policy).toContain("form-action 'self'");
      expect(policy).not.toContain("unsafe-eval");
      expect(policy).not.toMatch(/https?:|\*/);
    }
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });

  it("lets admin scripts run only with the response's nonce", () => {
    const policy = adminContentSecurityPolicy("n0nce", false);
    const scripts = policy.split("; ").find((directive) => directive.startsWith("script-src"));
    expect(scripts).toBe("script-src 'self' 'nonce-n0nce' 'strict-dynamic'");
    // A nonce in style-src would make browsers ignore 'unsafe-inline' and break chart styles.
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("creates a fresh 128-bit nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });

  it("applies the public policy everywhere except /admin", () => {
    const matches = pathToRegexp(PUBLIC_CSP_SOURCE, [], {});
    for (const path of ["/", "/en", "/ur/events", "/administrator", "/api/health"]) {
      expect(matches.test(path), path).toBe(true);
    }
    for (const path of ["/admin", "/admin/", "/admin/login", "/admin/reports/1"]) {
      expect(matches.test(path), path).toBe(false);
    }
  });
});
