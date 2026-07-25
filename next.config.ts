import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 完全禁止客户端 chunk 拆分，消除 Vercel 部署后 chunk 404
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        maxInitialRequests: Infinity,
        maxAsyncRequests: Infinity,
        minSize: 100000000, // 100MB — 实际不会拆分任何东西
      };
    }
    return config;
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
    return [
      {
        source: '/api/records/:path*',
        destination: `${backendUrl}/api/records/:path*`,
      },
      {
        source: '/api/aliases/:path*',
        destination: `${backendUrl}/api/aliases/:path*`,
      },
      {
        source: '/api/excel/:path*',
        destination: `${backendUrl}/api/excel/:path*`,
      },
      {
        source: '/api/compute/:path*',
        destination: `${backendUrl}/api/compute/:path*`,
      },
    ];
  },
};

export default nextConfig;