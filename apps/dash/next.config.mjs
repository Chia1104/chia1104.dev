/**
 * @typedef {import('next').NextConfig} NextConfig
 * @typedef {(config: NextConfig) => NextConfig} Plugin
 */

import million from "million/compiler";
// import MillionCompiler from "@million/lint";

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
  swcMinify: true,
  transpilePackages: [
    "@chia/api",
    "@chia/auth",
    "@chia/db",
    "@chia/editor",
    "@chia/mdx",
    "@chia/ui",
    "@chia/utils",
  ],
  experimental: {
    optimizePackageImports: ["@nextui-org/react"],
    serverComponentsExternalPackages: [],
    webpackBuildWorker: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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

/** @type {Plugin[]} */
const plugins = [];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

// @ts-expect-error
export default million.next(nextComposePlugins, {
  rsc: true,
});
