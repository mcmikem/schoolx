const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

if (
  process.env.VERCEL === "1" &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true" &&
  process.env.ALLOW_DEMO_IN_PRODUCTION !== "true"
) {
  throw new Error(
    "NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES is enabled in a production build. " +
      "Demo/test routes must be disabled in production. Set ALLOW_DEMO_IN_PRODUCTION=true only for staging builds.",
  );
}

const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (config) => config;

/** @type {import('next').NextConfig} */
function supabaseImageHosts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const protocol = parsed.protocol.replace(":", "");
    if (!host) return [];
    return [
      {
        protocol,
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
  turbopack: process.env.NEXT_DISABLE_TURBOPACK === "1" ? false : {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
    viewTransition: true,
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

module.exports = withBundleAnalyzer(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  telemetry: false,
  sourcemaps: {
    disable: false,
  },
}));
