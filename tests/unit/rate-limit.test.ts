import { describe, expect, it } from "vitest";
import { RATE_LIMITS, RateLimiter, checkRateLimit } from "@/lib/rate-limit";

const rule = { limit: 3, windowMs: 1_000 };

describe("rate limiter (section 8)", () => {
  it("allows the limit within a window, then refuses with the time left", () => {
    const limiter = new RateLimiter();
    expect([0, 100, 200].map((t) => limiter.consume("ip", rule, t).ok)).toEqual([true, true, true]);
    expect(limiter.consume("ip", rule, 300)).toEqual({ ok: false, retryAfterMs: 700 });
    // Refused attempts do not extend the window.
    expect(limiter.consume("ip", rule, 999).ok).toBe(false);
  });

  it("starts a new window once the old one has passed", () => {
    const limiter = new RateLimiter();
    for (const t of [0, 1, 2, 3]) limiter.consume("ip", rule, t);
    expect(limiter.consume("ip", rule, 1_000).ok).toBe(true);
    expect(limiter.consume("ip", rule, 1_001).ok).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 3; i++) limiter.consume("a", rule, 0);
    expect(limiter.consume("a", rule, 0).ok).toBe(false);
    expect(limiter.consume("b", rule, 0).ok).toBe(true);
  });

  it("stays within its key cap, sweeping expired windows first", () => {
    const limiter = new RateLimiter(3);
    limiter.consume("old", rule, 0);
    limiter.consume("b", rule, 500);
    limiter.consume("c", rule, 500);
    // "old" has expired, so the sweep makes room and the live windows survive.
    limiter.consume("d", rule, 1_200);
    expect(limiter.size).toBe(3);
    for (let i = 0; i < 2; i++) limiter.consume("b", rule, 1_300);
    expect(limiter.consume("b", rule, 1_300).ok).toBe(false);
    // With every window live, the oldest one is dropped.
    limiter.consume("e", rule, 1_400);
    expect(limiter.size).toBe(3);
    expect(limiter.consume("b", rule, 1_400).ok).toBe(true);
  });

  it("limits volunteer applications to 5 per hour per IP (section 7.1)", () => {
    expect(RATE_LIMITS.application).toEqual({ limit: 5, windowMs: 60 * 60 * 1000 });
    const ip = `198.51.100.${Date.now() % 250}`;
    const start = 1_000_000;
    const results = Array.from(
      { length: 6 },
      (_, i) => checkRateLimit("application", ip, start + i).ok,
    );
    expect(results).toEqual([true, true, true, true, true, false]);
    // Other buckets and other clients are unaffected.
    expect(checkRateLimit("contact", ip, start).ok).toBe(true);
    expect(checkRateLimit("application", "203.0.113.9", start).ok).toBe(true);
    expect(checkRateLimit("application", ip, start + 60 * 60 * 1000).ok).toBe(true);
  });
});
