import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }], afterFiles: [], fallback: [] };
  },
  distDir: process.env.REGISTRATION_BUILD_DIR || ".next",
};
export default nextConfig;
