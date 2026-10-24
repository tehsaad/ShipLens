/**
 * HTTP security headers (section 8, A05). next.config.ts applies them to every response.
 *
 * The public site is statically generated with revalidation (section 9), so its pages cannot
 * carry a per-request nonce; its policy allows inline scripts for the Next.js runtime and the
 * theme script. Nothing on the public site renders user-supplied HTML: React escapes all text
 * and Markdown is sanitised with an allow-list.
 */

type Header = { key: string; value: string };

type Directives = Record<string, string[]>;

export function serializeCsp(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources].join(" "))
    .join("; ");
}

/** Directives shared by every policy: same-origin only, no plugins, no framing. */
export function baseDirectives(isDev: boolean): Directives {
  return {
    "default-src": ["'self'"],
    // React needs eval in development only, to rebuild server error stacks in the browser.
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Inline style attributes (charts, next/font) cannot carry a nonce.
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

export function contentSecurityPolicy(isDev: boolean): string {
  return serializeCsp(baseDirectives(isDev));
}

/** Two years, the commonly recommended HSTS lifetime. Sent only by production builds. */
const HSTS_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;

export function securityHeaders({ isDev }: { isDev: boolean }): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
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
