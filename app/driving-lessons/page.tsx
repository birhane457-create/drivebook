import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Clock, Star, Phone } from 'lucide-react'
import { AU_STATES } from '@/lib/data/au-locations'
import { prisma } from '@/lib/prisma'
import PublicLayout from '@/components/PublicLayout'

export const revalidate = 3600

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Driving Lessons in Australia | DriveBook',
  description:
    'Find qualified driving instructors near you across Australia. Book online or by phone 24/7. Manual and automatic lessons available in WA, NSW, VIC, QLD and SA.',
  alternates: { canonical: `${BASE_URL}/driving-lessons` },
  openGraph: {
    title: 'Driving Lessons in Australia | DriveBook',
    description: 'Find qualified local driving instructors. Book online or by phone 24/7.',
    url: `${BASE_URL}/driving-lessons`,
    type: 'website',
  },
}

const TRUST_BADGES = [
  { icon: '✅', label: 'Verified Instructors' },
  { icon: '📅', label: 'Book Online 24/7' },
  { icon: '💳', label: 'Secure Payments' },
  { icon: '⭐', label: 'Rated & Reviewed' },
]

const WHY_ITEMS = [
  {
    icon: <Star className="w-5 h-5 text-amber-500" />,
    title: 'Verified & Rated',
    desc: 'Every instructor is credential-checked. Read real reviews from real students before you book.',
  },
  {
    icon: <Clock className="w-5 h-5 text-primary" />,
    title: 'Book Any Time',
    desc: 'Book online or call our AI receptionist 24/7. Instant SMS confirmation on every booking.',
  },
  {
    icon: <MapPin className="w-5 h-5 text-emerald-600" />,
    title: 'Local Pick-Up',
    desc: 'Instructors come to you. Choose your pickup location — home, school, or work.',
  },
  {
    icon: <Phone className="w-5 h-5 text-violet-600" />,
    title: 'Always Reachable',
    desc: "Can't book online? Call the instructor's AI line — it answers 24/7 and books for you.",
  },
]

export default async function DrivingLessonsIndexPage() {
  const stateCounts = await (prisma.provider as any).groupBy({
    by: ['state'],
    where: { approvalStatus: 'APPROVED', isActive: true, state: { not: null } },
    _count: { id: true },
  }).catch(() => []) as Array<{ state: string; _count: { id: number } }>

  const countMap = new Map(stateCounts.map((r: any) => [r.state, r._count.id]))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Driving Lessons by State — Australia',
    url: `${BASE_URL}/driving-lessons`,
    itemListElement: AU_STATES.map((state, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Driving Lessons in ${state.displayName}`,
      url: `${BASE_URL}/driving-lessons/${state.slug}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* PublicLayout applies class="light" → white bg, dark text, shared nav + footer */}
      <PublicLayout navVariant="student">

        {/* ── Hero — section-hero: always dark navy, white text ──────────── */}
        <header className="section-hero py-16 sm:py-20 px-4 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-blue-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              Find a Local Instructor
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-5 leading-tight">
              Driving Lessons in Australia
            </h1>
            <p className="text-lg sm:text-xl mb-8 max-w-2xl leading-relaxed" style={{ color: 'hsl(220 14% 82%)' }}>
              Find a verified, local driving instructor in your state. Book online or by phone 24/7.
              Manual and automatic lessons available.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {TRUST_BADGES.map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-white/10 border border-white/15 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  <span>{icon}</span>{label}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          {/* ── State grid ───────────────────────────────────────────────── */}
          {/* bg-background = white in .light → cards float cleanly on the page */}
          <section className="py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">Choose Your State</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Select your state to find instructors near you and book online.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {AU_STATES.map((state) => {
                const count = countMap.get(state.code) ?? 0
                const hasInstructors = count > 0
                return (
                  <Link
                    key={state.slug}
                    href={`/driving-lessons/${state.slug}`}
                    className={`card-feature group flex items-center justify-between p-5 rounded-xl no-underline transition-all hover:scale-[1.01] ${
                      !hasInstructors ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5">
                        {state.displayName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {hasInstructors
                          ? `${count} instructor${count !== 1 ? 's' : ''} · ${state.suburbs.length} suburbs`
                          : 'Coming soon'}
                      </p>
                    </div>
                    <span className="text-muted-foreground group-hover:text-primary transition-colors text-lg">→</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── Why DriveBook ─────────────────────────────────────────────── */}
          {/* card-feature adapts: white card on light bg, dark card on dark bg */}
          <section className="py-12 border-t border-border">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Why Book Through DriveBook?
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                We make finding and booking a driving instructor simple, safe, and fast.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {WHY_ITEMS.map(({ icon, title, desc }) => (
                <div key={title} className="card-feature flex gap-4 p-6 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────────── */}
          <section className="py-12 border-t border-border">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Find an Instructor',  desc: 'Browse verified instructors in your suburb. Read reviews and compare pricing.' },
                { step: '2', title: 'Book Online or Call', desc: 'Book directly on their profile page, or call their AI line — available 24/7.' },
                { step: '3', title: 'Get Driving',         desc: 'Your instructor picks you up at the agreed location. SMS reminder sent beforehand.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center gap-3">
                  <div className="step-circle text-sm">{step}</div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── SEO content ───────────────────────────────────────────────── */}
          <section className="py-12 border-t border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Learning to Drive in Australia
            </h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                Getting your driver&apos;s licence in Australia requires completing a minimum number of supervised driving hours and passing both a knowledge test and a practical driving assessment (PDA). Requirements vary by state and territory.
              </p>
              <p>
                DriveBook connects learner drivers with qualified, verified instructors across Australia. Whether you prefer manual or automatic transmission, we have instructors experienced in helping students pass their PDA test first time.
              </p>
            </div>
          </section>
        </div>

        {/* ── Bottom CTA — section-brand: always blue gradient, white text ── */}
        <section className="section-brand py-14 px-4 text-center mt-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to Start Your Driving Journey?
            </h2>
            <p className="opacity-90 mb-8 leading-relaxed">
              Find a verified instructor in your area and book your first lesson today.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/driving-lessons"
                className="inline-flex items-center gap-2 bg-white text-primary px-8 py-3.5 rounded-xl font-bold text-base shadow-lg hover:scale-[1.02] transition-all no-underline"
              >
                Find an Instructor →
              </Link>
              <Link
                href="/teach-with-drivebook"
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all no-underline"
              >
                I&apos;m an Instructor
              </Link>
            </div>
          </div>
        </section>

      </PublicLayout>
    </>
  )
}
