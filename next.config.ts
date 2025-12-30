import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Serve static files from uploads directory
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
