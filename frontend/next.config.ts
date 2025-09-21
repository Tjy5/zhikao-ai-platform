import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // turbotrace has been removed in Next.js 15
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '65123',
        pathname: '/api/v1/questions/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '65124',
        pathname: '/api/v1/questions/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/api/v1/questions/images/**',
      },
    ],
  },
};

export default nextConfig;
