import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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
};

export default withNextIntl(nextConfig);
