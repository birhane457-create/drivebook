import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, BarChart3, CheckCircle, XCircle, ChevronRight, Zap, Calendar, CreditCard } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Driving School Management Software — Multi-Instructor Dashboard | DriveBook',
  description:
    'Manage multiple driving instructors from one dashboard. Individual calendars, per-instructor reporting, centralised payouts, and school-level branding. DriveBook STUDIO and BUSINESS plans.',
  openGraph: {
    title: 'Multi-Instructor Driving School Management | DriveBook',
    description: 'One dashboard for your whole driving school. Individual instructor calendars, performance reports, centralised payouts.',
    url: `${BASE_URL}/features/multi-instructor`,
  },
  alternates: { canonical: `${BASE_URL}/features/multi-instructor` },
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
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-pink-500 hover:to-violet-500 transition-all">Start Free Trial</Link>
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

export default function MultiInstructorPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'Multi-Instructor Management', item: `${BASE_URL}/features/multi-instructor` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Can each instructor manage their own availability?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Each instructor has their own login and manages their own calendar. The school admin can view all instructor availability centrally but instructors operate independently.' } },
      { '@type': 'Question', name: 'How do payouts work for multiple instructors?', acceptedAnswer: { '@type': 'Answer', text: 'DriveBook calculates each instructor\'s earnings weekly and the admin sees a payout breakdown per instructor. Platform commission is deducted automatically before the payout calculation.' } },
      { '@type': 'Question', name: 'Is there a limit on the number of instructors?', acceptedAnswer: { '@type': 'Answer', text: 'STUDIO supports 2–6 instructors. BUSINESS supports unlimited instructors. Both plans include the full multi-instructor management feature set.' } },
      { '@type': 'Question', name: 'Can I give instructors different permission levels?', acceptedAnswer: { '@type': 'Answer', text: 'Role-based access is available on the BUSINESS plan. Admin, manager, and instructor roles each have different levels of visibility and control.' } },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-pink-900 via-violet-900 to-slate-950 py-20 md:py-28 px-4">
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl translate-y-1/2" />
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
              <span>/</span>
              <span className="text-white/60">Multi-Instructor Management</span>
            </nav>
            <div className="inline-flex items-center gap-2 bg-pink-500/20 border border-pink-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-pink-300 text-xs font-semibold uppercase tracking-wider">STUDIO &amp; BUSINESS plans</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Manage Your Whole School<br />
              <span className="bg-gradient-to-r from-pink-300 to-violet-300 bg-clip-text text-transparent">From One Dashboard</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl leading-relaxed">
              Individual instructor calendars, per-instructor earnings, student assignment, and school-level branding — all visible to the school owner from one admin view.
            </p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20">
              Start Free Trial →
            </Link>
          </div>
        </section>

        {/* What the admin sees */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What the Admin Dashboard Shows</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Calendar, colour: 'from-violet-600 to-indigo-600', title: 'All instructor calendars', desc: 'See every instructor\'s bookings, availability, and gaps in one view. Spot scheduling issues before they become problems.' },
              { icon: BarChart3, colour: 'from-pink-600 to-rose-600', title: 'Per-instructor performance', desc: 'Booking completion rate, cancellation rate, revenue, review scores, and student count — per instructor, per period.' },
              { icon: Users, colour: 'from-emerald-600 to-teal-600', title: 'Student assignment', desc: 'Assign new students to specific instructors from the admin panel. Reassign students when an instructor is unavailable or leaves.' },
              { icon: CreditCard, colour: 'from-amber-500 to-orange-500', title: 'Centralised payouts', desc: 'Weekly payout run covers all instructors. Each instructor\'s earnings are calculated separately with the school commission deducted.' },
              { icon: Zap, colour: 'from-indigo-600 to-blue-600', title: 'School branding', desc: 'One logo and colour applied to all instructor profiles. Consistent brand appearance across every instructor on your team.' },
              { icon: CheckCircle, colour: 'from-cyan-600 to-blue-600', title: 'Role-based access', desc: 'BUSINESS plan: admin, manager, and instructor roles with different permission levels. Instructors see only their own data.' },
            ].map(({ icon: Icon, colour, title, desc }) => (
              <div key={title} className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Plan comparison */}
        <section className="bg-white/[0.02] border-y border-white/10 py-14 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-3">Which Plan Do I Need?</h2>
            <p className="text-white/50 text-center text-sm mb-10">Multi-instructor management is available on STUDIO and BUSINESS.</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                    <th className="text-center p-4 text-white/50">BASIC / PRO</th>
                    <th className="text-center p-4 text-pink-400 font-bold">STUDIO</th>
                    <th className="text-center p-4 text-violet-400 font-bold">BUSINESS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { f: 'Solo instructor booking', basic: true, studio: true, biz: true },
                    { f: 'Multi-instructor dashboard', basic: false, studio: true, biz: true },
                    { f: 'Per-instructor calendars', basic: false, studio: true, biz: true },
                    { f: 'Per-instructor reporting', basic: false, studio: true, biz: true },
                    { f: 'Student assignment tools', basic: false, studio: true, biz: true },
                    { f: 'School branding across all profiles', basic: false, studio: true, biz: true },
                    { f: 'Centralised payouts', basic: false, studio: true, biz: true },
                    { f: 'Unlimited instructors', basic: false, studio: false, biz: true },
                    { f: 'Role-based access (admin/manager/instructor)', basic: false, studio: false, biz: true },
                    { f: 'Advanced reporting', basic: false, studio: false, biz: true },
                  ].map(({ f, basic, studio, biz }) => {
                    const Cell = ({ v }: { v: boolean }) => v
                      ? <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                      : <XCircle className="h-4 w-4 text-white/20 mx-auto" />
                    return (
                      <tr key={f} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                        <td className="p-4 text-white/80 text-xs">{f}</td>
                        <td className="p-4 text-center"><Cell v={basic} /></td>
                        <td className="p-4 text-center"><Cell v={studio} /></td>
                        <td className="p-4 text-center"><Cell v={biz} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-12 pb-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Can each instructor manage their own availability?', a: 'Yes. Each instructor has their own login and manages their own calendar. The school admin can view all availability centrally.' },
              { q: 'How do payouts work for multiple instructors?', a: 'DriveBook calculates each instructor\'s earnings weekly. The admin sees a payout breakdown per instructor. Platform commission is deducted automatically.' },
              { q: 'Is there a limit on instructor count?', a: 'STUDIO supports 2–6 instructors. BUSINESS supports unlimited.' },
              { q: 'Can I give instructors different permission levels?', a: 'Role-based access is available on BUSINESS — admin, manager, and instructor roles with different visibility and control.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
                <p className="font-semibold text-white mb-2 text-sm">{q}</p>
                <p className="text-white/60 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-lg font-bold text-white mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/how-to-manage-five-driving-instructors-one-dashboard', title: 'How to manage 5 instructors from one dashboard' },
              { href: '/blog/growing-driving-school-one-instructor-to-ten', title: 'Growing your driving school from 1 instructor to 10' },
              { href: '/blog/how-to-scale-driving-school-systems', title: 'The systems you need before you can scale' },
              { href: '/blog/how-to-onboard-new-instructor-driving-school', title: 'How to onboard a new instructor' },
            ].map(({ href, title }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{title}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-pink-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-pink-900/60 to-violet-900/60 border border-pink-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to Manage Your School Properly?</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Start on STUDIO for 2–6 instructors. Upgrade to BUSINESS when you need unlimited.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20">
              Start Free Trial →
            </Link>
            <p className="text-white/30 text-xs mt-4">No credit card required</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
