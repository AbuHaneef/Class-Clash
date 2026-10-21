import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["preview-chat-255e0831-cff3-476c-bfe0-02c336ffd7f4.space-z.ai", "*.space-z.ai"],
};

export default nextConfig;
