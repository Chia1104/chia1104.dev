/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/home',
  //       permanent: false,
  //     },
  //   ]
  // },
  experimental: {
    output: 'standalone',
    runtime: 'experimental-edge'
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
  }
}

module.exports = nextConfig
