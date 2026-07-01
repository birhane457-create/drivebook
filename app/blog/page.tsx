import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { getAllPosts, BlogPost } from '@/lib/blog'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Driving Tips, Instructor Guides & WA Learner Resources | DriveBook',
  description:
    'Expert learner driver guides, PDA tips, logbook advice, instructor business resources, and driving school insights from DriveBook.',
  openGraph: {
    title: 'Driving Tips, Instructor Guides & WA Learner Resources',
    description:
      'Expert guides for learner drivers and driving instructors across Australia.',
    url: `${BASE_URL}/blog`,
  },
  alternates: { canonical: `${BASE_URL}/blog` },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function categoryBadge(category: string) {
  return category === 'students'
    ? { colour: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30', label: 'For Learner Drivers' }
    : { colour: 'bg-pink-500/20 text-pink-300 border border-pink-500/30', label: 'For Instructors' }
}

// ── Featured hero card ─────────────────────────────────────────────────────────

function FeaturedCard({ post }: { post: BlogPost }) {
  const badge = categoryBadge(post.category)
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-200 no-underline"
    >
      {/* Coloured accent bar */}
      <div className={`h-1 w-full ${post.category === 'students' ? 'bg-gradient-to-r from-cyan-500 to-violet-500' : 'bg-gradient-to-r from-pink-500 to-violet-500'}`} />

      <div className="p-8 md:p-10">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.colour}`}>
            {badge.label}
          </span>
          <span className="text-white/30 text-xs">Featured</span>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-4 group-hover:text-purple-200 transition-colors">
          {post.title}
        </h2>

        <p className="text-white/60 leading-relaxed mb-6 max-w-2xl">
          {post.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-white/40">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
          </div>
          <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 group-hover:translate-x-0.5 inline-block transition-all">
            Read article →
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Regular post card ──────────────────────────────────────────────────────────

function PostCard({ post }: { post: BlogPost }) {
  const badge = categoryBadge(post.category)
  return (
    <article className="group flex flex-col bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/[0.08] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.colour}`}>
          {badge.label}
        </span>
        <span className="flex items-center gap-1 text-white/40 text-xs">
          <Clock className="h-3 w-3" />
          {post.readTime}
        </span>
      </div>
      <h3 className="text-base font-bold text-white mb-2 leading-snug group-hover:text-purple-200 transition-colors">
        {post.title}
      </h3>
      <p className="text-white/60 text-sm leading-relaxed mb-4 flex-grow">
        {post.description}
      </p>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map(tag => (
            <span key={tag} className="text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded-full border border-white/10">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
        <span className="text-white/40 text-xs">{formatDate(post.date)}</span>
        <Link
          href={`/blog/${post.slug}`}
          className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors no-underline group-hover:translate-x-0.5 inline-block transition-transform"
        >
          Read more →
        </Link>
      </div>
    </article>
  )
}

// ── Mid-page CTA ───────────────────────────────────────────────────────────────

function MidCTA({ variant }: { variant: 'students' | 'instructors' }) {
  if (variant === 'students') {
    return (
      <div className="my-10 rounded-2xl bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-500/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-bold text-white mb-1">Looking for a driving instructor in Perth?</p>
          <p className="text-white/60 text-sm">Find verified local instructors and book your lesson instantly.</p>
        </div>
        <Link
          href="/book"
          className="shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20"
        >
          Find an Instructor →
        </Link>
      </div>
    )
  }
  return (
    <div className="my-10 rounded-2xl bg-gradient-to-r from-pink-900/40 to-violet-900/40 border border-pink-500/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <p className="font-bold text-white mb-1">Are you a driving instructor?</p>
        <p className="text-white/60 text-sm">Online bookings, payments, reminders, and student tracking — all in one place.</p>
      </div>
      <Link
        href="/teach-with-drivebook"
        className="shrink-0 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20"
      >
        Join DriveBook →
      </Link>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const allPosts = getAllPosts()
  const featured = allPosts[0]
  const remaining = allPosts.slice(1)
  const studentPosts = remaining.filter(p => p.category === 'students')
  const instructorPosts = remaining.filter(p => p.category === 'instructors')

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
    ],
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'DriveBook Blog',
    description: 'Driving tips, instructor guides, and WA learner resources',
    url: `${BASE_URL}/blog`,
    publisher: { '@type': 'Organization', name: 'DriveBook', url: BASE_URL },
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent no-underline">
            DriveBook
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/book" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Book a Lesson</Link>
            <Link href="/teach-with-drivebook" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
            <Link href="/login" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Login</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
          <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white/60">Blog</span>
        </nav>

        {/* Page heading */}
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Resources</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">DriveBook Blog</h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Driving tips, instructor guides, and WA learner resources.
          </p>
        </div>

        {/* Featured article */}
        {featured && (
          <div className="mb-14">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Featured Article</p>
            <FeaturedCard post={featured} />
          </div>
        )}

        {/* For Learner Drivers */}
        {studentPosts.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🎓</span>
              <h2 className="text-2xl font-bold text-white">For Learner Drivers</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {studentPosts.map(post => <PostCard key={post.slug} post={post} />)}
            </div>
          </section>
        )}

        {/* Mid-page CTA — students */}
        <MidCTA variant="students" />

        {/* For Driving Instructors */}
        {instructorPosts.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🚗</span>
              <h2 className="text-2xl font-bold text-white">For Driving Instructors</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {instructorPosts.map(post => <PostCard key={post.slug} post={post} />)}
            </div>
          </section>
        )}

        {/* Mid-page CTA — instructors */}
        <MidCTA variant="instructors" />

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
