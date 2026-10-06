import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  // The showpiece used to live at /brocksbushes; it's the whole site now.
  async redirects() {
    return [{ source: '/brocksbushes', destination: '/', permanent: true }];
  },
};

export default nextConfig;
