import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/security-headers";

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
  // Section 8, A05: on every response, including static files and API routes.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isDev }) }];
  },
};

export default withNextIntl(nextConfig);
