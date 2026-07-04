import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Tag } from 'lucide-react'
import { getAllPosts, BlogPost } from '@/lib/blog'
import { notFound } from 'next/navigation'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

interface Props {
  params: { tag: string }
}

// Decode URL-encoded tag (e.g. "night-driving" → "night driving")
function decodeTag(raw: string): string {
  return decodeURIComponent(raw).replace(/-/g, ' ')
}

// Encode for URL
function encodeTag(tag: string): string {
  return encodeURIComponent(tag.toLowerCase().replace(/\s+/g, '-'))
}

export async function generateStaticParams() {
  const posts = getAllPosts()
  const allTags = new Set<string>()
  posts.forEach(p => p.tags?.forEach(t => allTags.add(encodeTag(t))))
  return Array.from(allTags).map(tag => ({ tag }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tagLabel = decodeTag(params.tag)
  const posts = getAllPosts().filter(p =>
    p.tags?.some(t => encodeTag(t) === params.tag)
  )
  if (posts.length === 0) return {}

  return {
    title: `${tagLabel} — Articles | DriveBook`,
    description: `${posts.length} article${posts.length !== 1 ? 's' : ''} about ${tagLabel} from DriveBook — driving tips, instructor guides, and WA learner resources.`,
    openGraph: {
      title: `${tagLabel} — DriveBook Blog`,
      description: `Browse all DriveBook articles tagged with "${tagLabel}".`,
      url: `${BASE_URL}/blog/tag/${params.tag}`,
    },
    alternates: { canonical: `${BASE_URL}/blog/tag/${params.tag}` },
    // Tag archives are navigation aids — noindex keeps crawl budget on the actual posts
    robots: { index: false, follow: true },
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function PostCard({ post }: { post: BlogPost }) {
  const isStudent = post.category === 'students'
  const badge = isStudent
    ? { colour: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30', label: 'Learner Driver' }
    : { colour: 'bg-pink-500/20 text-pink-300 border border-pink-500/30', label: 'Instructor' }

  return (
    <article className="group flex flex-col bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/[0.08] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition-all duration-200">
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.colour}`}>
          {badge.label}
        </span>
        <span className="flex items-center gap-1 text-white/40 text-xs">
          <Clock className="h-3 w-3" />{post.readTime}
        </span>
      </div>
      <h3 className="text-base font-bold text-white mb-2 leading-snug group-hover:text-purple-200 transition-colors">
        {post.title}
      </h3>
      <p className="text-white/60 text-sm leading-relaxed mb-4 flex-grow">{post.description}</p>
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
        <time className="text-white/40 text-xs" dateTime={post.date}>{formatDate(post.date)}</time>
        <Link href={`/blog/${post.slug}`} className="text-sm font-semibold text-purple-400 hover:text-purple-300 no-underline transition-colors">
          Read more →
        </Link>
      </div>
    </article>
  )
}

export default function TagPage({ params }: Props) {
  const tagLabel = decodeTag(params.tag)
  const allPosts = getAllPosts()
  const posts = allPosts.filter(p =>
    p.tags?.some(t => encodeTag(t) === params.tag)
  )

  if (posts.length === 0) notFound()

  // All tags for the tag cloud sidebar
  const tagCounts = new Map<string, number>()
  allPosts.forEach(p => p.tags?.forEach(t => {
    const key = encodeTag(t)
    tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1)
  }))
  const popularTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: tagLabel, item: `${BASE_URL}/blog/tag/${params.tag}` },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
            <Link href="/book" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Book a Lesson</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
          <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white no-underline transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/60 capitalize">{tagLabel}</span>
        </nav>

        {/* Page heading */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Tag className="h-5 w-5 text-purple-400" />
            <p className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Tag Archive</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 capitalize">{tagLabel}</h1>
          <p className="text-white/60">
            {posts.length} article{posts.length !== 1 ? 's' : ''} tagged with &ldquo;{tagLabel}&rdquo;
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Articles */}
          <div className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 gap-5">
              {posts.map(post => <PostCard key={post.slug} post={post} />)}
            </div>
          </div>

          {/* Tag cloud sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-400" />
                Browse by Tag
              </h2>
              <div className="flex flex-wrap gap-2">
                {popularTags.map(([slug, count]) => {
                  const label = decodeTag(slug)
                  const isActive = slug === params.tag
                  return (
                    <Link
                      key={slug}
                      href={`/blog/tag/${slug}`}
                      className={`text-xs px-2.5 py-1 rounded-full border no-underline transition-colors ${
                        isActive
                          ? 'bg-purple-500/30 text-purple-200 border-purple-500/50'
                          : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {label} <span className="text-white/30">({count})</span>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-6 pt-5 border-t border-white/10">
                <Link href="/blog" className="text-sm text-purple-400 hover:text-purple-300 no-underline transition-colors">
                  ← All articles
                </Link>
              </div>
            </div>
          </aside>

        </div>
      </main>

      <footer className="border-t border-white/10 py-10 mt-12 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} DriveBook · <Link href="/privacy" className="hover:text-white/60 no-underline">Privacy</Link></p>
      </footer>
    </div>
  )
}
