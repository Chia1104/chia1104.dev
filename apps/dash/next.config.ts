import million from "million/compiler";
import { NextConfig } from "next";

import "@/env";

type Plugin = (config: NextConfig) => NextConfig;

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
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@chia/ai",
    "@chia/api",
    "@chia/auth",
    "@chia/auth-core",
    "@chia/db",
    "@chia/contents",
    "@chia/ui",
    "@chia/utils",
  ],
  experimental: {
    optimizePackageImports: ["@nextui-org/react"],
    webpackBuildWorker: true,
    reactCompiler: true,
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
  webpack: (config) => {
    config.externals.push({
      "node:crypto": "commonjs crypto",
    });
    return config;
  },
};

const plugins: Plugin[] = [];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

// @ts-expect-error
export default million.next(nextComposePlugins, {
  rsc: true,
});
