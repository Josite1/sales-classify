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
  // 禁用 COZE 遥测上报
  env: {
    COZE_INTEGRATION_BASE_URL: '',
    COZE_WORKLOAD_IDENTITY_API_KEY: '',
  },
};

export default nextConfig;