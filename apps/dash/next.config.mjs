/**
 * @typedef {import('next').NextConfig} NextConfig
 * @typedef {(config: NextConfig) => NextConfig} Plugin
 */
import createMDX from "fumadocs-mdx/config";
import million from "million/compiler";

const withMDX = createMDX();

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
    "@chia/ai",
    "@chia/api",
    "@chia/auth",
    "@chia/auth-core",
    "@chia/db",
    "@chia/editor",
    "@chia/contents",
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
  webpack: (config) => {
    config.externals.push({
      "node:crypto": "commonjs crypto",
    });
    return config;
  },
};

/** @type {Plugin[]} */
const plugins = [];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

// @ts-expect-error
export default million.next(withMDX(nextComposePlugins), {
  rsc: true,
});
