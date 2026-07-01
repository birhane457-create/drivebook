import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Zap, Users, BarChart3, Globe, Phone, CreditCard, Star, Calendar } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Driving Instructor Hub — Grow Your Driving School | DriveBook',
  description:
    'The complete resource for driving instructors in Australia. Business setup, marketing, Google, AI automation, payments, scaling, and everything in between.',
  openGraph: {
    title: 'Driving Instructor Resource Hub | DriveBook',
    description: 'Guides for driving instructors covering business setup, marketing, bookings, payments, AI automation, and scaling.',
    url: `${BASE_URL}/for-instructors`,
  },
  alternates: { canonical: `${BASE_URL}/for-instructors` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/learn-to-drive" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Learn to Drive</Link>
          <Link href="/pda-guide" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">PDA Guide</Link>
          <Link href="/for-instructors" className="text-white px-3 py-2 rounded-lg bg-white/10 no-underline font-semibold">For Instructors</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-pink-500 hover:to-violet-500 transition-all">Join DriveBook</Link>
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

function ArticleLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
      <span className="text-sm text-white/80 group-hover:text-white transition-colors">{title}</span>
      <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-pink-400 shrink-0 ml-3 transition-colors" />
    </Link>
  )
}

function TopicCard({ icon: Icon, title, colour, articles }: { icon: React.ElementType; title: string; colour: string; articles: { href: string; title: string }[] }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colour}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-bold text-white">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {articles.map(a => (
          <ArticleLink key={a.href} href={a.href} title={a.title} />
        ))}
      </div>
    </div>
  )
}

