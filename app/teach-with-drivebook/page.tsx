import Link from 'next/link'
import type { Metadata } from 'next'
import PublicLayout from '@/components/PublicLayout'

export const metadata: Metadata = {
  title: 'Grow Your Driving School with DriveBook',
  description:
    "DriveBook helps driving instructors automate bookings, payments, and admin. AI receptionist answers calls 24/7. Join Australia's smart instructor platform.",
  openGraph: {
    title: 'Grow Your Driving School with DriveBook',
    description:
      'Automate bookings, payments, and admin. AI receptionist included. Join hundreds of instructors across Australia.',
  },
  alternates: { canonical: 'https://drivebook.com.au/teach-with-drivebook' },
}

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER

const WHY_ITEMS = [
  {
    emoji: '💰', title: 'Zero Setup Fees',
    desc: 'Start with a free trial — no credit card required. Only pay a small platform fee per completed lesson.',
    tint: 'card-tint-emerald',
  },
  {
    emoji: '📈', title: 'More Students',
    desc: 'Appear in local searches when learners are actively looking. Get discovered by students in your area right now.',
    tint: 'card-tint-emerald',
  },
  {
    emoji: '⚡', title: 'Automated Admin',
    desc: 'Stop chasing payments and managing spreadsheets. We handle scheduling, payments, and reminders automatically.',
    tint: 'card-tint-blue',
  },
  {
    emoji: '💳', title: 'Weekly Payouts',
    desc: 'Get paid every week via direct deposit. Transparent fee structure with no hidden costs.',
    tint: 'card-tint-blue',
  },
  {
    emoji: '📅', title: 'Full Control',
    desc: "Set your own availability, pricing, and cancellation policy. You're in complete control of your schedule.",
    tint: 'card-tint-violet',
  },
  {
    emoji: '📱', title: 'Professional Dashboard',
    desc: 'Manage your calendar, track earnings, view student notes, and monitor performance all in one place.',
    tint: 'card-tint-violet',
  },
]

const FEATURES = [
  { href: '/features/ai-receptionist', emoji: '📞', title: 'AI Phone Receptionist',  desc: 'Answers every call 24/7 and books lessons while you teach.' },
  { href: '/features/online-booking',  emoji: '📅', title: 'Online Booking',          desc: 'Students book and pay directly from your booking page.' },
  { href: '/features/custom-domain',   emoji: '🌐', title: 'Custom Domain',           desc: 'Your own website address — no building required.' },
  { href: '/features/payments',        emoji: '💳', title: 'Payments & Payouts',       desc: 'Student wallets, lesson packages, weekly payouts.' },
  { href: '/features/student-progress',emoji: '📊', title: 'Student Progress',        desc: 'Track lesson notes and skill development over time.' },
  { href: '/features/multi-instructor',emoji: '👥', title: 'Multi-Instructor Schools', desc: 'Manage your whole school from one admin dashboard.' },
]

const COMPARES = [
  { href: '/compare/google-calendar', label: 'DriveBook vs Google Calendar' },
  { href: '/compare/paper-diary',     label: 'DriveBook vs Paper Diary' },
  { href: '/compare/calendly',        label: 'DriveBook vs Calendly' },
]

const FAQ = [
  { q: 'How much does it cost to join?',         a: 'Start with a free trial. After that, we charge a small platform fee per completed lesson — no monthly fees or hidden costs.' },
  { q: 'How do I get paid?',                      a: 'Payments are processed weekly via direct deposit. You can track all earnings in your instructor dashboard in real-time.' },
  { q: 'Can I set my own availability and pricing?', a: "Absolutely. You control your schedule completely — set working hours, block time off, update availability in real-time, and set your own pricing." },
  { q: "What if a student doesn't show up?",      a: "Our automated SMS reminders significantly reduce no-shows. DriveBook's platform cancellation policy applies: no refund for cancellations under 24 hours notice, protecting you from last-minute cancellations." },
  { q: 'How does the AI receptionist work?',      a: 'The AI answers calls 24/7, checks your real-time availability, books lessons, and sends SMS confirmations — all automatically while you focus on teaching.' },
  { q: 'What credentials do I need?',             a: 'You need a valid driving instructor licence, comprehensive insurance, and a clean background check. We verify all credentials before you go live.' },
]

