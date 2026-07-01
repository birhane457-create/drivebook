import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPostBySlug, getAdjacentPosts, getRelatedPosts } from '@/lib/blog'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

interface Props {
  params: { slug: string }
}

export async function generateStaticParams() {
  return getAllPosts().map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  const { prev, next } = getAdjacentPosts(params.slug)
  const related = getRelatedPosts(params.slug, post.category, 3)

  const isStudent = post.category === 'students'
  const ctaHref = isStudent ? '/book' : '/teach-with-drivebook'
  const ctaText = isStudent ? 'Book a lesson on DriveBook →' : 'Join DriveBook as an instructor →'
  const badgeColour = isStudent
    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
    : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
  const badgeLabel = isStudent ? 'For Learner Drivers' : 'For Instructors'

  // JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${BASE_URL}/blog/${post.slug}` },
    ],
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    keywords: post.tags?.join(', '),
    author: { '@type': 'Organization', name: post.author, url: BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'DriveBook',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
    },
    datePublished: post.date,
    url: `${BASE_URL}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${post.slug}` },
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="no-underline">
            <Logo size={32} dark />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
            <Link href="/book" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Book a Lesson</Link>
            <Link href="/login" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Login</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
          <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white no-underline transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/60 line-clamp-1">{post.title}</span>
        </nav>

        {/* Article header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badgeColour}`}>
              {badgeLabel}
            </span>
            <span className="flex items-center gap-1 text-white/40 text-xs">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            {post.title}
          </h1>

          <p className="text-white/60 text-lg leading-relaxed mb-5">{post.description}</p>

          <div className="flex items-center gap-4 text-sm text-white/50">
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {post.tags.map(tag => (
                <span key={tag} className="text-xs bg-white/5 text-white/50 px-2.5 py-1 rounded-full border border-white/10">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* MDX Content */}
        <div className="prose prose-invert prose-lg max-w-none
          prose-headings:text-white prose-headings:font-bold
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-white/75 prose-p:leading-relaxed prose-p:mb-4
          prose-li:text-white/75 prose-li:leading-relaxed
          prose-ul:my-4 prose-ol:my-4
          prose-strong:text-white prose-strong:font-semibold
          prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300
          prose-hr:border-white/10
          prose-table:text-white/75 prose-thead:border-white/20 prose-tr:border-white/10">
          <MDXRemote source={post.content} />
        </div>

        {/* CTA */}
        <div className="mt-14 border-t border-white/10 pt-10">
          <div className={`rounded-2xl p-8 text-center ${
            isStudent
              ? 'bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30'
              : 'bg-gradient-to-br from-pink-900/60 to-violet-900/60 border border-pink-500/30'
          }`}>
            <h2 className="text-xl font-bold text-white mb-3">
              {isStudent ? 'Ready to start your driving journey?' : 'Ready to grow your driving school?'}
            </h2>
            <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
              {isStudent
                ? 'Find a verified local instructor, book instantly, and track your progress to test day.'
                : 'Online bookings, payments, reminders, and lesson feedback — all in one place.'}
            </p>
            <Link
              href={ctaHref}
              className={`inline-block px-8 py-3 rounded-xl font-bold text-white no-underline transition-all hover:scale-105 ${
                isStudent
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20'
                  : 'bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 shadow-lg shadow-pink-500/20'
              }`}
            >
              {ctaText}
            </Link>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-14 border-t border-white/10 pt-10">
            <h2 className="text-lg font-bold text-white mb-6">Related Articles</h2>
            <div className="space-y-3">
              {related.map(r => {
                const badge = r.category === 'students'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                return (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors line-clamp-2 mb-1">{r.title}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                          {r.category === 'students' ? 'Learner' : 'Instructor'}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                          <Clock className="h-3 w-3" />{r.readTime}
                        </span>
                      </div>
                    </div>
                    <span className="text-white/30 group-hover:text-purple-400 text-lg shrink-0 mt-0.5 transition-colors">→</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Prev / Next navigation */}
        {(prev || next) && (
          <div className="mt-12 border-t border-white/10 pt-10 grid grid-cols-2 gap-4">
            <div>
              {prev && (
                <Link
                  href={`/blog/${prev.slug}`}
                  className="group flex flex-col gap-1 p-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all no-underline"
                >
                  <span className="text-xs text-white/40 flex items-center gap-1">← Previous</span>
                  <span className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors line-clamp-2">{prev.title}</span>
                </Link>
              )}
            </div>
            <div>
              {next && (
                <Link
                  href={`/blog/${next.slug}`}
                  className="group flex flex-col gap-1 p-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all no-underline text-right"
                >
                  <span className="text-xs text-white/40 flex items-center justify-end gap-1">Next →</span>
                  <span className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors line-clamp-2">{next.title}</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Back to blog */}
        <div className="mt-10 text-center">
          <Link href="/blog" className="text-sm text-white/40 hover:text-white no-underline transition-colors">
            ← Back to all articles
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 mt-12 text-center text-white/40 text-sm">
        <p>
          © {new Date().getFullYear()} DriveBook ·{' '}
          <Link href="/privacy" className="hover:text-white/60 no-underline transition-colors">Privacy</Link> ·{' '}
          <Link href="/terms" className="hover:text-white/60 no-underline transition-colors">Terms</Link>
        </p>
      </footer>
    </div>
  )
}
