/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
  // Disable features that don't work with static export
  trailingSlash: true,
  // Environment variables for mobile
  env: {
    NEXT_PUBLIC_IS_MOBILE: 'true',
  },
};

module.exports = nextConfig;
