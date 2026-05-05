import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SEC-008 / PEN-007: Hide technology stack from response headers
  poweredByHeader: false,
  serverExternalPackages: ["docusign-esign"],
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — allow same-origin iframes (for legal document drawer)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME-type sniffing attacks
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer data leakage
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable unnecessary browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Force HTTPS for 1 year (Vercel already does this, but explicit is better)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy — XSS protection
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://*.sentry.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.vercel-storage.com https://*.clerk.com https://img.clerk.com",
              "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://*.sentry.io https://*.livekit.cloud wss://*.livekit.cloud https://api.assemblyai.com https://generativelanguage.googleapis.com https://api.deepseek.com https://tavusapi.com https://emkc.org",
              "media-src 'self' blob: https://*.vercel-storage.com https://*.livekit.cloud",
              "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
      {
        // Allow camera + microphone ONLY on interview pages
        source: "/candidate/interviews/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG || "iqmela",
  project: process.env.SENTRY_PROJECT || "iqmela-v2",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",
});
