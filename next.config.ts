import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile in a parent folder doesn't confuse Turbopack.
  turbopack: { root: __dirname },
  // Ship the saved Jev results with the server as a fallback if GitHub is unreachable.
  outputFileTracingIncludes: { "/api/promptql-results": ["./promptql/results.json"] },
};

export default nextConfig;
