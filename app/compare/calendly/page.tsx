import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'DriveBook vs Calendly for Driving Instructors',
  description:
    'Calendly is a general-purpose scheduling tool. DriveBook is built specifically for driving instructors. See the difference in payments, student management, AI receptionist, and more.',
  openGraph: {
    title: 'DriveBook vs Calendly | Driving Instructors',
    description: 'Calendly handles scheduling. DriveBook handles your whole driving instruction business. Honest comparison.',
    url: `${BASE_URL}/compare/calendly`,
  },
  alternates: { canonical: `${BASE_URL}/compare/calendly` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/platform" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Platform</Link>
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-violet-500 hover:to-indigo-500 transition-all">Start Free Trial</Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10 mt-16 text-center text-white/40 text-sm">
      <p>© {new Date().getFullYear()} DriveBook · <Link href="/privacy" className="hover:text-white/60 no-underline">Privacy</Link> · <Link href="/terms" className="hover:text-white/60 no-underline">Terms</Link></p>
    </footer>
  )
}

const rows = [
  { feature: 'Built specifically for driving instructors', db: true, cal: false, note: 'Calendly is a general-purpose tool' },
  { feature: 'Integrated lesson payment collection', db: true, cal: 'Add-on', note: 'Calendly payments require Stripe/PayPal add-on, limited to simple deposits' },
  { feature: 'Student wallet and lesson packages', db: true, cal: false },
  { feature: 'Weekly instructor payouts', db: true, cal: false },
  { feature: 'Student progress tracking', db: true, cal: false },
  { feature: 'Lesson notes and feedback', db: true, cal: false },
  { feature: 'AI phone receptionist', db: true, cal: false },
  { feature: 'SMS reminders to students', db: true, cal: 'Paid', note: 'Calendly SMS requires a paid plan' },
  { feature: 'Cancellation policy enforcement', db: true, cal: 'Partial' },
  { feature: 'Public booking page', db: true, cal: true },
  { feature: 'Custom domain', db: true, cal: 'Paid', note: 'Calendly custom domain on Enterprise plan' },
  { feature: 'Google Calendar sync', db: true, cal: true },
  { feature: 'Google-indexable instructor profile', db: true, cal: false, note: 'Calendly pages are not optimised for local search' },
  { feature: 'Multi-instructor school management', db: true, cal: false },
  { feature: 'Revenue dashboard', db: true, cal: false },
  { feature: 'Built-in student reviews', db: true, cal: false },
  { feature: 'Free plan available', db: 'Free trial', cal: true },
]

export default function CompareCalendlyPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${BASE_URL}/compare` },
      { '@type': 'ListItem', position: 3, name: 'DriveBook vs Calendly', item: `${BASE_URL}/compare/calendly` },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 py-12">

        <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
          <Link href="/" className="hover:text-white no-underline">Home</Link>
          <span>/</span>
          <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
          <span>/</span>
          <span className="text-white/60">DriveBook vs Calendly</span>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">DriveBook vs Calendly<br />for Driving Instructors</h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
            Calendly solves one problem: letting people book time in your calendar. DriveBook solves the whole driving instruction business — bookings, payments, student management, AI answering, and revenue reporting.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-14">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Calendly is good for...</p>
            <ul className="space-y-2">
              {['Simple scheduling links', 'Meeting and consultation bookings', 'Calendar integrations (Google, Outlook)', 'Basic free plan'].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Calendly doesn't have...</p>
            <ul className="space-y-2">
              {[
                'Lesson wallet and package payments',
                'Weekly instructor payouts',
                'Student progress tracking',
                'AI phone receptionist',
                'Driving instructor-specific features',
                'Multi-instructor school management',
                'Local SEO-optimised instructor profiles',
              ].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><XCircle className="h-4 w-4 text-red-400/70 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Table */}
        <h2 className="text-2xl font-bold text-white mb-6">Feature Comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10 mb-14">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                <th className="text-center p-4 text-violet-400 font-bold">DriveBook</th>
                <th className="text-center p-4 text-white/50 font-semibold">Calendly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, db, cal, note }) => {
                const Cell = ({ v }: { v: boolean | string }) =>
                  v === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                  v === false ? <XCircle className="h-5 w-5 text-red-400/60 mx-auto" /> :
                  <span className="text-yellow-400 text-xs font-semibold">{v}</span>
                return (
                  <tr key={feature} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="p-4">
                      <span className="text-white/80 text-sm">{feature}</span>
                      {note && <span className="block text-white/35 text-xs mt-0.5">{note}</span>}
                    </td>
                    <td className="p-4 text-center"><Cell v={db} /></td>
                    <td className="p-4 text-center"><Cell v={cal} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Narrative */}
        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-bold text-white">The Core Difference</h2>
          <p className="text-white/60 leading-relaxed">
            Calendly was designed for professionals who need to share a booking link — consultants, coaches, salespeople. It's excellent at that specific job.
          </p>
          <p className="text-white/60 leading-relaxed">
            A driving instructor's business has more complexity than a meeting scheduler can address. Students need to pay for lessons, not just book them. Cancellation fees need to be charged. Student progress needs to be tracked. Revenue needs to be tracked. In a multi-instructor school, five different calendars need to be visible from one admin view.
          </p>
          <p className="text-white/60 leading-relaxed">
            An instructor using Calendly still needs separate tools for payments (Stripe, bank transfer, or cash), reminders (manual or another app), student records (spreadsheet or notes app), and revenue tracking (spreadsheet or accounting software). DriveBook replaces all of these.
          </p>
        </section>

        {/* Related */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/best-software-for-driving-instructors-australia', title: 'The best software for driving instructors in Australia' },
              { href: '/blog/why-online-booking-increases-revenue-driving-instructors', title: 'Why online booking increases revenue' },
              { href: '/blog/drivebook-platform-overview-driving-instructors-australia', title: 'What DriveBook actually does — a plain English overview' },
            ].map(({ href, title }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{title}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Built for Driving Instructors</h2>
          <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Not a general scheduling tool adapted for instructors. A platform built specifically for the way driving schools work.</p>
          <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
            Start Free Trial →
          </Link>
          <p className="text-white/30 text-xs mt-4">No credit card required</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
