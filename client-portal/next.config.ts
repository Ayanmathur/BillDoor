import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // SECURITY: Never ship source maps to production
  productionBrowserSourceMaps: false,

  // Disable x-powered-by header (unnecessary exposure)
  poweredByHeader: false,

  // Allow up to 10MB for menu photo uploads via Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
