import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/employee/:id/avatar',
        destination: 'http://127.0.0.1:8000/employee/:id/avatar',
      },
    ];
  },
};

export default nextConfig;
