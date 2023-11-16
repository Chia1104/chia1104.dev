// @ts-check
import withBundleAnalyzerImport from "@next/bundle-analyzer";
import "./src/env.mjs";

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@chia/ui",
    "@chia/tailwind-config",
    "@chia/utils",
    "@chia/db",
    "@chia/meta",
  ],
  swcMinify: true,
  experimental: {
    mdxRs: true,
    typedRoutes: false,
    serverComponentsExternalPackages: [
      "@chia/ui",
      "@chia/tailwind-config",
      "@chia/utils",
      "@chia/meta",
    ],
    webpackBuildWorker: true,
    // ppr: true,
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
  compiler: {
    removeConsole: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
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
};

const plugins = [withBundleAnalyzer];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

export default nextComposePlugins;
