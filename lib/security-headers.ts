/**
 * HTTP security headers (section 8, A05).
 *
 * Two content security policies:
 * - The public site is statically generated with revalidation (section 9), so its pages cannot
 *   carry a per-request nonce; its policy, set in next.config.ts, allows inline scripts for the
 *   Next.js runtime and the theme script. Nothing on the public site renders user-supplied
 *   HTML: React escapes all text and Markdown is sanitised with an allow-list.
 * - The admin area renders on every request, so proxy.ts gives each response a fresh nonce and
 *   only scripts carrying it (and the chunks they load) run.
 */

type Header = { key: string; value: string };

type Directives = Record<string, string[]>;

export function serializeCsp(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources].join(" "))
    .join("; ");
}

/** React needs eval in development only, to rebuild server error stacks in the browser. */
const devEval = (isDev: boolean) => (isDev ? ["'unsafe-eval'"] : []);

/** Directives shared by both policies: same-origin only, no plugins, no framing. */
function baseDirectives(isDev: boolean): Directives {
  return {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...devEval(isDev)],
    // Inline style attributes (charts, next/font) cannot carry a nonce, and a nonce in this
    // directive would make browsers ignore 'unsafe-inline'.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
}

/** The public site's policy. */
export function contentSecurityPolicy(isDev: boolean): string {
  return serializeCsp(baseDirectives(isDev));
}

/** The admin area's policy: scripts run only with this response's nonce. */
export function adminContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return serializeCsp({
    ...baseDirectives(isDev),
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...devEval(isDev)],
  });
}

/** 128 random bits, base64-encoded. Uses Web Crypto, which the proxy runtime provides. */
export function createNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * next.config.ts `headers()` source for the public policy: every path except /admin and its
 * subpaths, which get the nonce policy from the proxy instead.
 */
export const PUBLIC_CSP_SOURCE = "/:path((?!admin(?:/|$)).*)";

/** Two years, the commonly recommended HSTS lifetime. Sent only by production builds. */
const HSTS_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;

/** Headers for every response, public or admin. */
export function securityHeaders({ isDev }: { isDev: boolean }): Header[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Legacy counterpart of frame-ancestors 'none' for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(isDev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
          },
        ]),
  ];
}
