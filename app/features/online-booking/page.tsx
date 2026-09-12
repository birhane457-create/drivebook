import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, CreditCard, Bell, CheckCircle, XCircle, ChevronRight, Zap, Clock, Users } from 'lucide-react'
import Logo from '@/components/Logo'
import { FeatureHero, heroPresets } from '@/components/features'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Online Booking for Driving Instructors — Ditch the Phone Tag',
  description:
    'DriveBook gives driving instructors a professional online booking page with real-time availability, instant confirmation, and automatic payment collection. No calls, no back-and-forth.',
  openGraph: {
    title: 'Online Booking for Driving Instructors | DriveBook',
    description: 'Real-time availability, instant booking confirmation, automatic payment. Online booking software built for Australian driving instructors.',
    url: `${BASE_URL}/features/online-booking`,
  },
  alternates: { canonical: `${BASE_URL}/features/online-booking` },
}

function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/for-instructors" className="text-foreground/70 hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors no-underline">For Instructors</Link>
          <Link href="/platform" className="text-foreground/70 hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors no-underline">Platform</Link>
          <Link href="/blog" className="text-foreground/70 hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition-colors no-underline">Blog</Link>
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-violet-500 hover:to-indigo-500 transition-all">
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 mt-16 text-center text-foreground/40 text-sm">
      <p>© {new Date().getFullYear()} DriveBook · <Link href="/privacy" className="hover:text-foreground/60 no-underline">Privacy</Link> · <Link href="/terms" className="hover:text-foreground/60 no-underline">Terms</Link></p>
    </footer>
  )
}

