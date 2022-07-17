/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];

const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  trailingSlash: true,
  output: 'standalone',
  experimental: {
    // swcPlugins: [
    //   ['plugin', {
    //
    //   }]
    // ]
  },
  async redirects() {
    return [
      {
        source: '/portfolios',
        destination: '/portfolio',
        permanent: false
      },
      {
        source: '/post',
        destination: '/posts',
        permanent: false
      },
      {
        source: '/post/:id',
        destination: '/posts/:id',
        permanent: false
      }
    ]
  },
  compiler: {
    removeConsole: true
  },
  images: {
    domains: ['firebasestorage.googleapis.com']
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react/jsx-runtime.js': require.resolve('react/jsx-runtime')
    }

    config.resolve = {
      ...config.resolve,

      fallback: {
        ...config.resolve.fallback,
        child_process: false,
        fs: false
      }
    }

    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  }
}

module.exports = nextConfig
