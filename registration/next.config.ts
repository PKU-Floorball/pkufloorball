import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/registration-visual/interactive-ball.:hash([a-f0-9]{16}).js",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }], afterFiles: [], fallback: [] };
  },
  distDir: process.env.REGISTRATION_BUILD_DIR || ".next",
};
export default nextConfig;
