import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',      // instructor dashboard — private
          '/admin/',          // admin panel — private
          '/client-dashboard/', // client portal — private
          '/api/',            // API routes — not for crawling
          '/login',
          '/register',
          '/set-password',
          '/reset-password',
          '/forgot-password',
          '/setup/',
          '/staff/',
          '/payment/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
