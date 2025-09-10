import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbotrace: { logLevel: 'error' }
  }
};

export default nextConfig;
