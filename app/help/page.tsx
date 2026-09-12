import type { Metadata } from 'next'
import Link from 'next/link'
import { HelpCircle, BookOpen, Users, Zap } from 'lucide-react'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Help Centre | DriveBook',
  description: 'Clear guides for DriveBook students and instructors — booking, payments, account setup, and troubleshooting.',
  openGraph: {
    title: 'Help Centre | DriveBook',
    description: 'Student and instructor guides for DriveBook — booking, payments, cancellations, and more.',
    url: 'https://drivebook.com.au/help',
  },
  alternates: { canonical: 'https://drivebook.com.au/help' },
}

export default function HelpPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border py-4 px-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="no-underline"><Logo size={32} dark /></Link>
          <div className="flex items-center gap-2">
            <Link href="/book" className="text-foreground/70 hover:text-foreground text-sm font-medium no-underline px-3 py-2 rounded-lg hover:bg-secondary transition-colors hidden md:block">
              Find Instructor
            </Link>
            <Link href="/login" className="text-foreground/70 hover:text-foreground text-sm font-medium no-underline px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-14 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Help Centre</h1>
          </div>
          <p className="text-blue-200 text-lg">Clear guides to help you use DriveBook</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Quick Start */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-foreground">
            <Zap className="h-6 w-6 text-yellow-400" />
            Quick Start
          </h2>
          <p className="text-foreground mb-4">Get started in 30 seconds</p>
          <Link
            href="/help/quick-start"
            className="inline-block bg-yellow-600 hover:bg-yellow-700 text-foreground px-6 py-3 rounded-lg font-medium transition-colors no-underline"
          >
            View Quick Start →
          </Link>
        </div>

        {/* For Students */}
        <div className="mb-12 bg-white/[0.04] rounded-2xl p-8 border border-border">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-foreground">
            <BookOpen className="h-6 w-6 text-primary" />
            For Students
          </h2>
          <p className="text-muted-foreground mb-6">Learn how to find providers, book lessons, and track your progress</p>
          <div className="space-y-2 mb-6">
            {['Create an account', 'Find and book an instructor', 'Make a payment', 'Reschedule or cancel', 'Leave a review', 'Troubleshooting'].map(t => (
              <div key={t} className="flex items-center gap-2 text-foreground text-sm">
                <span className="text-primary">✓</span> {t}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/help/students" className="inline-block bg-primary hover:bg-primary/90 text-foreground px-6 py-3 rounded-lg font-medium transition-colors no-underline">
              Student Guide →
            </Link>
            <Link href="/learn-to-drive" className="inline-block bg-secondary hover:bg-white/20 text-foreground px-6 py-3 rounded-lg font-medium transition-colors no-underline border border-border">
              Learn to Drive Hub →
            </Link>
          </div>
        </div>

        {/* For Instructors */}
        <div className="mb-12 bg-white/[0.04] rounded-2xl p-8 border border-border">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-foreground">
            <Users className="h-6 w-6 text-emerald-400" />
            For Instructors
          </h2>
          <p className="text-muted-foreground mb-6">Learn how to set up your profile, manage bookings, and get paid</p>
          <div className="space-y-2 mb-6">
            {['Get approved', 'Set your availability', 'Manage bookings', 'Set up payouts', 'Track earnings', 'Manage reviews'].map(t => (
              <div key={t} className="flex items-center gap-2 text-foreground text-sm">
                <span className="text-emerald-400">✓</span> {t}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/help/instructors" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-foreground px-6 py-3 rounded-lg font-medium transition-colors no-underline">
              Instructor Guide →
            </Link>
            <Link href="/for-instructors" className="inline-block bg-secondary hover:bg-white/20 text-foreground px-6 py-3 rounded-lg font-medium transition-colors no-underline border border-border">
              Instructor Resource Hub →
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12 bg-white/[0.04] rounded-2xl p-8 border border-border">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-5">
            {[
              { q: 'How long until my booking is confirmed?', a: 'Bookings are confirmed immediately when you complete payment online. You receive an SMS confirmation instantly.' },
              { q: 'Can I cancel my booking?', a: 'Yes. Cancel from your client dashboard. Platform policy: full refund with 48+ hours notice, 50% refund for 24–48 hours notice, no refund under 24 hours. Refunds go to your wallet.' },
              { q: 'When do instructors get paid?', a: 'Automatic payouts every Tuesday to your nominated bank account, covering all completed lessons from the prior week.' },
              { q: 'How do I get approved as an instructor?', a: 'Upload your licence, insurance, and identity documents. Our admin team reviews within 2–5 business days.' },
              { q: 'Is my payment information safe?', a: 'Yes. All payments are processed by Stripe (PCI-DSS Level 1). DriveBook never stores card details.' },
            ].map(({ q, a }) => (
              <details key={q} className="group border border-border bg-card/40 rounded-lg">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-medium text-foreground hover:text-violet-400 select-none">
                  {q}
                  <span className="text-foreground/40 group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-white/[0.04] rounded-2xl p-8 border border-border text-center">
          <h2 className="text-xl font-bold mb-3 text-foreground">Can't find what you need?</h2>
          <p className="text-muted-foreground mb-5">Our support team is here to help.</p>
          <a
            href="mailto:support@drivebook.com.au"
            className="inline-block bg-violet-600 hover:bg-violet-700 text-foreground px-8 py-3 rounded-xl font-semibold transition-colors no-underline"
          >
            Contact Support
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-10 mt-8 text-center text-foreground/40 text-sm">
        <p>
          © {new Date().getFullYear()} DriveBook ·{' '}
          <Link href="/privacy" className="hover:text-foreground/60 no-underline">Privacy</Link> ·{' '}
          <Link href="/terms" className="hover:text-foreground/60 no-underline">Terms</Link> ·{' '}
          <Link href="/contact" className="hover:text-foreground/60 no-underline">Contact</Link>
        </p>
      </footer>
    </div>
  )
}
