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
      'lucide-react','recharts','echarts','echarts-for-react','echarts-china-map',
    ],
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