import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Complete WA PDA Guide — Practical Driving Assessment Western Australia',
  description:
    'The most comprehensive guide to passing the WA Practical Driving Assessment. Prerequisites, scoring, common failures, what examiners look for, and how to prepare.',
  openGraph: {
    title: 'The Complete WA PDA Guide | DriveBook',
    description: 'Everything you need to pass the WA Practical Driving Assessment — prerequisites, scoring, manoeuvres, common failures, and preparation advice.',
    url: `${BASE_URL}/pda-guide`,
  },
  alternates: { canonical: `${BASE_URL}/pda-guide` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/learn-to-drive" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Learn to Drive</Link>
          <Link href="/pda-guide" className="text-white px-3 py-2 rounded-lg bg-white/10 no-underline font-semibold">PDA Guide</Link>
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
          <Link href="/driving-lessons" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Find Instructors</Link>
          <Link href="/book" className="ml-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-violet-500 hover:to-indigo-500 transition-all">Book Now</Link>
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
    <Link href={href} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
      <span className="text-sm font-medium text-white group-hover:text-violet-200 transition-colors">{title}</span>
      <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 ml-3 transition-colors" />
    </Link>
  )
}

export default function PDAGuidePage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Learn to Drive', item: `${BASE_URL}/learn-to-drive` },
      { '@type': 'ListItem', position: 3, name: 'PDA Guide', item: `${BASE_URL}/pda-guide` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'How long is the PDA in WA?', acceptedAnswer: { '@type': 'Answer', text: 'The PDA takes approximately 30–45 minutes of on-road driving, plus the vehicle check and paperwork before and after.' } },
      { '@type': 'Question', name: 'How many fault marks before you fail the PDA?', acceptedAnswer: { '@type': 'Answer', text: 'Accumulating around 10 or more fault marks will typically result in a fail. Certain serious errors result in immediate failure regardless of other marks.' } },
      { '@type': 'Question', name: 'What documents do I need for my PDA?', acceptedAnswer: { '@type': 'Answer', text: 'You need your current learner permit, completed and signed logbook (50+ hours including 5 night hours), and your HPT certificate. The vehicle must also pass a roadworthiness check.' } },
      { '@type': 'Question', name: 'Can I use my instructor\'s car for the PDA?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Many students use their instructor\'s vehicle for the PDA. Confirm the arrangement with your instructor in advance.' } },
      { '@type': 'Question', name: 'What happens if I fail the PDA?', acceptedAnswer: { '@type': 'Answer', text: 'You receive a written assessment report detailing the faults recorded. You can rebook after working on the identified areas with your instructor. There is no limit on attempts.' } },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 pt-8 mb-8">
          <Link href="/" className="hover:text-white no-underline">Home</Link>
          <span>/</span>
          <Link href="/learn-to-drive" className="hover:text-white no-underline">Learn to Drive</Link>
          <span>/</span>
          <span className="text-white/60">PDA Guide</span>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Master Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            The Complete WA Practical<br />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Driving Assessment Guide</span>
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
            Everything you need to know about the PDA — from eligibility requirements through to what examiners actually look for on test day.
          </p>
        </div>

        {/* Quick Reference Cards */}
        <section className="grid sm:grid-cols-3 gap-4 mb-14">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            <Clock className="h-6 w-6 text-violet-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white mb-1">30–45 min</p>
            <p className="text-white/50 text-xs">On-road duration</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            <AlertTriangle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white mb-1">~10 faults</p>
            <p className="text-white/50 text-xs">Typical failure threshold</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white mb-1">3 docs</p>
            <p className="text-white/50 text-xs">Permit · Logbook · HPT cert</p>
          </div>
        </section>

        {/* Prerequisites */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Before You Can Book</h2>
          <div className="space-y-3">
            {[
              { ok: true, text: 'Hold your learner permit for a minimum of 6 months' },
              { ok: true, text: 'Log at least 50 hours of supervised driving in your logbook' },
              { ok: true, text: 'Include at least 5 hours of genuine night driving in your logbook' },
              { ok: true, text: 'Pass the Hazard Perception Test (HPT)' },
              { ok: true, text: 'Be at least 17 years old on test day' },
            ].map(({ ok, text }) => (
              <div key={text} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-white/80 text-sm">{text}</span>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-4">All requirements must be met before the assessment can proceed. The assessor will verify documents before you drive.</p>
        </section>

        {/* What the PDA Tests */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">What the PDA Tests</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { cat: 'General Driving', items: ['Road positioning and lane discipline', 'Speed management (appropriate, consistent)', 'Following distance', 'Mirror and blind spot checks', 'Traffic signals and signs', 'Give way at intersections'] },
              { cat: 'Manoeuvres', items: ['Reverse parallel parking', 'Three-point turn (turn in the road)', 'Uphill and downhill starts', 'Reversing (around a corner in some routes)', 'Controlled stops'] },
              { cat: 'Observation', items: ['Regular mirror checks', 'Blind spot checks on all moves', 'Scanning at intersections', 'Pedestrian awareness', 'Cyclist awareness'] },
              { cat: 'Higher Speed', items: ['Freeway entry and merging', 'Lane changes at speed', 'Maintaining appropriate speed', 'Exiting the freeway correctly'] },
            ].map(({ cat, items }) => (
              <div key={cat} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
                <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wide text-violet-400">{cat}</h3>
                <ul className="space-y-1.5">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-violet-400 shrink-0 mt-0.5">·</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Scoring */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">How Scoring Works</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-red-900/20 border border-red-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-5 w-5 text-red-400" />
                <h3 className="font-bold text-red-300">Immediate Failure</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">Any of these ends the assessment immediately, regardless of your other performance:</p>
              <ul className="space-y-2 text-sm text-white/70">
                {['Causing or nearly causing a collision', 'Disobeying a red traffic light', 'Driving dangerously', 'Requiring the assessor to intervene', 'Driving on the wrong side of the road'].map(i => (
                  <li key={i} className="flex gap-2"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />{i}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-yellow-900/20 border border-yellow-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <h3 className="font-bold text-yellow-300">Fault Marks</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">Minor errors are recorded as fault marks. Accumulating too many — or repeating the same error — results in a fail.</p>
              <ul className="space-y-2 text-sm text-white/70">
                {['Insufficient mirror checks', 'Poor speed management', 'Hesitation or stalling', 'Incomplete give way', 'Late or jerky braking', 'Incorrect gear selection (manual)'].map(i => (
                  <li key={i} className="flex gap-2"><AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Top 8 Failure Causes */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">The Most Common Failure Causes</h2>
          <p className="text-white/50 text-sm mb-6">Based on WA assessment patterns — address these specifically in your preparation.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { n: '1', t: 'Insufficient observation', d: 'Not checking mirrors and blind spots before and during every manoeuvre.' },
              { n: '2', t: 'Give way errors', d: 'Failing to give way correctly at intersections, roundabouts, or when turning right.' },
              { n: '3', t: 'Speed management', d: 'Travelling significantly below the limit or inconsistent speed without cause.' },
              { n: '4', t: 'Parallel parking', d: 'Hitting the kerb, ending too far from the kerb, or insufficient observation.' },
              { n: '5', t: 'Stop sign compliance', d: 'Rolling through a stop sign without a complete stop at the line.' },
              { n: '6', t: 'Freeway merging', d: 'Merging too slowly, not checking blind spots, or poor lane positioning.' },
              { n: '7', t: 'Test anxiety affecting control', d: 'Hesitation and overcaution from nerves causing stalling, indecision, or slow reaction.' },
              { n: '8', t: 'Pedestrian awareness', d: 'Not giving way to pedestrians when turning or at marked crossings.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{n}</div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{t}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ArticleLink href="/blog/most-common-reasons-people-fail-the-pda-western-australia" title="Read the full PDA failure analysis →" />
          </div>
        </section>

        {/* On Test Day */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">On Test Day</h2>
          <div className="space-y-3">
            {[
              { step: 'Arrive 10–15 min early', detail: 'Give yourself time to settle before you walk in. Rushing to the test centre is a bad start.' },
              { step: 'Bring all three documents', detail: 'Current learner permit + completed logbook (50+ hrs, 5+ night) + HPT certificate.' },
              { step: 'Vehicle check first', detail: 'Lights, horn, mirrors, seatbelts, and L plates are checked before you drive. Confirm these are all working.' },
              { step: 'Follow instructions clearly', detail: 'The assessor gives directions — you drive. Don\'t narrate your actions unless specifically trained to.' },
              { step: 'Recover from mistakes', detail: 'One or two fault marks won\'t fail you. Stay calm, focus on the next instruction, and continue driving well.' },
              { step: 'Result immediately', detail: 'The assessor tells you on return to the centre. Pass: licence paperwork begins. Fail: written report with specific faults.' },
            ].map(({ step, detail }, i) => (
              <div key={step} className="flex gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">{i + 1}</div>
                <div>
                  <p className="font-semibold text-white text-sm mb-0.5">{step}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ArticleLink href="/blog/what-to-expect-pda-test-centre-wa" title="Full test day walkthrough →" />
          </div>
        </section>

        {/* Related Articles */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">All PDA-Related Guides</h2>
          <div className="space-y-2">
            <ArticleLink href="/blog/what-is-a-pda-western-australia" title="What Is the PDA? Complete Overview" />
            <ArticleLink href="/blog/how-to-pass-the-pda-on-your-first-attempt" title="How to Pass the PDA on Your First Attempt" />
            <ArticleLink href="/blog/most-common-reasons-people-fail-the-pda-western-australia" title="Most Common PDA Failure Reasons in WA" />
            <ArticleLink href="/blog/what-to-expect-pda-test-centre-wa" title="What to Expect at the WA Test Centre" />
            <ArticleLink href="/blog/roundabouts-explained-learner-drivers-wa" title="Roundabouts — Complete Guide for Learners" />
            <ArticleLink href="/blog/parallel-parking-guide-learner-drivers" title="Parallel Parking Step-by-Step" />
            <ArticleLink href="/blog/three-point-turn-guide-learner-drivers" title="Three-Point Turn Guide" />
            <ArticleLink href="/blog/freeway-driving-tips-learner-drivers-wa" title="Freeway Driving for Learner Drivers WA" />
            <ArticleLink href="/blog/hazard-perception-test-guide-wa" title="Hazard Perception Test Guide WA" />
            <ArticleLink href="/blog/how-to-pass-hazard-perception-test-wa" title="How to Pass the HPT in WA" />
            <ArticleLink href="/blog/preparing-students-for-pda-using-progress-tracking" title="Preparing for PDA Using Progress Tracking" />
            <ArticleLink href="/blog/driving-anxiety-tips-learner-drivers" title="Dealing with Driving Anxiety on Test Day" />
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">PDA FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'How long is the PDA?', a: 'Approximately 30–45 minutes on-road, plus vehicle check and paperwork.' },
              { q: 'How many faults before I fail?', a: 'Around 10 fault marks typically results in a fail. Certain serious errors cause immediate failure regardless of total marks.' },
              { q: 'What documents do I need?', a: 'Current learner permit, completed logbook (50+ hours, 5+ night), and HPT certificate. All must be present before the assessment begins.' },
              { q: 'Can I use my instructor\'s car?', a: 'Yes. Many students use their instructor\'s vehicle. Confirm the arrangement with your instructor in advance.' },
              { q: 'What if I fail?', a: 'You receive a written report with specific faults listed. Work on those areas with your instructor before rebooking. There is no limit on attempts.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="font-semibold text-white mb-2 text-sm">{q}</p>
                <p className="text-white/60 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-16 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 p-10">
            <h2 className="text-2xl font-bold text-white mb-3">Find an Instructor Who Knows Your Test Routes</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Local instructors on DriveBook know the PDA routes from test centres near you and will prepare you specifically for what you'll face on the day.</p>
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
