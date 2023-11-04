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
  transpilePackages: ["@chia/ui"],
  swcMinify: true,
  experimental: {
    mdxRs: true,
    typedRoutes: false,
    serverComponentsExternalPackages: ["@chia/ui"],
    webpackBuildWorker: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/portfolios",
        destination: "/portfolio",
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