export default function TeachWithDriveBookPage() {
  return (
    /* PublicLayout applies class="light" → white bg, dark text, nav + footer */
    <PublicLayout navVariant="instructor">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* section-hero-emerald: always dark emerald gradient, white text */}
      <header className="section-hero-emerald py-16 sm:py-24 px-4 text-center relative overflow-hidden">
        <div className="light pointer-events-none absolute inset-0">
          <div className="light absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="light absolute bottom-0 left-0 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl" />
        </div>
        <div className="light relative z-10 max-w-3xl mx-auto">
          <div className="light inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            For Driving Instructors
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-5 leading-tight bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
            Grow Your Driving School Without the Admin Headaches
          </h1>
          <p className="text-lg sm:text-xl mb-8 text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
            Your free AI receptionist answers calls 24/7 while you teach. Never miss a booking again.
          </p>
          <ul className="text-left inline-block max-w-md mb-10 space-y-2.5">
            {[
              '💰 Zero setup fees — start with a free trial',
              '📞 AI receptionist handles calls while you teach',
              '💳 Weekly payouts directly to your account',
              '⚡ Automated bookings, payments, and reminders',
              '📈 Get discovered by learners actively searching',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-emerald-100/80 text-sm sm:text-base">
                <span className="shrink-0">{item.slice(0, 2)}</span>
                <span>{item.slice(3)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-emerald-900 px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all no-underline"
          >
            Start Your Free Trial →
          </Link>
        </div>
      </header>

      <div className="light max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── Founder story ──────────────────────────────────────────────── */}
        {/* card-tint-emerald: tinted card that reads well on both white and dark bg */}
        <section className="py-14 -mt-6">
          <div className="light card-tint-emerald max-w-3xl mx-auto p-8 md:p-10 rounded-2xl shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
              Why this platform exists
            </p>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Built for instructors — by someone who wished he could be one
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              I built DriveBook while living with a neurological condition that took away my ability to work the way I&apos;d planned. I&apos;m not a driving instructor — I wish my health allowed it. But I couldn&apos;t teach, so I built the platform I wished existed for those who can.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-3">
              I watched instructors lose bookings to missed calls, chase payments, and burn time on admin that had nothing to do with teaching. I had the skills and the drive to fix it — even when my health made every day uncertain.
            </p>
            <p className="text-muted-foreground leading-relaxed font-medium">
              Every feature — the AI receptionist, automated payouts, the booking system — came from real problems real instructors face. I may not be able to teach, but I can build something that makes teaching easier for everyone who does.
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mt-5">
              — Birhane, Founder of DriveBook
            </p>
          </div>
        </section>

        {/* ── AI Receptionist ────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="light card-tint-emerald rounded-2xl p-6 sm:p-10 shadow-lg">
            <div className="light text-center mb-10">
              <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3">
                📞 Your Free 24/7 Virtual Receptionist
              </h2>
              <p className="text-muted-foreground text-lg">Never Miss Another Booking While You Teach</p>
            </div>

            {/* Scenario box — amber tint */}
            <div className="light card-tint-amber rounded-xl p-6 sm:p-8 mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">Picture this scenario:</h3>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                You&apos;re helping a nervous student parallel park. Your phone rings — it&apos;s a parent ready to book a $1,000 package.
              </p>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                <strong className="text-destructive">With traditional driving schools:</strong> That call goes to voicemail. The parent hangs up and calls your competitor.{' '}
                <span className="text-destructive font-semibold">Revenue lost forever.</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-emerald-600 dark:text-emerald-400">With DriveBook:</strong> Your AI receptionist answers professionally, checks your real-time availability, books the lesson instantly, and sends SMS confirmation to both parties.{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">All while you stay focused on teaching.</span>
              </p>
            </div>

            <div className="light grid md:grid-cols-2 gap-8">
              {/* Feature list */}
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-5">What Your AI Receptionist Does:</h3>
                <ul className="space-y-3.5">
                  {[
                    ['Answers calls professionally', 'Introduces your driving school by name'],
                    ['Checks real-time availability', 'Knows your exact schedule'],
                    ['Books lessons instantly', "Secures the booking while they're on the phone"],
                    ['Sends SMS confirmations', 'To both you and the student'],
                    ['Handles rescheduling', 'Manages changes without interrupting you'],
                  ].map(([strong, rest]) => (
                    <li key={strong} className="flex items-start gap-3">
                      <span className="text-emerald-500 text-lg shrink-0 mt-0.5">✓</span>
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{strong}</strong> — {rest}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Demo call box */}
              {VOICE_NUMBER ? (
                <div className="light card-tint-emerald rounded-xl p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Try it now — call to experience it
                  </p>
                  <a
                    href={`tel:${VOICE_NUMBER}`}
                    className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-2xl shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all no-underline"
                  >
                    {VOICE_NUMBER}
                  </a>
                  <p className="text-sm text-muted-foreground font-medium">
                    Available 24/7 · Never Sleeps · Never Misses a Call
                  </p>
                  <p className="text-xs text-muted-foreground border-t border-border pt-4 w-full">
                    Call now and see how our AI handles inquiries, checks availability, and books lessons — just like it will for your driving school.
                  </p>
                </div>
              ) : (
                <div className="light card-feature rounded-xl p-8 text-center flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">AI receptionist phone number will appear once configured.</p>
                </div>
              )}
            </div>

            {/* Revenue calculator */}
            <div className="light card-tint-blue rounded-xl p-5 mt-8">
              <h4 className="font-semibold text-foreground mb-2">💡 Recovered Revenue Calculator</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The average driving instructor misses 3–5 calls per week while teaching. At $500 average package value, that&apos;s{' '}
                <strong className="text-foreground">$1,500–$2,500 in lost revenue every week</strong>.
                Your AI receptionist pays for itself instantly.
              </p>
            </div>
          </div>
        </section>

        {/* ── Why Instructors Choose Us ───────────────────────────────────── */}
        <section className="py-14">
          <div className="light text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3">
              Why Instructors Choose DriveBook
            </h2>
            <p className="text-muted-foreground">Everything you need to run and grow your driving school.</p>
          </div>
          <div className="light grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_ITEMS.map(({ emoji, title, desc, tint }) => (
              <div key={title} className={`${tint} rounded-xl p-6 transition-all hover:scale-[1.01]`}>
                <div className="light text-3xl mb-3">{emoji}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="light card-tint-emerald rounded-2xl p-6 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">
              Get Started in 3 Steps
            </h2>
            <div className="light space-y-7">
              {[
                ['Sign Up & Create Your Profile',  'Complete your instructor profile with credentials, availability, and pricing. Takes less than 10 minutes.'],
                ['Get Verified',                    'Submit your credentials for verification. We check your licence, insurance, and background to ensure quality.'],
                ['Start Receiving Bookings',        'Go live and start receiving bookings. Your AI receptionist is ready to handle calls 24/7 from day one.'],
              ].map(([title, desc], i) => (
                <div key={title} className="flex gap-4 items-start">
                  <div className="light step-circle text-sm">{i + 1}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature deep-dive links ────────────────────────────────────── */}
        <section className="py-14">
          <div className="light text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Explore Every Feature</h2>
            <p className="text-muted-foreground text-sm">Deep-dive guides on what each part of DriveBook actually does.</p>
          </div>
          <div className="light grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ href, emoji, title, desc }) => (
              <Link
                key={href}
                href={href}
                className="card-feature flex gap-4 p-5 rounded-xl transition-all hover:scale-[1.01] no-underline group"
              >
                <span className="text-2xl shrink-0">{emoji}</span>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm mb-1">{title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="light mt-4 grid sm:grid-cols-3 gap-3">
            {COMPARES.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="card-feature text-center p-3 rounded-xl text-muted-foreground hover:text-foreground text-xs font-medium no-underline transition-all"
              >
                {label} →
              </Link>
            ))}
          </div>
        </section>

        {/* ── Early access CTA ───────────────────────────────────────────── */}
        <section className="py-14">
          <div className="light text-center mb-8">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3">What Instructors Say</h2>
            <p className="text-muted-foreground text-sm">Be among the first instructors on DriveBook — early members shape the platform.</p>
          </div>
          <div className="light card-tint-emerald rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto">
            <div className="light text-5xl mb-5">🎯</div>
            <h3 className="text-xl font-bold text-foreground mb-3">Early Access — Limited Spots</h3>
            <p className="text-muted-foreground mb-7 leading-relaxed">
              DriveBook is launching soon. The first instructors to join get priority listing, lower commission rates during the launch period, and direct input into new features.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all no-underline"
            >
              Claim Your Spot →
            </Link>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="light text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3">Simple, Transparent Pricing</h2>
          </div>
          <div className="light max-w-2xl mx-auto card-tint-emerald rounded-2xl p-6 sm:p-10 shadow-lg">
            <div className="light text-center mb-7">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Pay Per Completed Lesson</h3>
              <p className="text-muted-foreground">No monthly fees. No hidden costs.</p>
            </div>
            <ul className="space-y-4 mb-8">
              {[
                ['Free trial',              'Test the platform with no commitment'],
                ['Small platform fee',      'Only charged on completed lessons'],
                ['AI receptionist included','Free 24/7 call handling'],
                ['Weekly payouts',          'Direct deposit every week'],
                ['No setup fees',           'Start earning immediately'],
              ].map(([strong, rest]) => (
                <li key={strong} className="flex items-start gap-3">
                  <span className="text-emerald-500 text-lg shrink-0 mt-0.5">✓</span>
                  <span className="text-muted-foreground text-sm">
                    <strong className="text-foreground">{strong}</strong> — {rest}
                  </span>
                </li>
              ))}
            </ul>
            <div className="light text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all no-underline"
              >
                Start Your Free Trial →
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="light text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="light max-w-3xl mx-auto space-y-3">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="card-faq p-5 rounded-xl transition-all">
                <p className="font-semibold text-foreground mb-2">{q}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Final CTA — section-brand: always blue gradient, white text ── */}
      <section className="section-brand py-16 px-4 text-center">
        <div className="light max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">Ready to Grow Your Driving School?</h2>
          <p className="text-lg mb-10 opacity-90 leading-relaxed">
            Join DriveBook today and start receiving bookings with zero setup fees. Your AI receptionist is waiting.
          </p>
          <div className="light flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-primary px-10 py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-[1.02] transition-all no-underline"
            >
              Start Your Free Trial →
            </Link>
            {VOICE_NUMBER && (
              <a
                href={`tel:${VOICE_NUMBER}`}
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all no-underline"
              >
                Or Call {VOICE_NUMBER}
              </a>
            )}
          </div>
          <p className="mt-8 text-sm opacity-80">
            Looking for driving lessons?{' '}
            <Link href="/" className="text-white underline font-semibold hover:opacity-90 transition-opacity">
              Find an instructor near you →
            </Link>
          </p>
        </div>
      </section>

    </PublicLayout>
  )
}
