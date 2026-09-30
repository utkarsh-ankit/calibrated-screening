import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile in a parent folder doesn't confuse Turbopack.
  turbopack: { root: __dirname },
};

export default nextConfig;
