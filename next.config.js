/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: false,
      },
    ]
  },
  experimental: {
    outputStandalone: true,
  },
  images: {
    domains: ['firebasestorage.googleapis.com'],
  }
}

module.exports = nextConfig
