/** @type {import('next').NextConfig} */
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

const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    appDir: true,
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
    domains: ["firebasestorage.googleapis.com"],
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

module.exports = nextConfig;
