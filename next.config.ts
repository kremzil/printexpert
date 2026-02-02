import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "printexpert.sk",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
