/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint runs during builds — only errors (not warnings) will fail the build.
    // Run `npx next lint` locally to see all warnings.
    ignoreDuringBuilds: false,
  },
  // Enable the instrumentation hook (instrumentation.ts) for startup env validation.
  // https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
  experimental: {
    instrumentationHook: true,
    missingSuspenseWithCSRBailout: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  allowedDevOrigins: ['*.localhost', 'localhost', '*.localhost:3000'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Force HTTPS (only effective in production)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
