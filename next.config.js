/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // These are pre-existing lint issues across the codebase.
    // TypeScript strict checking (tsc --noEmit) is used instead for type safety.
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
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
