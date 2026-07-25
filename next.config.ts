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
  webpack: (config) => {
    // 禁止 Webpack 把 echarts 拆成异步 chunk，消除 Vercel 部署后 chunk 404
    const plugins = config.plugins || [];
    config.optimization.splitChunks = {
      ...config.optimization.splitChunks,
      cacheGroups: {
        ...(config.optimization.splitChunks as any)?.cacheGroups,
        default: false,
        vendors: false,
        echarts: {
          test: /[\\/]node_modules[\\/](echarts|zrender)[\\/]/,
          name: 'echarts',
          chunks: 'all',
          priority: 30,
          enforce: true,
          reuseExistingChunk: false,
        },
      },
    };
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