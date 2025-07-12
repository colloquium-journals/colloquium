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
  
  webpack: (config, { isServer }) => {
    // Ignore HTML files in node_modules
    config.module.rules.push({
      test: /\.html$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    });

    // Exclude problematic modules from client bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@mapbox/node-pre-gyp': false,
      };
      
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;