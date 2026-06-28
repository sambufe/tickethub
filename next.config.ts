import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'playwright', '@sparticuz/chromium'],
};

export default nextConfig;
