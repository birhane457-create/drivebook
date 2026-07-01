import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Calendar, CreditCard, Users, Phone, Globe, BarChart3,
  Star, Zap, BookOpen, Shield, Bell, ChevronRight,
} from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'DriveBook Platform — How It Works for Driving Instructors',
  description:
    'A complete guide to the DriveBook platform. Bookings, payments, AI receptionist, student management, branding, multi-instructor tools, and revenue reporting — all explained.',
  openGraph: {
    title: 'DriveBook Platform Guide | How It Works',
    description: 'Everything the DriveBook platform does — booking, payments, AI, branding, student CRM, and school management — explained clearly.',
    url: `${BASE_URL}/platform`,
  },
  alternates: { canonical: `${BASE_URL}/platform` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/learn-to-drive" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Learn to Drive</Link>
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/platform" className="text-white px-3 py-2 rounded-lg bg-white/10 no-underline font-semibold">Platform</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-pink-500 hover:to-violet-500 transition-all">
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10 mt-16 text-center text-white/40 text-sm">
      <p>
        © {new Date().getFullYear()} DriveBook ·{' '}
        <Link href="/privacy" className="hover:text-white/60 no-underline transition-colors">Privacy</Link> ·{' '}
        <Link href="/terms" className="hover:text-white/60 no-underline transition-colors">Terms</Link>
      </p>
    </footer>
  )
}

// ── Shared section wrapper ────────────────────────────────────────────────────
function PlatformSection({
  id, icon: Icon, accent, title, subtitle, children,
}: {
  id: string
  icon: React.ElementType
  accent: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 py-14 border-b border-white/[0.06] last:border-0">
      <div className="flex items-start gap-4 mb-8">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${accent}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{title}</h2>
          <p className="text-white/50 text-sm">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function FeatureRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <ChevronRight className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-white text-sm">{label}: </span>
        <span className="text-white/60 text-sm">{desc}</span>
      </div>
    </div>
  )
}

function ArticleLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group mt-2">
      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{title}</span>
      <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 ml-3 transition-colors" />
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PlatformPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Platform', item: `${BASE_URL}/platform` },
    ],
  }

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DriveBook',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: BASE_URL,
    description: 'Driving school management software for Australian instructors. Online booking, payments, AI receptionist, student CRM, and revenue reporting.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD', description: 'Free trial available' },
    publisher: { '@type': 'Organization', name: 'DriveBook', url: BASE_URL },
  }

  // Sidebar nav items
  const nav = [
    { id: 'booking',   label: 'Booking',        Icon: Calendar },
    { id: 'students',  label: 'Students',        Icon: Users },
    { id: 'payments',  label: 'Payments',        Icon: CreditCard },
    { id: 'ai',        label: 'AI & Automation', Icon: Phone },
    { id: 'branding',  label: 'Branding',        Icon: Globe },
    { id: 'schools',   label: 'Schools',         Icon: BarChart3 },
    { id: 'reviews',   label: 'Reviews',         Icon: Star },
    { id: 'reporting', label: 'Reporting',       Icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-950 py-16 md:py-24 px-4 text-center border-b border-white/10">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="relative max-w-3xl mx-auto">
            <nav className="flex items-center justify-center gap-2 text-xs text-white/40 mb-6">
              <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
              <span>/</span>
              <span className="text-white/60">Platform</span>
            </nav>
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Platform Guide</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              How DriveBook Works
            </h1>
            <p className="text-lg text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
              A complete, plain-English guide to every part of the DriveBook platform — from booking and payments through to AI automation, branding, and school management.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {nav.map(({ id, label }) => (
                <a key={id} href={`#${id}`} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all no-underline">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 py-10">

          {/* ── BOOKING ──────────────────────────────────────────────────── */}
          <PlatformSection id="booking" icon={Calendar} accent="bg-gradient-to-br from-violet-600 to-indigo-600" title="Booking" subtitle="How students find you and book lessons">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Online booking" desc="Students book directly from your DriveBook profile or your custom domain. They see real-time availability and confirm with payment in one step." />
              <FeatureRow label="Offline booking" desc="Record cash, bank transfer, or phone bookings manually so all lessons appear in one unified calendar regardless of how they were arranged." />
              <FeatureRow label="Booking buffers" desc="Set automatic gap time between lessons — 15, 30, or 60 minutes — to allow for travel, debrief time, or recovery between sessions." />
              <FeatureRow label="Advance booking window" desc="Control how far in advance students can book (e.g. up to 8 weeks) and how close to a lesson a new booking can be placed." />
              <FeatureRow label="Slot reservation" desc="When a student begins the checkout process, the slot is temporarily held to prevent simultaneous double-booking." />
              <FeatureRow label="Booking confirmation" desc="Students receive automatic SMS and email confirmation immediately on booking. You see the booking in your dashboard instantly." />
              <FeatureRow label="Reschedule and cancel" desc="Both students and instructors can reschedule or cancel through the dashboard. Cancellation policies are enforced automatically." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/why-online-booking-increases-revenue-driving-instructors" title="Why online booking increases revenue" />
              <ArticleLink href="/blog/how-to-stop-double-bookings-driving-instructor" title="How to stop double bookings" />
              <ArticleLink href="/blog/how-to-record-offline-cash-bookings-drivebook" title="Recording offline cash bookings" />
              <ArticleLink href="/blog/managing-holidays-availability-drivebook" title="Managing holidays and availability" />
            </div>
          </PlatformSection>

          {/* ── STUDENTS ─────────────────────────────────────────────────── */}
          <PlatformSection id="students" icon={Users} accent="bg-gradient-to-br from-cyan-600 to-blue-600" title="Students" subtitle="CRM, lesson history, progress tracking, and notes">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Student records" desc="Each student has a profile with contact details, booking history, wallet balance, progress notes, and lesson feedback." />
              <FeatureRow label="Lesson notes" desc="After each lesson, instructors log what was covered and observed. Students can view their own notes from their dashboard." />
              <FeatureRow label="Progress tracking" desc="Skill areas are tracked over time. Students see their development toward PDA readiness. Instructors see patterns across all students." />
              <FeatureRow label="Student dashboard" desc="Students have their own login with upcoming bookings, wallet balance, lesson history, progress, and the ability to book directly." />
              <FeatureRow label="Guest checkout" desc="Students can book without creating an account. An account is created automatically and they can set a password later." />
              <FeatureRow label="Student notifications" desc="Automatic SMS and email reminders before each lesson. Notification preferences can be managed by the student." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/student-progress-tracking-lesson-feedback-drivebook" title="Progress tracking makes you a better instructor" />
              <ArticleLink href="/blog/how-student-dashboards-improve-lesson-retention" title="How student dashboards improve retention" />
              <ArticleLink href="/blog/how-to-use-drivebook-as-a-student" title="How to use DriveBook as a student" />
              <ArticleLink href="/blog/is-student-data-secure-drivebook" title="Is student data secure on DriveBook?" />
            </div>
          </PlatformSection>

          {/* ── PAYMENTS ─────────────────────────────────────────────────── */}
          <PlatformSection id="payments" icon={CreditCard} accent="bg-gradient-to-br from-emerald-600 to-teal-600" title="Payments" subtitle="Wallet, packages, Stripe, payouts, and refunds">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Student wallet" desc="Students load credit via card payment. Lesson costs are deducted automatically at booking. Balance is always visible in the dashboard." />
              <FeatureRow label="Lesson packages" desc="Instructors can offer discounted multi-lesson packages (5, 10, or 20 hours). Packages are pre-purchased and deducted per lesson." />
              <FeatureRow label="Stripe processing" desc="All card payments are processed through Stripe. PCI-compliant. No card data touches DriveBook servers." />
              <FeatureRow label="Weekly payouts" desc="Instructors receive weekly payouts for lessons completed in the prior week. Payout includes lesson fees minus platform commission." />
              <FeatureRow label="Commission structure" desc="Platform commission is deducted from each lesson payout. The rate is tier-dependent and shown clearly in the instructor dashboard." />
              <FeatureRow label="Refunds" desc="Cancellation refunds are returned to the student wallet automatically. Refunds to original payment method are processed on request." />
              <FeatureRow label="Pending payment flow" desc="If a student has insufficient wallet balance, the booking is created as Pending Payment and the student receives a top-up prompt." />
              <FeatureRow label="Offline payment recording" desc="Cash and bank transfer payments can be recorded manually and tracked alongside online transactions in the revenue dashboard." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/how-drivebook-wallet-works" title="How the student wallet works" />
              <ArticleLink href="/blog/how-lesson-packages-improve-cash-flow-driving-instructors" title="How packages improve cash flow" />
              <ArticleLink href="/blog/understanding-weekly-instructor-payouts-drivebook" title="Weekly payouts explained" />
              <ArticleLink href="/blog/how-drivebook-handles-refunds" title="How refunds work on DriveBook" />
            </div>
          </PlatformSection>

          {/* ── AI ───────────────────────────────────────────────────────── */}
          <PlatformSection id="ai" icon={Phone} accent="bg-gradient-to-br from-pink-600 to-rose-600" title="AI & Automation" subtitle="AI phone receptionist, SMS reminders, and voice booking">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="AI phone receptionist" desc="A 24/7 AI answering service that checks your real-time availability, books lessons over the phone, and sends the student an SMS confirmation — without you doing anything." />
              <FeatureRow label="Voice booking" desc="Students call your DriveBook number, speak naturally with the AI, confirm their lesson time, and receive a booking ID. Works around the clock." />
              <FeatureRow label="Real-time calendar access" desc="The AI reads your live availability before offering any time slot. It cannot double-book or offer slots outside your working hours." />
              <FeatureRow label="Multi-language support" desc="The AI can detect and respond in languages other than English, reducing the barrier for students who prefer to communicate in their first language." />
              <FeatureRow label="SMS reminders" desc="Automatic lesson reminders sent by SMS — typically 24 hours before and again on lesson day. Reduces no-shows without any instructor action." />
              <FeatureRow label="Booking confirmation SMS" desc="Every confirmed booking triggers an automatic SMS to the student with date, time, instructor name, and pickup address." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/drivebook-ai-phone-receptionist-driving-instructors" title="How the AI receptionist books lessons" />
              <ArticleLink href="/blog/ai-voice-receptionist-vs-human-receptionist-driving-school" title="AI receptionist vs human receptionist" />
              <ArticleLink href="/blog/how-ai-reduces-missed-calls-lost-bookings-driving-instructors" title="How AI reduces missed calls" />
              <ArticleLink href="/blog/why-sms-reminders-reduce-no-shows-driving-lessons" title="Why SMS reminders reduce no-shows" />
            </div>
          </PlatformSection>

          {/* ── BRANDING ─────────────────────────────────────────────────── */}
          <PlatformSection id="branding" icon={Globe} accent="bg-gradient-to-br from-indigo-600 to-blue-600" title="Branding" subtitle="Subdomain, custom domain, logo, and business profile">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Subdomain booking page" desc="Every instructor gets a public booking page at [yourname].drivebook.com.au — live immediately, no setup required, indexed by Google." />
              <FeatureRow label="Custom domain" desc="On PRO and above, point your own domain (e.g. perthdriving.com.au) to your DriveBook booking page. Full DNS setup guide provided." />
              <FeatureRow label="Logo and brand colours" desc="Upload your logo and set your brand colour. Applied to your booking page, email confirmations, and student dashboard header." />
              <FeatureRow label="Public instructor profile" desc="Your profile includes bio, credentials, service area, vehicle type, pricing, languages, availability preview, and student reviews." />
              <FeatureRow label="Google indexing" desc="DriveBook profiles include full JSON-LD structured data and are crawlable by Google. Profiles appear in local search results." />
              <FeatureRow label="School branding" desc="Driving schools can apply school-level branding across all instructor profiles — consistent logo, colours, and business name." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/drivebook-subdomain-booking-page-explained" title="Your DriveBook booking page explained" />
              <ArticleLink href="/blog/connecting-your-custom-domain-drivebook" title="How to connect your custom domain" />
              <ArticleLink href="/blog/how-google-finds-your-drivebook-profile" title="How Google finds your profile" />
              <ArticleLink href="/blog/drivebook-custom-domain-branding-driving-instructors" title="Branding guide for instructors" />
            </div>
          </PlatformSection>

          {/* ── SCHOOLS ──────────────────────────────────────────────────── */}
          <PlatformSection id="schools" icon={BarChart3} accent="bg-gradient-to-br from-violet-700 to-purple-700" title="Multi-Instructor Schools" subtitle="Admin dashboard, instructor management, and staff controls">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Admin dashboard" desc="School owners see all instructor calendars, bookings, and performance from one central view. No need to ask each instructor for updates." />
              <FeatureRow label="Per-instructor calendars" desc="Each instructor manages their own availability. The admin can view but instructors operate independently within school settings." />
              <FeatureRow label="Instructor performance reports" desc="Booking completion rate, cancellation rate, revenue generated, student count, and review scores — per instructor, per period." />
              <FeatureRow label="Student assignment" desc="Assign new students to specific instructors from the admin panel. Reassign students between instructors when needed." />
              <FeatureRow label="Centralised payouts" desc="Admin sees each instructor's payout calculation. Weekly payout runs cover all instructors in the school with individual breakdowns." />
              <FeatureRow label="Staff governance" desc="Role-based access on BUSINESS tier. Admin, manager, and instructor roles with different permission levels." />
              <FeatureRow label="School-level branding" desc="One logo and brand colour applied to all instructor profiles under the school. Consistent presence across the whole team." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/how-to-manage-five-driving-instructors-one-dashboard" title="Managing 5 instructors from one dashboard" />
              <ArticleLink href="/blog/growing-driving-school-one-instructor-to-ten" title="Growing from 1 instructor to 10" />
              <ArticleLink href="/blog/how-to-scale-driving-school-systems" title="Systems you need before you scale" />
              <ArticleLink href="/blog/how-to-onboard-new-instructor-driving-school" title="Onboarding a new instructor" />
            </div>
          </PlatformSection>

          {/* ── REVIEWS ──────────────────────────────────────────────────── */}
          <PlatformSection id="reviews" icon={Star} accent="bg-gradient-to-br from-yellow-500 to-orange-500" title="Reviews" subtitle="Collecting, displaying, and managing student reviews">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Post-lesson review requests" desc="After a lesson is marked complete, students can be prompted to leave a review. The request is sent automatically without instructor action." />
              <FeatureRow label="Verified reviews only" desc="Only students who have completed a booking can leave a review. This prevents fake reviews from people who haven't used the service." />
              <FeatureRow label="Public review display" desc="Reviews appear on the instructor's public profile with star rating, date, and reviewer first name. Visible to all prospective students." />
              <FeatureRow label="Review moderation" desc="Instructors can flag reviews that appear to violate guidelines. DriveBook reviews flags before actioning." />
              <FeatureRow label="Admin review oversight" desc="School owners can see reviews across all instructors in their school. Useful for identifying patterns in student satisfaction." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/building-five-star-reputation-driving-instructor" title="Building a five-star reputation" />
              <ArticleLink href="/blog/why-reviews-help-you-rank-higher-driving-instructor" title="Why reviews help you rank higher" />
            </div>
          </PlatformSection>

          {/* ── REPORTING ────────────────────────────────────────────────── */}
          <PlatformSection id="reporting" icon={BarChart3} accent="bg-gradient-to-br from-slate-600 to-slate-700" title="Reporting & Revenue" subtitle="Income tracking, payout history, and business insights">
            <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] border border-white/10 px-5 mb-6">
              <FeatureRow label="Revenue dashboard" desc="Total revenue, lessons completed, and average lesson value by day, week, or month. Filterable by instructor for school accounts." />
              <FeatureRow label="Payout history" desc="Every weekly payout is recorded with a full breakdown: lessons included, commission deducted, refunds applied, and net payout." />
              <FeatureRow label="Booking analytics" desc="Booking volume over time, cancellation rate, peak booking days, and lesson duration breakdown." />
              <FeatureRow label="Student metrics" desc="Active students, new students per period, average lessons per student, and students approaching PDA readiness." />
              <FeatureRow label="Data export" desc="Revenue and booking data can be exported for use in accounting software or provided to a tax agent at year end." />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <ArticleLink href="/blog/how-to-track-driving-school-revenue" title="Tracking revenue without an accountant" />
              <ArticleLink href="/blog/monitoring-instructor-performance-driving-school" title="Monitoring instructor performance" />
            </div>
          </PlatformSection>

          {/* Subscription plans summary */}
          <section className="py-14">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-violet-600 flex items-center justify-center shrink-0 shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Subscription Plans</h2>
                <p className="text-white/50 text-sm">Four tiers for every stage of your business</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { name: 'BASIC', for: 'Solo instructors starting out', features: ['Booking page', 'Online booking', 'Reminders', 'Wallet payments', 'Student records'] },
                { name: 'PRO', for: 'Established solo instructors', features: ['Everything in BASIC', 'AI phone receptionist', 'Custom domain', 'Revenue analytics', 'Priority support'] },
                { name: 'STUDIO', for: 'Small schools (2–6 instructors)', features: ['Everything in PRO', 'Multi-instructor dashboard', 'School branding', 'Per-instructor reports', 'Centralised payouts'] },
                { name: 'BUSINESS', for: 'Larger schools & groups', features: ['Everything in STUDIO', 'Unlimited instructors', 'Role-based access', 'Advanced reporting', 'Dedicated support'] },
              ].map(plan => (
                <div key={plan.name} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 transition-all">
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1">{plan.name}</p>
                  <p className="text-white/50 text-xs mb-4 leading-snug">{plan.for}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex gap-2 text-xs text-white/70">
                        <span className="text-emerald-400 shrink-0">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <ArticleLink href="/blog/drivebook-subscription-plans-explained" title="Full subscription plan guide →" />
          </section>

          {/* Security note */}
          <section className="py-8 border-t border-white/[0.06]">
            <div className="flex items-start gap-4">
              <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-2">Data Security & Privacy</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Student and instructor data is stored securely with access controls, encrypted in transit (TLS), and never sold to third parties.
                  Payment data is handled entirely by Stripe — no card details touch DriveBook servers.
                  Session data is protected with industry-standard authentication.
                </p>
                <ArticleLink href="/blog/is-student-data-secure-drivebook" title="Is student data secure on DriveBook?" />
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="py-8 border-t border-white/[0.06]">
            <div className="flex items-start gap-4">
              <Bell className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-2">Notifications</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-3">
                  DriveBook sends automatic notifications at key moments — booking confirmed, lesson reminder (24 hr and same day), cancellation processed, payout sent, and package expiry warning.
                  Notification preferences are manageable from the student and instructor dashboards.
                </p>
              </div>
            </div>
          </section>

          {/* Docs callout */}
          <section className="py-8 border-t border-white/[0.06]">
            <div className="flex items-start gap-4">
              <BookOpen className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-2">Further Reading</h3>
                <p className="text-white/60 text-sm mb-4">Deep-dive guides on specific platform areas.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <ArticleLink href="/blog/setting-up-your-drivebook-profile" title="Setting up your DriveBook profile" />
                  <ArticleLink href="/blog/drivebook-platform-overview-driving-instructors-australia" title="Plain-English platform overview" />
                  <ArticleLink href="/blog/does-drivebook-lock-me-in" title="Contracts, cancellation, and commitment" />
                  <ArticleLink href="/blog/can-i-export-my-students-drivebook" title="Can I export my students and data?" />
                  <ArticleLink href="/blog/drivebook-vs-google-calendar-driving-instructors" title="DriveBook vs Google Calendar" />
                  <ArticleLink href="/blog/drivebook-vs-paper-diary-driving-instructor" title="DriveBook vs paper diary" />
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-10">
            <div className="rounded-2xl bg-gradient-to-br from-pink-900/60 to-violet-900/60 border border-pink-500/30 p-10 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Start Your Free Trial</h2>
              <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">
                Full PRO features during your trial. No credit card required to start.
              </p>
              <Link
                href="/teach-with-drivebook"
                className="inline-block bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20"
              >
                Get Started Free →
              </Link>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
