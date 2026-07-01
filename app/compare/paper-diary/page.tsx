import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, XCircle, ChevronRight, AlertTriangle } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'DriveBook vs Paper Diary for Driving Instructors',
  description:
    'A paper diary tracks appointments. DriveBook manages your entire booking business. Here\'s an honest look at what moving from paper to digital actually gives you.',
  openGraph: {
    title: 'DriveBook vs Paper Diary | Driving Instructors',
    description: 'Honest comparison of paper diary vs DriveBook for driving instructors — what you gain and what it actually costs.',
    url: `${BASE_URL}/compare/paper-diary`,
  },
  alternates: { canonical: `${BASE_URL}/compare/paper-diary` },
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
  { feature: 'Students can book without calling you', db: true, diary: false },
  { feature: 'Available 24/7 for new bookings', db: true, diary: false },
  { feature: 'No double-booking risk', db: true, diary: false, note: 'Paper diaries can\'t prevent concurrent conflicts' },
  { feature: 'Payment collected at booking', db: true, diary: false },
  { feature: 'Automatic SMS reminders', db: true, diary: false },
  { feature: 'Cancellation fees charged automatically', db: true, diary: false },
  { feature: 'Student progress records', db: true, diary: false },
  { feature: 'Revenue and income tracking', db: true, diary: false },
  { feature: 'Backup if lost or damaged', db: true, diary: false, note: 'A lost paper diary = lost all records' },
  { feature: 'Accessible from any device', db: true, diary: false },
  { feature: 'Google indexable booking page', db: true, diary: false },
  { feature: 'Works without internet', db: false, diary: true },
  { feature: 'Zero learning curve', db: false, diary: true },
  { feature: 'Cost', db: 'From $0 (free trial)', diary: '~$20/yr', note: 'DriveBook plans start after trial' },
]

export default function ComparePaperDiaryPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${BASE_URL}/compare` },
      { '@type': 'ListItem', position: 3, name: 'DriveBook vs Paper Diary', item: `${BASE_URL}/compare/paper-diary` },
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
          <span className="text-white/60">DriveBook vs Paper Diary</span>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">DriveBook vs Paper Diary<br />for Driving Instructors</h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
            The paper diary isn't really competition for DriveBook — they do different things. A diary tracks appointments. DriveBook handles bookings, payments, reminders, student records, and payouts.
          </p>
        </div>

        {/* Risk callout */}
        <div className="flex gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-12">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white mb-1">The paper diary's biggest risk</p>
            <p className="text-white/60 text-sm leading-relaxed">
              A paper diary left in the car — or a car that gets broken into — means losing all your student records, upcoming bookings, and income history. There's no backup. DriveBook stores everything securely in the cloud.
            </p>
          </div>
        </div>

        {/* What a diary actually does */}
        <div className="grid md:grid-cols-2 gap-5 mb-14">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">A paper diary is good for...</p>
            <ul className="space-y-2">
              {['Writing down appointments', 'Works without internet', 'Zero learning curve', 'Low cost (~$20/year)'].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">A paper diary cannot...</p>
            <ul className="space-y-2">
              {[
                'Let students book without calling',
                'Prevent double bookings automatically',
                'Collect payment',
                'Send reminders',
                'Track student progress',
                'Back itself up if lost or damaged',
                'Work when you\'re not near it',
              ].map(i => (
                <li key={i} className="flex gap-2 text-sm text-white/70"><XCircle className="h-4 w-4 text-red-400/70 shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Table */}
        <h2 className="text-2xl font-bold text-white mb-6">Full Comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10 mb-14">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                <th className="text-center p-4 text-violet-400 font-bold">DriveBook</th>
                <th className="text-center p-4 text-white/50 font-semibold">Paper Diary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, db, diary, note }) => {
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
                    <td className="p-4 text-center"><Cell v={diary} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Narrative */}
        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-bold text-white">The Hidden Cost of the Paper Diary</h2>
          <p className="text-white/60 leading-relaxed">
            On the surface, a paper diary costs $20 a year. In practice, it costs hours every week — answering booking calls, sending manual reminders, chasing late payments, reconciling income at the end of the month.
          </p>
          <p className="text-white/60 leading-relaxed">
            For an instructor teaching 30 lessons per week, manual admin typically runs 6–10 hours per week. At $80 per lesson hour, that's $480–$800 worth of teaching time spent on tasks that could be automated.
          </p>
          <p className="text-white/60 leading-relaxed">
            DriveBook doesn't cost more than a paper diary when you account for the time it saves. It costs significantly less.
          </p>
        </section>

        {/* Related */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/drivebook-vs-paper-diary-driving-instructor', title: 'DriveBook vs Paper Diary — full article' },
              { href: '/blog/how-to-run-driving-school-without-spreadsheets', title: 'How to run your driving school without spreadsheets' },
              { href: '/blog/how-to-reduce-admin-time-driving-instructor', title: 'How to spend less time on admin' },
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
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Move On from the Paper Diary?</h2>
          <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">DriveBook takes under 10 minutes to set up. Your first online booking can come in today.</p>
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
