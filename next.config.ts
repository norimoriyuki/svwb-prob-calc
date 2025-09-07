import type { NextConfig } from "next";
import withPWA from "next-pwa";

const withPWAMiddleware = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* other config options */
};

export default withPWAMiddleware(nextConfig);
