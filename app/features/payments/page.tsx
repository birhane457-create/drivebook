import type { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, CheckCircle, ChevronRight, Zap, Shield, Clock, BarChart3, Package } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Online Payments for Driving Instructors — Wallet, Packages & Payouts | DriveBook',
  description:
    'DriveBook handles all payment collection, lesson packages, weekly instructor payouts, and refunds. Students pay upfront. You get paid automatically. Powered by Stripe.',
  openGraph: {
    title: 'Payment System for Driving Instructors | DriveBook',
    description: 'Upfront lesson payments, prepaid packages, automatic weekly payouts. No invoice chasing. Powered by Stripe.',
    url: `${BASE_URL}/features/payments`,
  },
  alternates: { canonical: `${BASE_URL}/features/payments` },
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
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-emerald-500 hover:to-teal-500 transition-all">Start Free Trial</Link>
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

export default function PaymentsPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'Payments', item: `${BASE_URL}/features/payments` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How do students pay for lessons on DriveBook?', acceptedAnswer: { '@type': 'Answer', text: 'Students load credit into their DriveBook wallet using a card payment. When they book a lesson, the cost is deducted from their wallet automatically. They never need to pay again for each individual lesson once the wallet is loaded.' } },
      { '@type': 'Question', name: 'When do instructors get paid?', acceptedAnswer: { '@type': 'Answer', text: 'Instructors receive a weekly payout every Tuesday covering all completed lessons from the prior week. The payout is automatically calculated after deducting the platform commission.' } },
      { '@type': 'Question', name: 'What payment methods do students use?', acceptedAnswer: { '@type': 'Answer', text: 'Students pay via credit or debit card through Stripe. All major Australian cards are accepted. DriveBook never stores card details — all payment processing is handled by Stripe.' } },
      { '@type': 'Question', name: 'Can I record cash payments in DriveBook?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Cash and bank transfer payments can be recorded manually in your DriveBook dashboard. They appear in your revenue records alongside online payments.' } },
      { '@type': 'Question', name: 'How are refunds handled?', acceptedAnswer: { '@type': 'Answer', text: 'Cancellation refunds are returned to the student\'s wallet automatically. Refunds to the original payment card are available on request through DriveBook support.' } },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950 py-20 md:py-28 px-4">
          <div className="absolute top-0 left-1/4 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
              <span>/</span>
              <span className="text-white/60">Payments</span>
            </nav>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Powered by Stripe · PCI compliant</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Get Paid Automatically.<br />
              <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Chase Nothing.</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl leading-relaxed">
              Students pay upfront when booking. Lesson costs are deducted automatically. You receive a weekly payout without lifting a finger.
            </p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-emerald-500/20">
              Start Free Trial →
            </Link>
          </div>
        </section>

        {/* How money flows */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-3">How Money Flows</h2>
          <p className="text-white/50 text-center text-sm mb-12">From student card to instructor bank account — fully automated.</p>
          <div className="space-y-3 max-w-2xl mx-auto">
            {[
              { n: '1', label: 'Student loads wallet', detail: 'Student pays via card into their DriveBook wallet. Stripe processes the payment. Card details never touch DriveBook servers.' },
              { n: '2', label: 'Student books a lesson', detail: 'Lesson cost is deducted from wallet at booking time. Booking is confirmed. Student receives SMS confirmation.' },
              { n: '3', label: 'Lesson takes place', detail: 'Instructor marks the lesson as complete in their dashboard. The booking status updates to Completed.' },
              { n: '4', label: 'Weekly payout runs', detail: 'Every Tuesday, DriveBook calculates all completed lessons from the prior week, deducts platform commission, and initiates the payout to the instructor.' },
              { n: '5', label: 'Instructor receives payment', detail: 'Funds arrive in the instructor\'s bank account. Detailed payout breakdown visible in the DriveBook dashboard.' },
            ].map(({ n, label, detail }) => (
              <div key={n} className="flex gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/30 transition-all">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-sm font-bold text-white shrink-0">{n}</div>
                <div>
                  <p className="font-semibold text-white text-sm mb-0.5">{label}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="bg-white/[0.02] border-y border-white/10 py-14 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Everything in the Payment System</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { icon: CreditCard, title: 'Student wallet', desc: 'Pre-loaded credit model. Students top up and lessons are automatically deducted. No individual payments per lesson.' },
                { icon: Package, title: 'Lesson packages', desc: 'Offer 5, 10, or 20-hour packages at a discount. Students buy upfront; hours are deducted per lesson. Improves your cash flow and their commitment.' },
                { icon: Clock, title: 'Weekly automatic payouts', desc: 'Every Tuesday for the prior week\'s completed lessons. Consistent, predictable, no manual action.' },
                { icon: BarChart3, title: 'Revenue dashboard', desc: 'Total revenue, completed lessons, payout history, and per-instructor breakdown (school plans). Export for your accountant.' },
                { icon: Shield, title: 'Stripe-powered security', desc: 'PCI DSS Level 1 compliant. No card data on DriveBook servers. Industry-standard fraud protection.' },
                { icon: CheckCircle, title: 'Automatic refund handling', desc: 'Cancellation fees are charged per your policy. Refunds returned to student wallet immediately, or to card on request.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/30 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">{title}</p>
                    <p className="text-white/55 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-12 pb-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'How do students pay?', a: 'Students load credit into their DriveBook wallet via card. Lesson costs are deducted from the wallet at booking — no individual payments per lesson.' },
              { q: 'When do instructors get paid?', a: 'Weekly payouts every Tuesday, covering all completed lessons from the prior week. Automatic — no action required.' },
              { q: 'What payment methods are accepted?', a: 'Credit and debit cards via Stripe. All major Australian cards accepted. No card data stored on DriveBook.' },
              { q: 'Can I record cash payments?', a: 'Yes. Cash and bank transfer payments can be recorded manually and appear in your revenue records alongside online payments.' },
              { q: 'How are refunds handled?', a: 'Cancellation refunds go to the student wallet automatically. Refunds to the original card are available on request through support.' },
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
              { href: '/blog/how-drivebook-wallet-works', title: 'How the DriveBook student wallet works' },
              { href: '/blog/understanding-weekly-instructor-payouts-drivebook', title: 'Understanding weekly instructor payouts' },
              { href: '/blog/how-lesson-packages-improve-cash-flow-driving-instructors', title: 'How lesson packages improve cash flow' },
              { href: '/blog/why-accepting-online-payments-gets-you-more-serious-students', title: 'Why online payments get you more serious students' },
            ].map(({ href, title }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{title}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-emerald-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900/60 to-teal-900/60 border border-emerald-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Stop Chasing Payments</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">DriveBook's payment system is included on all plans. Students pay upfront, you get paid weekly.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-emerald-500/20">
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
