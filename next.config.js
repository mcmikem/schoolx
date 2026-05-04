const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
function supabaseImageHosts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const host = new URL(url).hostname;
    if (!host) return [];
    return [
      {
        protocol: "https",
        hostname: host,
        pathname: "/storage/v1/object/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig = {
  output: process.env.MOBILE_BUILD === "1" ? "export" : process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  trailingSlash: true,
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      ...supabaseImageHosts(),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  telemetry: false,
  sourcemaps: {
    disable: false,
  },
});
