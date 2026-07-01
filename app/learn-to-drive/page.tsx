import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, CheckCircle, Clock, MapPin, Star, ChevronRight } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Learn to Drive in Western Australia — Complete Learner Driver Guide',
  description:
    'Everything you need to learn to drive in WA — learner permit, logbook hours, HPT, PDA, choosing an instructor, lesson costs, and tips for passing first time.',
  openGraph: {
    title: 'Learn to Drive in WA — Complete Learner Driver Hub | DriveBook',
    description:
      'The most complete guide to getting your WA driver licence. Permit, logbook, HPT, PDA, instructor tips and more.',
    url: `${BASE_URL}/learn-to-drive`,
  },
  alternates: { canonical: `${BASE_URL}/learn-to-drive` },
}

// ── Shared header/footer wrappers ──────────────────────────────────────────────

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline">
            <Logo size={34} dark />
          </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/learn-to-drive" className="text-white px-3 py-2 rounded-lg bg-white/10 no-underline font-semibold">Learn to Drive</Link>
          <Link href="/pda-guide" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">PDA Guide</Link>
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
          <Link href="/book" className="ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-violet-500 hover:to-indigo-500 transition-all">
            Find Instructor
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10 mt-16 text-center text-white/40 text-sm">
      <p>© {new Date().getFullYear()} DriveBook · <Link href="/privacy" className="hover:text-white/60 no-underline transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-white/60 no-underline transition-colors">Terms</Link></p>
    </footer>
  )
}

// ── Section components ─────────────────────────────────────────────────────────

function StepCard({ num, title, desc, href }: { num: string; title: string; desc: string; href?: string }) {
  const inner = (
    <div className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.08] transition-all group">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-lg shadow-violet-500/20">
        {num}
      </div>
      <div>
        <p className="font-semibold text-white group-hover:text-violet-200 transition-colors mb-1">{title}</p>
        <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
      </div>
      {href && <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 self-center ml-auto transition-colors" />}
    </div>
  )
  return href ? <Link href={href} className="no-underline block">{inner}</Link> : <div>{inner}</div>
}

