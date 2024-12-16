import withBundleAnalyzerImport from "@next/bundle-analyzer";
import { withSentryConfig as withSentryConfigImport } from "@sentry/nextjs";
import million from "million/compiler";
import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import "@/env";

type Plugin = (config: NextConfig) => NextConfig;

const withBundleAnalyzer = withBundleAnalyzerImport({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
];

const nextConfig: NextConfig = {
  output: !process.env.VERCEL ? "standalone" : undefined,
  reactStrictMode: true,
  transpilePackages: ["@chia/*"],
  experimental: {
    optimizePackageImports: ["@nextui-org/react", "@react-email/components"],
    reactCompiler: true,
    webpackBuildWorker: true,
    // dynamicIO: true,
    // ppr: true,
    authInterrupts: true,
  },
  serverExternalPackages: ["@chia/db", "@chia/auth"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pliosymjzzmsswrxbkih.supabase.co",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "opengraph.githubassets.com",
      },
      {
        protocol: "https",
        hostname: "repository-images.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config) => {
    config.externals.push({
      "node:crypto": "commonjs crypto",
    });
    return config;
  },
  rewrites: async () => [
    {
      source: "/sitemap-:id.xml",
      destination: "/sitemap.xml/:id",
    },
  ],
};

const plugins: Plugin[] = [withBundleAnalyzer];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

export default million.next(
  // @ts-ignore
  withSentryConfigImport(withNextIntl(nextComposePlugins), {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    hideSourceMaps: true,
    disableLogger: true,
  }),
  {
    rsc: true,
  }
);
