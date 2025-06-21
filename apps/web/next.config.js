/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  transpilePackages: ['@colloquium/types', '@colloquium/ui', '@colloquium/auth'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000',
  },
  // Temporarily disable React Strict Mode for debugging SSE
  reactStrictMode: false,
};

module.exports = nextConfig;