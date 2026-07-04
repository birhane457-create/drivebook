import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getAllPosts } from '@/lib/blog'

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
    // /register is intentionally excluded — it's in robots.txt disallow and doesn't need indexing
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // ── Pillar pages ──────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn-to-drive`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pda-guide`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/for-instructors`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/platform`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    // ── Feature landing pages ─────────────────────────────────────────────────
    {
      url: `${BASE_URL}/features/ai-receptionist`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/features/online-booking`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/features/custom-domain`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/features/student-progress`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/features/multi-instructor`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/features/payments`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // ── Comparison pages ──────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/compare/google-calendar`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/compare/paper-diary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/compare/calendly`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/rss.xml`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.3,
    },
  ]

  // ── Instructor subdomain pages — the highest-value SEO pages ────────────────
  // Each approved instructor gets their own indexable page.
  // Canonical URL is [slug].drivebook.com.au — not the internal /subdomain/[slug] rewrite path.
  // This is what Google should index and what the subdomain page's canonical tag points to.
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
      },
    })

    // Use the subdomain URL as the canonical — middlewar rewrites it to /subdomain/[slug] internally
    const domainBase = BASE_URL.replace('https://', 'https://').replace('http://', 'http://')
    const domainSuffix = domainBase.replace(/^https?:\/\//, '')

    instructorPages = instructors.map((i) => {
      const slug = i.customSlug || i.id
      return {
        url: `https://${slug}.${domainSuffix}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })
  } catch {
    // DB unavailable at build time — return static pages only
  }

  // ── Blog posts ──────────────────────────────────────────────────────────────
  let blogPages: MetadataRoute.Sitemap = []
  try {
    const posts = getAllPosts()
    blogPages = posts.map(post => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    }))

    // Tag archive pages are noindexed (navigation aids, not content pages)
    // — excluded from sitemap to avoid submitting noindexed URLs
  } catch {
    // content dir unavailable at build time — skip blog entries
  }

  return [...staticPages, ...blogPages, ...instructorPages]
}
