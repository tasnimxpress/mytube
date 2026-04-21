const crypto = require('crypto')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-inline is still required by Next.js App Router (inline
              // style/script tags injected by the framework at build time).
              // To remove it fully you would need to adopt a nonce-based CSP
              // with a custom middleware, which is a larger refactor. This is
              // the same posture as before — noted as a known limitation.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://i.ytimg.com https://*.googleusercontent.com",
              // blob: removed from frame-src — PDFs now use sandbox without allow-same-origin
              "frame-src https://www.youtube.com",
              "connect-src 'self' https://*.supabase.co https://www.googleapis.com https://api.supadata.ai",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
