import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // re-generate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Static pages ────────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/book`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/teach-with-drivebook`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]

  // ── Instructor subdomain pages — the highest-value SEO pages ────────────────
  // Each approved instructor gets their own indexable page at /subdomain/[slug]
  // which already has JSON-LD structured data, title, and description.
  let instructorPages: MetadataRoute.Sitemap = []
  try {
    const instructors = await prisma.instructor.findMany({
      where: {
        approvalStatus: 'APPROVED',
        isActive: true,
        OR: [
          { subscriptionStatus: 'ACTIVE' },
          { subscriptionStatus: 'TRIAL', trialEndsAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        customSlug: true,
        updatedAt: true,
      },
    })

    instructorPages = instructors.map((i) => {
      const slug = i.customSlug || i.id
      return {
        url: `${BASE_URL}/subdomain/${slug}`,
        lastModified: i.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })
  } catch {
    // DB unavailable at build time — return static pages only
  }

  return [...staticPages, ...instructorPages]
}