export default function OnlineBookingPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'Online Booking', item: `${BASE_URL}/features/online-booking` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Can students book at any time of day?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Your booking page is live 24/7. Students can book at midnight, on weekends, or on public holidays — within the availability windows you set.' } },
      { '@type': 'Question', name: 'How do I get paid for online bookings?', acceptedAnswer: { '@type': 'Answer', text: 'Students pay into their DriveBook wallet at booking time using a credit or debit card. The lesson cost is deducted from their wallet. You receive a weekly payout covering all completed lessons from the prior week.' } },
      { '@type': 'Question', name: 'Can I also record cash and offline bookings?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. DriveBook lets you manually record cash, bank transfer, or phone bookings. They appear in your calendar alongside online bookings so your schedule is always complete.' } },
      { '@type': 'Question', name: 'What happens if a student cancels?', acceptedAnswer: { '@type': 'Answer', text: 'Your cancellation policy is applied automatically. Cancellations within your policy window trigger a charge deducted from the student\'s wallet. You set the policy — DriveBook enforces it.' } },
      { '@type': 'Question', name: 'Is there a limit on how many bookings I can take?', acceptedAnswer: { '@type': 'Answer', text: 'Booking limits depend on your subscription tier. BASIC has a monthly cap; PRO and above have no booking limits.' } },
    ],
  }

  const comparisonRows = [
    { feature: 'Students can book anytime', online: true, manual: false },
    { feature: 'Real-time availability shown', online: true, manual: false },
    { feature: 'Automatic confirmation sent', online: true, manual: false },
    { feature: 'Payment collected at booking', online: true, manual: false },
    { feature: 'No-show risk reduced', online: true, manual: false },
    { feature: 'Cancellation policy enforced', online: true, manual: false },
    { feature: 'Calendar updated instantly', online: true, manual: false },
    { feature: 'Admin time required', online: false, manual: true },
    { feature: 'Works while you\'re teaching', online: true, manual: false },
  ]

  return (
    <div className="light min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <FeatureHero
          gradientClasses={heroPresets.violet.gradient}
          badgeIcon={Zap}
          badgeText="Available on all plans"
          badgeColors={heroPresets.violet.badgeColors}
          title={
            <>
              Online Booking for<br />
              <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">Driving Instructors</span>
            </>
          }
          description="Replace the phone tag, the text messages, and the manual calendar. Give students a professional booking page where they can see your real availability, book instantly, and pay upfront."
          ctaHref="/teach-with-drivebook"
          ctaText="Start Free Trial →"
          ctaGradient={heroPresets.violet.ctaGradient}
          ctaShadow={heroPresets.violet.ctaShadow}
          secondaryLink={{
            href: '/blog/why-online-booking-increases-revenue-driving-instructors',
            text: 'Why Online Booking Works'
          }}
          breadcrumb={{
            parent: 'For Instructors',
            parentHref: '/for-instructors',
            current: 'Online Booking'
          }}
          blobColor={heroPresets.violet.blobColor}
        />

        {/* How it works — 3 steps */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-foreground/50">Three steps from search to confirmed lesson.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', icon: Users, colour: 'from-cyan-600 to-blue-600', title: 'Student finds your page', desc: 'Your DriveBook profile is indexed by Google. Students searching "driving instructor [suburb]" find you, see your availability, rates, vehicle type, and reviews.' },
              { n: '2', icon: Calendar, colour: 'from-violet-600 to-purple-600', title: 'Student books online', desc: 'They pick a date and time from your real-time availability, enter their pickup address, and confirm. No calls. No back-and-forth. The whole process takes under two minutes.' },
              { n: '3', icon: CreditCard, colour: 'from-emerald-600 to-teal-600', title: 'Payment collected, lesson confirmed', desc: 'The lesson cost is deducted from the student\'s wallet at booking time. Both of you receive confirmation instantly. The booking appears in your dashboard.' },
            ].map(({ n, icon: Icon, colour, title, desc }) => (
              <div key={n} className="relative bg-white/[0.04] border border-border rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="absolute top-4 right-4 text-4xl font-black text-foreground/[0.06]">{n}</div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-foreground/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Key features */}
        <section className="bg-white/[0.02] border-y border-border py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">Everything Included</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: Clock, title: 'Real-time availability', desc: 'Students only see slots that are genuinely open. Booking buffers, working hours, and existing appointments are all respected automatically.' },
                { icon: CreditCard, title: 'Upfront payment', desc: 'Students pay via card into their wallet before the lesson happens. No chasing payments. No cash on the day.' },
                { icon: Bell, title: 'Automatic reminders', desc: 'SMS and email reminders sent 24 hours before and on the day. No-show rates drop significantly without you doing anything.' },
                { icon: Calendar, title: 'Offline booking recording', desc: 'Cash or phone bookings can be recorded manually in your dashboard. Your complete schedule is always in one place.' },
                { icon: CheckCircle, title: 'Cancellation policy enforcement', desc: 'Set your cancellation policy once. DriveBook charges the appropriate fee automatically when a student cancels inside the window.' },
                { icon: Zap, title: 'No double bookings', desc: 'Slot reservation prevents two students from booking the same time simultaneously. Atomic checkout — the first confirmation wins.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-5 rounded-xl bg-white/[0.04] border border-border hover:border-white/20 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">{title}</p>
                    <p className="text-foreground/55 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-foreground mb-3 text-center">Online Booking vs Manual Booking</h2>
          <p className="text-foreground/50 text-center mb-10 text-sm">Manual booking costs you more time and money than it looks.</p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-white/[0.04]">
                  <th className="text-left p-4 text-foreground/60 font-semibold">Capability</th>
                  <th className="text-center p-4 text-violet-400 font-bold">Online (DriveBook)</th>
                  <th className="text-center p-4 text-foreground/50 font-semibold">Phone / Text</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ feature, online, manual }) => (
                  <tr key={feature} className="border-b border-border/60 hover:bg-white/[0.02]">
                    <td className="p-4 text-foreground/80">{feature}</td>
                    <td className="p-4 text-center">
                      {online ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> : <XCircle className="h-5 w-5 text-destructive/60 mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      {manual ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> : <XCircle className="h-5 w-5 text-destructive/60 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Can students book at any time of day?', a: 'Yes. Your booking page is live 24/7. Students can book at midnight, on weekends, or on public holidays — within the availability windows you set.' },
              { q: 'How do I get paid for online bookings?', a: 'Students pay into their DriveBook wallet at booking time. You receive a weekly payout covering all completed lessons.' },
              { q: 'Can I also record cash and offline bookings?', a: 'Yes. Manual cash or phone bookings can be recorded in your dashboard. They appear alongside online bookings so your schedule is always complete.' },
              { q: 'What happens if a student cancels?', a: 'Your cancellation policy is applied automatically. Cancellations within your policy window trigger the appropriate fee, deducted from the student\'s wallet.' },
              { q: 'Is there a booking limit?', a: 'BASIC plan has a monthly booking cap. PRO and above have no booking limits.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/[0.04] border border-border rounded-xl p-5">
                <p className="font-semibold text-foreground mb-2 text-sm">{q}</p>
                <p className="text-foreground/60 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-lg font-bold text-foreground mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/why-online-booking-increases-revenue-driving-instructors', label: 'Why online booking increases revenue for driving instructors' },
              { href: '/blog/why-students-prefer-booking-driving-lessons-online', label: 'Why students prefer booking driving lessons online' },
              { href: '/blog/how-to-stop-double-bookings-driving-instructor', label: 'How to stop double bookings forever' },
              { href: '/blog/drivebook-subdomain-booking-page-explained', label: 'Your DriveBook booking page explained' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/40 hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-foreground/70 group-hover:text-foreground transition-colors">{label}</span>
                <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-violet-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-3">Your Booking Page is Ready in Minutes</h2>
            <p className="text-foreground/60 mb-6 text-sm max-w-md mx-auto">Set up your DriveBook profile, add your availability, and start taking online bookings today.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
              Start Free Trial →
            </Link>
            <p className="text-foreground/30 text-xs mt-4">No credit card required · Live in under 10 minutes</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
