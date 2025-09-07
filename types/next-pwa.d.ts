declare module "next-pwa" {
  import type { NextConfig } from "next";
  type PWAOptions = {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    buildExcludes?: (string | RegExp)[];
    [key: string]: unknown;
  };
  export default function withPWA(options?: PWAOptions): (nextConfig?: NextConfig) => NextConfig;
}


