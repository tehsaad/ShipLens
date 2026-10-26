import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PUBLIC_CSP_SOURCE, contentSecurityPolicy, securityHeaders } from "./lib/security-headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // forbidden() in next/navigation: pages a role may not open respond 403 (section 4).
    authInterrupts: true,
    // The public site and the admin area have separate root layouts, so unmatched URLs use
    // app/global-not-found.tsx.
    globalNotFound: true,
  },
  // Section 8, A05: on every response, including static files and API routes. /admin gets a
  // nonce-based policy from proxy.ts instead of the public one.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders({ isDev }) },
      {
        source: PUBLIC_CSP_SOURCE,
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) }],
      },
      // Never indexed. Admin pages also carry a robots meta tag; API responses are not HTML,
      // so the header is the only way to say it for them.
      ...["/admin", "/admin/:path*", "/api/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default withNextIntl(nextConfig);
