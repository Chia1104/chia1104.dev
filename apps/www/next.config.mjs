/**
 * @typedef {import('next').NextConfig} NextConfig
 * @typedef {(config: NextConfig) => NextConfig} Plugin
 */
import withBundleAnalyzerImport from "@next/bundle-analyzer";
import { withSentryConfig as withSentryConfigImport } from "@sentry/nextjs";
import createMDX from "fumadocs-mdx/config";
import million from "million/compiler";

const withMDX = createMDX();

const withBundleAnalyzer = withBundleAnalyzerImport({
  enabled: process.env.ANALYZE === "true",
});

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

/** @type {NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@chia/api",
    "@chia/auth",
    "@chia/cache",
    "@chia/db",
    "@chia/editor",
    "@chia/meta",
    "@chia/ui",
    "@chia/utils",
  ],
  experimental: {
    optimizePackageImports: ["@nextui-org/react", "@react-email/components"],
    serverComponentsExternalPackages: [],
    typedRoutes: false,
    webpackBuildWorker: true,
    instrumentationHook: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/portfolio",
        destination: "/projects",
        permanent: false,
      },
      {
        source: "/post",
        destination: "/posts",
        permanent: false,
      },
      {
        source: "/post/:id",
        destination: "/posts/:id",
        permanent: false,
      },
      {
        source: "/posts/:slug/amp.html",
        destination: "/posts/:slug/",
        statusCode: 301,
      },
    ];
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
};

/** @type {Plugin[]} */
const plugins = [withBundleAnalyzer];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

export default million.next(
  // @ts-ignore
  withMDX(
    withSentryConfigImport(nextComposePlugins, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      hideSourceMaps: true,
    })
  ),
  {
    rsc: true,
  }
);
