/**
 * GET /rss.xml
 * RSS 2.0 feed for all blog posts, newest first.
 * Useful for SEO, feed readers, and content aggregators.
 */
import { getAllPosts } from '@/lib/blog'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // regenerate every hour

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const posts = getAllPosts()

  const items = posts
    .map(post => {
      const url = `${BASE_URL}/blog/${post.slug}`
      const pubDate = new Date(post.date).toUTCString()
      const category = post.category === 'students' ? 'Learner Drivers' : 'Driving Instructors'
      const tags = post.tags?.map(t => `<category>${escape(t)}</category>`).join('') ?? ''

      return `
    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escape(post.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escape(category)}</category>
      ${tags}
      <author>team@drivebook.com.au (${escape(post.author)})</author>
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>DriveBook Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Driving tips, instructor guides, and WA learner resources from DriveBook.</description>
    <language>en-AU</language>
    <copyright>© ${new Date().getFullYear()} DriveBook</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/logo.png</url>
      <title>DriveBook Blog</title>
      <link>${BASE_URL}/blog</link>
    </image>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
