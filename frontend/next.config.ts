import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/employee/:id/avatar',
        destination: `${backendUrl}/employee/:id/avatar`,
      },
      {
        source: '/generate-offer-letter',
        destination: `${backendUrl}/generate-offer-letter`,
      },
      {
        source: '/send-email',
        destination: `${backendUrl}/send-email`,
      },
    ];
  },
};

export default nextConfig;