export default function ForInstructorsPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'For Instructors', item: `${BASE_URL}/for-instructors` },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-pink-900 via-violet-900 to-slate-950 py-20 md:py-28 px-4 text-center">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-violet-500/15 rounded-full blur-3xl translate-y-1/2" />
          <div className="relative max-w-3xl mx-auto">
            <nav className="flex items-center justify-center gap-2 text-xs text-white/40 mb-6">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <span className="text-white/60">For Instructors</span>
            </nav>
            <p className="text-sm font-semibold text-pink-400 uppercase tracking-wider mb-4">Instructor Resource Hub</p>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-5 leading-tight">
              Run a Better<br />
              <span className="bg-gradient-to-r from-pink-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Driving School</span>
            </h1>
            <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              Practical guides on business setup, marketing, bookings, AI automation, payments, and scaling — for solo instructors and school owners.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/teach-with-drivebook" className="bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-8 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20">
                Join DriveBook →
              </Link>
              <Link href="/platform" className="bg-white/10 hover:bg-white/20 text-white px-8 py-3.5 rounded-xl font-semibold no-underline transition-all border border-white/10">
                Platform Overview →
              </Link>
            </div>
          </div>
        </section>

        {/* Platform capability strip */}
        <section className="bg-white/[0.03] border-y border-white/10 py-8 px-4 overflow-x-auto">
          <div className="max-w-5xl mx-auto flex items-center justify-around gap-6 min-w-max md:min-w-0">
            {[
              { icon: Calendar, label: 'Online Booking', href: '/features/online-booking' },
              { icon: Phone, label: 'AI Receptionist', href: '/features/ai-receptionist' },
              { icon: CreditCard, label: 'Payments', href: '/features/payments' },
              { icon: Users, label: 'Student CRM', href: '/features/student-progress' },
              { icon: Star, label: 'Reviews', href: '/platform#reviews' },
              { icon: Globe, label: 'Custom Domain', href: '/features/custom-domain' },
              { icon: BarChart3, label: 'Revenue Reports', href: '/platform#reporting' },
              { icon: Zap, label: 'Multi-Instructor', href: '/features/multi-instructor' },
            ].map(({ icon: Icon, label, href }) => (
              <Link key={label} href={href} className="flex flex-col items-center gap-2 text-center no-underline group">
                <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-pink-500/20 group-hover:border-pink-500/30 border border-transparent flex items-center justify-center transition-all">
                  <Icon className="h-4 w-4 text-pink-400" />
                </div>
                <span className="text-white/60 group-hover:text-white text-xs whitespace-nowrap transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Topic Grid */}
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Everything You Need to Grow</h2>
            <p className="text-white/50">Browse by topic or read from top to bottom — every guide is practical and built for Australian driving instructors.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">

            <TopicCard
              icon={Zap}
              title="Starting Your Business"
              colour="bg-gradient-to-br from-amber-500 to-orange-600"
              articles={[
                { href: '/blog/starting-your-own-driving-school-australia', title: 'Starting a Driving School in Australia' },
                { href: '/blog/driving-school-vs-independent-instructor', title: 'School vs Independent Instructor' },
                { href: '/blog/how-to-get-your-first-students-driving-instructor', title: 'Getting Your First Students' },
                { href: '/blog/pricing-your-driving-lessons-guide-instructors', title: 'How to Price Your Lessons' },
                { href: '/blog/should-driving-instructors-use-their-own-car', title: 'Your Car vs Student\'s Car' },
                { href: '/blog/tax-deductions-driving-instructors-australia', title: 'Tax Deductions for Instructors' },
              ]}
            />

            <TopicCard
              icon={BarChart3}
              title="Marketing & Reviews"
              colour="bg-gradient-to-br from-pink-500 to-rose-600"
              articles={[
                { href: '/blog/complete-guide-marketing-your-driving-school', title: 'Complete Marketing Guide' },
                { href: '/blog/how-to-use-google-business-profile-driving-instructor', title: 'Google Business Profile Guide' },
                { href: '/blog/how-to-market-driving-school-social-media', title: 'Social Media — What Works' },
                { href: '/blog/building-five-star-reputation-driving-instructor', title: 'Building a Five-Star Reputation' },
                { href: '/blog/why-reviews-help-you-rank-higher-driving-instructor', title: 'Why Reviews Help You Rank' },
                { href: '/blog/how-to-grow-through-referrals-driving-instructor', title: 'Growing Through Referrals' },
                { href: '/blog/how-to-grow-your-driving-school-without-advertising', title: 'Grow Without Advertising' },
              ]}
            />

            <TopicCard
              icon={Phone}
              title="AI & Automation"
              colour="bg-gradient-to-br from-cyan-500 to-blue-600"
              articles={[
                { href: '/blog/drivebook-ai-phone-receptionist-driving-instructors', title: 'How the AI Receptionist Works' },
                { href: '/blog/ai-voice-receptionist-vs-human-receptionist-driving-school', title: 'AI vs Human Receptionist' },
                { href: '/blog/can-ai-really-book-driving-lessons', title: 'Can AI Really Book Lessons?' },
                { href: '/blog/how-ai-reduces-missed-calls-lost-bookings-driving-instructors', title: 'How AI Reduces Missed Calls' },
                { href: '/blog/ai-for-small-driving-schools-is-it-worth-it', title: 'AI for Small Schools — Worth It?' },
                { href: '/blog/why-sms-reminders-reduce-no-shows-driving-lessons', title: 'Why SMS Reminders Reduce No-Shows' },
              ]}
            />

            <TopicCard
              icon={CreditCard}
              title="Payments & Finance"
              colour="bg-gradient-to-br from-emerald-500 to-teal-600"
              articles={[
                { href: '/blog/cash-vs-card-vs-online-payment-driving-lessons', title: 'Cash vs Card vs Online Payment' },
                { href: '/blog/why-accepting-online-payments-gets-you-more-serious-students', title: 'Online Payments = More Serious Students' },
                { href: '/blog/how-lesson-packages-improve-cash-flow-driving-instructors', title: 'How Packages Improve Cash Flow' },
                { href: '/blog/why-prepaid-packages-reduce-cancellations-driving-lessons', title: 'Prepaid Packages Reduce Cancellations' },
                { href: '/blog/understanding-weekly-instructor-payouts-drivebook', title: 'Weekly Payouts Explained' },
                { href: '/blog/how-to-track-driving-school-revenue', title: 'Tracking Revenue Without an Accountant' },
                { href: '/blog/how-drivebook-handles-refunds', title: 'How Refunds Work on DriveBook' },
              ]}
            />

            <TopicCard
              icon={Calendar}
              title="Bookings & Scheduling"
              colour="bg-gradient-to-br from-violet-500 to-purple-600"
              articles={[
                { href: '/blog/why-online-booking-increases-revenue-driving-instructors', title: 'Why Online Booking Increases Revenue' },
                { href: '/blog/how-to-stop-double-bookings-driving-instructor', title: 'Stop Double Bookings Forever' },
                { href: '/blog/managing-last-minute-cancellations-driving-instructors', title: 'Managing Last-Minute Cancellations' },
                { href: '/blog/how-to-set-a-cancellation-policy-driving-instructor', title: 'Setting a Cancellation Policy' },
                { href: '/blog/managing-holidays-availability-drivebook', title: 'Managing Holidays on DriveBook' },
                { href: '/blog/how-to-record-offline-cash-bookings-drivebook', title: 'Recording Offline Cash Bookings' },
              ]}
            />

            <TopicCard
              icon={Globe}
              title="Branding & Online Presence"
              colour="bg-gradient-to-br from-indigo-500 to-blue-600"
              articles={[
                { href: '/blog/drivebook-custom-domain-branding-driving-instructors', title: 'Your Own Website Without Building One' },
                { href: '/blog/custom-domain-vs-social-media-which-builds-more-trust', title: 'Custom Domain vs Social Media' },
                { href: '/blog/why-every-driving-instructor-needs-their-own-booking-website', title: 'Why Every Instructor Needs a Booking Site' },
                { href: '/blog/how-to-build-a-driving-school-brand-students-remember', title: 'Build a Brand Students Remember' },
                { href: '/blog/how-to-write-a-driving-instructor-bio', title: 'How to Write a Winning Bio' },
                { href: '/blog/how-to-optimise-your-instructor-profile-more-bookings', title: 'Optimise Your Profile for More Bookings' },
                { href: '/blog/how-google-finds-your-drivebook-profile', title: 'How Google Finds Your Profile' },
              ]}
            />

            <TopicCard
              icon={Users}
              title="Students & Retention"
              colour="bg-gradient-to-br from-rose-500 to-pink-600"
              articles={[
                { href: '/blog/how-to-increase-student-retention-driving-instructors', title: 'Increasing Student Retention' },
                { href: '/blog/how-student-dashboards-improve-lesson-retention', title: 'How Student Dashboards Help Retention' },
                { href: '/blog/student-progress-tracking-lesson-feedback-drivebook', title: 'Progress Tracking Makes You Better' },
                { href: '/blog/how-to-deal-with-difficult-students-driving-instructor', title: 'Dealing with Difficult Students' },
                { href: '/blog/how-to-handle-student-complaints-driving-instructor', title: 'Handling Student Complaints' },
                { href: '/blog/assigning-students-to-right-instructor-driving-school', title: 'Assigning Students to the Right Instructor' },
              ]}
            />

            <TopicCard
              icon={BarChart3}
              title="Scaling & Multi-Instructor"
              colour="bg-gradient-to-br from-violet-600 to-indigo-700"
              articles={[
                { href: '/blog/growing-driving-school-one-instructor-to-ten', title: 'Growing from 1 to 10 Instructors' },
                { href: '/blog/how-to-manage-five-driving-instructors-one-dashboard', title: 'Manage 5 Instructors from One Dashboard' },
                { href: '/blog/managing-multiple-instructors-driving-school', title: 'Managing Multiple Instructors' },
                { href: '/blog/how-to-scale-driving-school-systems', title: 'Systems You Need Before You Scale' },
                { href: '/blog/monitoring-instructor-performance-driving-school', title: 'Monitoring Instructor Performance' },
                { href: '/blog/giving-each-instructor-their-own-calendar-driving-school', title: 'Each Instructor\'s Own Calendar' },
                { href: '/blog/how-to-onboard-new-instructor-driving-school', title: 'Onboarding a New Instructor' },
                { href: '/blog/managing-instructor-burnout-driving-school', title: 'Managing Instructor Burnout' },
              ]}
            />

          </div>
        </section>

        {/* DriveBook callout */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-r from-pink-900/40 to-violet-900/40 border border-pink-500/20 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to Put This Into Practice?</h2>
              <p className="text-white/60 leading-relaxed mb-6">
                DriveBook brings together online booking, AI receptionist, payments, student tracking, branding, and revenue reporting in one platform built specifically for Australian driving instructors.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/teach-with-drivebook" className="bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-6 py-3 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20 text-sm">
                  Join DriveBook →
                </Link>
                <Link href="/platform" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold no-underline transition-all border border-white/10 text-sm">
                  See the Platform →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {['Online bookings', 'AI phone receptionist', 'Wallet payments', 'Custom domain', 'Student progress', 'Revenue dashboard'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/70">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  {f}
                </div>
              ))}
            </div>
          </div>
          {/* Comparison links */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-white/40 text-xs mb-3">Comparing options?</p>
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/compare/google-calendar', label: 'vs Google Calendar' },
                { href: '/compare/paper-diary', label: 'vs Paper Diary' },
                { href: '/compare/calendly', label: 'vs Calendly' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/10 no-underline transition-all">
                  DriveBook {label} →
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
