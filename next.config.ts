import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // forbidden() in next/navigation: pages a role may not open respond 403 (section 4).
    authInterrupts: true,
  },
};

export default nextConfig;
