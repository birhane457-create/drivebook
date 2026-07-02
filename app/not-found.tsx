import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: '404 — Page Not Found | DriveBook',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Minimal nav */}
      <nav className="border-b border-white/10 py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="no-underline"><Logo size={32} dark /></Link>
        </div>
      </nav>

      {/* 404 content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <p className="text-8xl font-black text-white/10 mb-2 leading-none select-none">404</p>
          <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
          <p className="text-white/60 mb-10 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link href="/" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-8 py-3 rounded-xl font-bold no-underline transition-all hover:scale-105">
              Go Home
            </Link>
            <Link href="/book" className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-semibold no-underline transition-all border border-white/10">
              Find an Instructor
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-white/40">
            <Link href="/learn-to-drive" className="hover:text-white/70 no-underline transition-colors">Learn to Drive</Link>
            <Link href="/pda-guide" className="hover:text-white/70 no-underline transition-colors">PDA Guide</Link>
            <Link href="/for-instructors" className="hover:text-white/70 no-underline transition-colors">For Instructors</Link>
            <Link href="/blog" className="hover:text-white/70 no-underline transition-colors">Blog</Link>
            <Link href="/contact" className="hover:text-white/70 no-underline transition-colors">Contact</Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 py-6 text-center text-white/30 text-xs">
        © {new Date().getFullYear()} DriveBook
      </footer>
    </div>
  )
}
