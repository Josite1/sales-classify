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
    optimizePackageImports: [
      'lucide-react','recharts',
    ],
  },
  webpack: (config) => ({
    ...config,
    optimization: {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks as any)?.cacheGroups,
          echarts: {
            test: /[\\/]node_modules[\\/]echarts[\\/]/,
            name: 'echarts',
            chunks: 'all',
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      },
    },
  }),
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