import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [],
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "export" : undefined,
  async headers() {

    // Skip headers in static export mode (GitHub Pages)
    if (process.env.NEXT_BUILD_STANDALONE === "true") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",

            value: [
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagservices.com https://adservice.google.com https://www.googletagmanager.com https://*.adtrafficquality.google https://quge5.com https://nap5k.com https://*.profitableratecpm.com https://*.highperformanceformat.com https://*.onclckmn.com",
              "script-src-elem 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagservices.com https://adservice.google.com https://www.googletagmanager.com https://*.adtrafficquality.google https://quge5.com https://nap5k.com https://*.profitableratecpm.com https://*.highperformanceformat.com https://*.onclckmn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",

              "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://*.profitableratecpm.com https://*.highperformanceformat.com https://*.onclckmn.com",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
