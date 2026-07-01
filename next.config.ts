import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'playwright-core', '@sparticuz/chromium'],
  // Force Vercel's file tracer (NFT) to include all playwright-core files in the
  // tickets function bundle. coreBundle.js requires browsers.json at runtime but
  // NFT can't detect this statically inside playwright's pre-bundled file.
  outputFileTracingIncludes: {
    '/api/tickets/[id]': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
  },
};

export default nextConfig;
