import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR /dev assets when opening the app via 127.0.0.1 (not only localhost).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
