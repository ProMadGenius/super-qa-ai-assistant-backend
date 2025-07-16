/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['ai']
  },
  // Enable standalone build for PM2 deployment
  output: 'standalone'
}

module.exports = nextConfig