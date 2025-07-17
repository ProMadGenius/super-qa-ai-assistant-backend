/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ai'],
  // Enable standalone build for PM2 deployment
  output: 'standalone'
}

export default nextConfig