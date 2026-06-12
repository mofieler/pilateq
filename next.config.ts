import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'postgres'],
  output: 'standalone',
  turbopack: {
    // Force Turbopack to treat the project root as the root directory.
    // This prevents Next.js from incorrectly inferring `website/` as the workspace root.
    root: process.cwd(),
  },
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
      },
      ...(process.env.TENANT_IMAGE_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean).map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })) ?? []),
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.bunny.net',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  // Standalone build: ensure public assets are served correctly
  assetPrefix: process.env.ASSET_PREFIX || '',
  // Ensure production builds are optimized
  reactStrictMode: true,
  poweredByHeader: false,
  // Add headers for static assets
  headers: async () => {
    return [
      {
        source: '/logo.(png|jpg|jpeg|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

// Sentry build-time configuration.
// Next.js 16 defaults to Turbopack; runtime error capture is handled via
// OpenTelemetry instrumentation in src/instrumentation.ts. The webpack plugin
// below is only active when SENTRY_AUTH_TOKEN is set and handles source-map
// upload / release association. Without an auth token the app falls back to
// instrumentation-only mode so local / preview builds are not blocked.
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
