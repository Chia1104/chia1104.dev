// @ts-check
import withBundleAnalyzerImport from "@next/bundle-analyzer";
// import withMDXImport from "@next/mdx";
// import remarkGfm from "remark-gfm";
// import rehypeSlug from "rehype-slug";
// import rehypePrism from "rehype-prism-plus";
// import rehypeAutolinkHeadings from "rehype-autolink-headings";
// import rehypeHighlight from "rehype-highlight";
// import rehypeCodeTitles from "rehype-code-titles";

const withBundleAnalyzer = withBundleAnalyzerImport({
  enabled: process.env.ANALYZE === "true",
});

// const withMDX = withMDXImport({
//   options: {
//     remarkPlugins: [[remarkGfm, { singleTilde: false }]],
//     rehypePlugins: [
//       [rehypeSlug],
//       [rehypePrism, { ignoreMissing: true }],
//       [
//         rehypeAutolinkHeadings,
//         {
//           properties: { className: ["anchor"] },
//         },
//         { behaviour: "wrap" },
//       ],
//       rehypeHighlight,
//       rehypeCodeTitles,
//     ],
//   },
// });

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
  // pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  output: "standalone",
  experimental: {
    appDir: true,
    mdxRs: true,
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

const plugins = [withBundleAnalyzer];

const nextComposePlugins = plugins.reduce(
  (acc, plugin) => plugin(acc),
  nextConfig
);

export default nextComposePlugins;
