import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Prevents double-mounting canvas game loop in dev mode
};

export default nextConfig;
