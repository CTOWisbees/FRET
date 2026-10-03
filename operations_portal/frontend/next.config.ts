import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'three', 'clsx', 'tailwind-merge'],
  },
};

export default nextConfig;
