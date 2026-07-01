import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'DriveBook vs Google Calendar for Driving Instructors',
  description:
    'Google Calendar is free and familiar — but it can\'t take bookings, collect payments, send SMS reminders, or give students their own dashboard. See exactly what you\'re missing.',
  openGraph: {
    title: 'DriveBook vs Google Calendar | Driving Instructors',
    description: 'Honest comparison — what Google Calendar does well and where it leaves driving instructors exposed.',
    url: `${BASE_URL}/compare/google-calendar`,
  },
  alternates: { canonical: `${BASE_URL}/compare/google-calendar` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/platform" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Platform</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
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
  { feature: 'Online booking for students', db: true, gc: false, note: 'Google Calendar has no public booking page' },
  { feature: 'Real-time availability shown to students', db: true, gc: false, note: 'Students can\'t see your Google Calendar' },
  { feature: 'Automatic booking confirmation', db: true, gc: false, note: 'You have to manually confirm every booking' },
  { feature: 'Payment collection at booking', db: true, gc: false, note: 'Google Calendar has no payment feature' },
  { feature: 'SMS reminders to students', db: true, gc: false, note: 'No automated reminders in Google Calendar' },
  { feature: 'Cancellation policy enforcement', db: true, gc: false, note: 'Manual process — no automation' },
  { feature: 'Student progress tracking', db: true, gc: false, note: 'Not a feature of calendar apps' },
  { feature: 'Student wallet & lesson packages', db: true, gc: false, note: 'No payment tools in Google Calendar' },
  { feature: 'Weekly instructor payouts', db: true, gc: false, note: 'You manage your own payments separately' },
  { feature: 'AI phone receptionist', db: true, gc: false, note: 'Not available in any calendar app' },
  { feature: 'Custom domain booking page', db: true, gc: false, note: 'Google Calendar cannot host a booking page' },
  { feature: 'Google Calendar sync', db: true, gc: true, note: 'DriveBook syncs TO Google Calendar' },
  { feature: 'Offline booking recording', db: true, gc: true, note: 'Both support manual entries' },
  { feature: 'Free to use', db: 'Free trial', gc: true, note: 'DriveBook has subscription plans from BASIC' },
]

export default function CompareGoogleCalendarPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${BASE_URL}/compare` },
      { '@type': 'ListItem', position: 3, name: 'DriveBook vs Google Calendar', item: `${BASE_URL}/compare/google-calendar` },
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
          <span className="text-white/60">DriveBook vs Google Calendar</span>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">DriveBook vs Google Calendar<br />for Driving Instructors</h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
            Google Calendar is a great tool for personal scheduling. It's not a booking system. Here's a clear breakdown of what it does and doesn't do for driving instructors.
          </p>
        </div>

        {/* Verdict summary */}
        <div className="grid md:grid-cols-2 gap-5 mb-14">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Google Calendar is good for...</p>
            <ul className="space-y-2">
              {['Tracking your own schedule', 'Sharing availability with people you trust', 'Syncing across devices', 'Setting personal reminders'].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Google Calendar cannot...</p>
            <ul className="space-y-2">
              {['Let students book lessons directly', 'Collect payment at booking', 'Send automated SMS reminders', 'Track student progress', 'Enforce a cancellation policy', 'Give you a public booking page'].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><XCircle className="h-4 w-4 text-red-400/70 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Full comparison table */}
        <h2 className="text-2xl font-bold text-white mb-6">Full Feature Comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10 mb-14">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                <th className="text-center p-4 text-violet-400 font-bold">DriveBook</th>
                <th className="text-center p-4 text-white/50 font-semibold">Google Calendar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, db, gc, note }) => {
                const Cell = ({ v }: { v: boolean | string }) =>
                  v === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                  v === false ? <XCircle className="h-5 w-5 text-red-400/60 mx-auto" /> :
                  <span className="text-violet-300 text-xs font-semibold">{v}</span>
                return (
                  <tr key={feature} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="p-4">
                      <span className="text-white/80 text-sm">{feature}</span>
                      {note && <span className="block text-white/35 text-xs mt-0.5">{note}</span>}
                    </td>
                    <td className="p-4 text-center"><Cell v={db} /></td>
                    <td className="p-4 text-center"><Cell v={gc} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Narrative */}
        <section className="prose prose-invert max-w-none mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">The Real Difference</h2>
          <p className="text-white/60 leading-relaxed mb-4">
            Google Calendar is a scheduling tool. It tells you — and people you share it with — what's in your diary. That's all it does.
          </p>
          <p className="text-white/60 leading-relaxed mb-4">
            A driving instructor running their business needs more than a diary. They need students to be able to find available slots without calling, book online, pay upfront, and receive an automatic confirmation. They need a cancellation policy that enforces itself. They need reminders to go out automatically so no-shows drop. They need lesson notes and progress records. They need a weekly payout statement.
          </p>
          <p className="text-white/60 leading-relaxed">
            Google Calendar does none of these things. It's a calendar, not a booking system. Most instructors who are using Google Calendar are also spending several hours per week doing manually the things DriveBook automates.
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Can I use both?</h3>
          <p className="text-white/60 leading-relaxed">
            Yes. DriveBook syncs confirmed bookings to Google Calendar automatically. If you're used to viewing your schedule in Google Calendar, that continues to work. You get the full booking, payment, and student management system in DriveBook, with your confirmed lessons also visible in Google Calendar.
          </p>
        </section>

        {/* Related */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/drivebook-vs-google-calendar-driving-instructors', title: 'DriveBook vs Google Calendar — full article' },
              { href: '/blog/drivebook-vs-paper-diary-driving-instructor', title: 'DriveBook vs Paper Diary' },
              { href: '/blog/how-to-stop-double-bookings-driving-instructor', title: 'How to stop double bookings forever' },
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
          <h2 className="text-2xl font-bold text-white mb-3">Ready for a Real Booking System?</h2>
          <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Start your free DriveBook trial today. It takes under 10 minutes to set up your booking page.</p>
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
