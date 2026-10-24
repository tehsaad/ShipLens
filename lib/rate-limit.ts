/**
 * In-process rate limiting (section 8): fixed windows counted per client IP.
 *
 * The counters live in this server process, so they hold for a single instance only; with
 * several instances each would count separately (documented in docs/handover.md). They are
 * kept on globalThis so every route bundle in the process shares one store.
 */

export type RateLimitRule = { limit: number; windowMs: number };

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /**
   * Failed staff sign-ins, on top of the per-account lockout (5 failures, 15 minutes).
   * Successful sign-ins do not count, so staff switching accounts are never held up.
   */
  login: { limit: 10, windowMs: 15 * MINUTE },
  /** Volunteer applications: 5 per hour per IP (section 7.1). */
  application: { limit: 5, windowMs: 60 * MINUTE },
  /** Contact messages: the same limit as applications. */
  contact: { limit: 5, windowMs: 60 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

/** Clients can choose their keys (any IP header), so the store is capped. */
export const MAX_TRACKED_KEYS = 10_000;

type Window = { count: number; resetAt: number };

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly maxKeys = MAX_TRACKED_KEYS) {}

  get size(): number {
    return this.windows.size;
  }

  /** Whether the key's window is full, without counting an attempt. */
  peek(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    const current = this.windows.get(key);
    if (current && current.resetAt > now && current.count >= rule.limit) {
      return { ok: false, retryAfterMs: current.resetAt - now };
    }
    return { ok: true, retryAfterMs: 0 };
  }

  /** Counts one attempt for the key, unless its window is already full. */
  consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    const current = this.windows.get(key);
    if (current && current.resetAt > now) {
      if (current.count >= rule.limit) return { ok: false, retryAfterMs: current.resetAt - now };
      current.count += 1;
      return { ok: true, retryAfterMs: 0 };
    }
    this.windows.delete(key);
    if (this.windows.size >= this.maxKeys) this.sweep(now);
    // Still full of live windows: drop the oldest (a Map iterates in insertion order).
    if (this.windows.size >= this.maxKeys) {
      this.windows.delete(this.windows.keys().next().value!);
    }
    this.windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  /** Removes expired windows. */
  sweep(now = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

const store = globalThis as typeof globalThis & { shiplensRateLimiter?: RateLimiter };

function limiter(): RateLimiter {
  store.shiplensRateLimiter ??= new RateLimiter();
  return store.shiplensRateLimiter;
}

/** Clients without an IP share one key. */
const keyFor = (bucket: RateLimitBucket, ipAddress: string | null) =>
  `${bucket}:${ipAddress ?? "unknown"}`;

/** Counts one attempt for the client in the bucket. */
export function checkRateLimit(
  bucket: RateLimitBucket,
  ipAddress: string | null,
  now?: number,
): RateLimitResult {
  return limiter().consume(keyFor(bucket, ipAddress), RATE_LIMITS[bucket], now);
}

/**
 * Runs an attempt unless the client's failures already fill the bucket's window. Only failed
 * attempts (a null result) are counted; `limited` is true when the attempt was not run.
 */
export async function limitFailures<T>(
  bucket: RateLimitBucket,
  ipAddress: string | null,
  attempt: () => Promise<T | null>,
  now: () => number = Date.now,
): Promise<{ result: T | null; limited: boolean }> {
  const key = keyFor(bucket, ipAddress);
  if (!limiter().peek(key, RATE_LIMITS[bucket], now()).ok) return { result: null, limited: true };
  const result = await attempt();
  if (result === null) limiter().consume(key, RATE_LIMITS[bucket], now());
  return { result, limited: false };
}