function ArticleLink({ href, title, tag }: { href: string; title: string; tag: string }) {
  return (
    <Link href={href} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${tag === 'Guide' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}`}>{tag}</span>
        <span className="text-sm font-medium text-white group-hover:text-violet-200 transition-colors truncate">{title}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 ml-3 transition-colors" />
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LearnToDrivePage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Learn to Drive', item: `${BASE_URL}/learn-to-drive` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How many hours do I need before my PDA in WA?', acceptedAnswer: { '@type': 'Answer', text: 'You need a minimum of 50 hours of supervised driving, including at least 5 hours of night driving, recorded in your learner driver logbook.' } },
      { '@type': 'Question', name: 'How much do driving lessons cost in Perth?', acceptedAnswer: { '@type': 'Answer', text: 'Driving lessons in Perth typically cost between $60 and $100 per hour depending on the instructor, vehicle type, and location. Lesson packages offer savings of 5–12%.' } },
      { '@type': 'Question', name: 'Do I need to pass the HPT before the PDA?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Hazard Perception Test (HPT) must be passed before you can book your Practical Driving Assessment (PDA) in Western Australia.' } },
      { '@type': 'Question', name: 'Can I learn in an automatic car?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. You can learn in an automatic vehicle, but your licence will be restricted to automatic vehicles only. A manual licence covers both manual and automatic cars.' } },
      { '@type': 'Question', name: 'How long does it take to get a licence in WA?', acceptedAnswer: { '@type': 'Answer', text: 'You must hold your learner permit for a minimum of 6 months before taking the PDA. Most learners take 9–18 months from permit to provisional licence depending on how frequently they practise.' } },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-950 py-20 md:py-28 px-4 text-center">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl translate-y-1/2" />
          <div className="relative max-w-3xl mx-auto">
            <nav className="flex items-center justify-center gap-2 text-xs text-white/40 mb-6">
              <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
              <span>/</span>
              <span className="text-white/60">Learn to Drive</span>
            </nav>
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Complete Learner Driver Hub</p>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-5 leading-tight">
              Learn to Drive in<br />
              <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">Western Australia</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              Everything you need — from your learner permit to passing your PDA. Guides, tips, and everything in between.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/book" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-8 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
                Find an Instructor →
              </Link>
              <Link href="/pda-guide" className="bg-white/10 hover:bg-white/20 text-white px-8 py-3.5 rounded-xl font-semibold no-underline transition-all border border-white/10">
                PDA Guide →
              </Link>
            </div>
          </div>
        </section>

        {/* Road to Licence — Steps */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Your Roadmap</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">The Road to Your Licence</h2>
            <p className="text-white/60">Five stages every WA learner driver goes through.</p>
          </div>
          <div className="space-y-3">
            <StepCard num="1" title="Get Your Learner Permit" desc="Sit the Theory Test at a DoT service centre. You must be at least 16 years old and pass a 30-question road rules test." />
            <StepCard num="2" title="Complete Your 50-Hour Logbook" desc="Log at least 50 hours of supervised driving — including 5 hours at night — with a licensed supervisor or qualified instructor." href="/blog/logbook-tips-wa-learner-drivers" />
            <StepCard num="3" title="Pass the Hazard Perception Test (HPT)" desc="A computer-based video test at a DoT centre. Must be passed before you can book your PDA." href="/blog/hazard-perception-test-guide-wa" />
            <StepCard num="4" title="Book and Pass Your PDA" desc="The on-road practical assessment. 30–45 minutes with an approved assessor on real WA roads." href="/pda-guide" />
            <StepCard num="5" title="Get Your Provisional Licence" desc="P1 red plates for 6 months, then P2 green plates for 24 months. Zero BAC applies throughout." href="/blog/understanding-provisional-licence-wa" />
          </div>
        </section>

        {/* Quick Stats */}
        <section className="bg-white/[0.03] border-y border-white/10 py-10 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { val: '50 hrs', label: 'Minimum logbook hours' },
              { val: '5 hrs', label: 'Required night driving' },
              { val: '6 months', label: 'Minimum on L plates' },
              { val: '$60–100', label: 'Typical lesson cost (per hr)' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-violet-400 mb-1">{s.val}</p>
                <p className="text-white/50 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Articles Grid — two columns by topic */}
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-10">

            {/* Column 1: Getting Started & Test Prep */}
            <div>
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-violet-400" /> Getting Started
              </h2>
              <div className="space-y-2">
                <ArticleLink href="/blog/how-many-driving-lessons-do-i-need-pda-western-australia" title="How Many Lessons Do I Need?" tag="Guide" />
                <ArticleLink href="/blog/how-much-does-learning-to-drive-cost-perth" title="How Much Do Lessons Cost in Perth?" tag="Guide" />
                <ArticleLink href="/blog/how-to-choose-the-right-driving-instructor-perth" title="How to Choose the Right Instructor" tag="Guide" />
                <ArticleLink href="/blog/manual-vs-automatic-which-licence-should-you-choose" title="Manual vs Automatic — Which Licence?" tag="Guide" />
                <ArticleLink href="/blog/what-happens-during-first-driving-lesson" title="What Happens in Your First Lesson?" tag="Guide" />
                <ArticleLink href="/blog/understanding-wa-logbook-requirements" title="WA Logbook Requirements Explained" tag="Guide" />
                <ArticleLink href="/blog/logbook-tips-wa-learner-drivers" title="Logbook Tips — Complete 50 Hours Right" tag="Guide" />
                <ArticleLink href="/blog/hazard-perception-test-guide-wa" title="Hazard Perception Test Guide" tag="Guide" />
                <ArticleLink href="/blog/how-to-pass-hazard-perception-test-wa" title="How to Pass the HPT in WA" tag="Guide" />
                <ArticleLink href="/blog/what-is-a-pda-western-australia" title="What Is the PDA?" tag="Guide" />
              </div>

              <h2 className="text-xl font-bold text-white mt-10 mb-5 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" /> PDA Preparation
              </h2>
              <div className="space-y-2">
                <ArticleLink href="/pda-guide" title="The Complete WA PDA Master Guide" tag="Guide" />
                <ArticleLink href="/blog/how-to-pass-the-pda-on-your-first-attempt" title="How to Pass the PDA First Time" tag="Guide" />
                <ArticleLink href="/blog/most-common-reasons-people-fail-the-pda-western-australia" title="Most Common PDA Failure Reasons" tag="Guide" />
                <ArticleLink href="/blog/what-to-expect-pda-test-centre-wa" title="What to Expect on PDA Day" tag="Guide" />
                <ArticleLink href="/blog/preparing-students-for-pda-using-progress-tracking" title="Preparing for PDA with Progress Tracking" tag="Guide" />
              </div>
            </div>

            {/* Column 2: Skills & Road Rules */}
            <div>
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-cyan-400" /> Driving Skills
              </h2>
              <div className="space-y-2">
                <ArticleLink href="/blog/roundabouts-explained-learner-drivers-wa" title="Roundabouts Explained" tag="Skills" />
                <ArticleLink href="/blog/parallel-parking-guide-learner-drivers" title="Parallel Parking Step-by-Step" tag="Skills" />
                <ArticleLink href="/blog/three-point-turn-guide-learner-drivers" title="Three-Point Turn Guide" tag="Skills" />
                <ArticleLink href="/blog/how-to-teach-reversing-learner-drivers" title="Reversing — Build Confidence" tag="Skills" />
                <ArticleLink href="/blog/freeway-driving-tips-learner-drivers-wa" title="Freeway Driving for Learners" tag="Skills" />
                <ArticleLink href="/blog/night-driving-tips-learner-drivers-wa" title="Night Driving Tips WA" tag="Skills" />
                <ArticleLink href="/blog/wet-weather-driving-tips-learner-drivers-wa" title="Wet Weather Driving Tips" tag="Skills" />
                <ArticleLink href="/blog/driving-on-country-roads-wa-learner-drivers" title="Country Road Driving WA" tag="Skills" />
                <ArticleLink href="/blog/how-to-teach-manual-transmission-learner-drivers" title="Learning Manual Transmission" tag="Skills" />
                <ArticleLink href="/blog/driving-anxiety-tips-learner-drivers" title="Dealing with Driving Anxiety" tag="Skills" />
              </div>

              <h2 className="text-xl font-bold text-white mt-10 mb-5 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" /> Road Rules
              </h2>
              <div className="space-y-2">
                <ArticleLink href="/blog/give-way-rules-western-australia" title="Give Way Rules WA — Complete Guide" tag="Rules" />
                <ArticleLink href="/blog/speed-limit-rules-western-australia-learner-drivers" title="Speed Limits in WA" tag="Rules" />
                <ArticleLink href="/blog/parking-rules-western-australia-learner-drivers" title="Parking Rules WA" tag="Rules" />
                <ArticleLink href="/blog/understanding-provisional-licence-wa" title="Provisional Licence Conditions WA" tag="Rules" />
              </div>
            </div>
          </div>
        </section>

        {/* Driving Anxiety / Student Wellbeing callout */}
        <section className="max-w-4xl mx-auto px-4 pb-10">
          <div className="rounded-2xl bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-500/20 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="text-4xl shrink-0">💡</div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-2">Using DriveBook as a Student</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Book lessons online, track your progress after every session, manage your wallet balance, and get automatic reminders before each lesson — all from your student dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/blog/how-to-use-drivebook-as-a-student" className="text-sm font-semibold text-violet-400 hover:text-violet-300 no-underline transition-colors">How to use DriveBook as a student →</Link>
                <Link href="/blog/how-drivebook-wallet-works" className="text-sm font-semibold text-violet-400 hover:text-violet-300 no-underline transition-colors">How the student wallet works →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'How many hours do I need before my PDA in WA?', a: 'A minimum of 50 hours of supervised driving, including at least 5 hours at night, recorded in your logbook.' },
              { q: 'How much do driving lessons cost in Perth?', a: 'Typically $60–$100 per hour depending on the instructor, vehicle type, and suburb. Lesson packages offer savings of 5–12% compared to single-lesson rates.' },
              { q: 'Do I need to pass the HPT before the PDA?', a: 'Yes. The Hazard Perception Test must be passed before you can book your Practical Driving Assessment.' },
              { q: 'Can I learn in an automatic car?', a: 'Yes — but your licence will be restricted to automatic vehicles. A manual licence covers both manual and automatic. Most instructors offer both options.' },
              { q: 'How long does it take to get a licence in WA?', a: 'You must hold your learner permit for at least 6 months. Most learners take 9–18 months from permit to provisional licence, depending on practice frequency.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
                <p className="font-semibold text-white mb-2">{q}</p>
                <p className="text-white/60 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to Book Your First Lesson?</h2>
            <p className="text-white/60 mb-6">Find a verified instructor near you, check availability, and book online in seconds.</p>
            <Link href="/book" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
              Find an Instructor Near You →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
