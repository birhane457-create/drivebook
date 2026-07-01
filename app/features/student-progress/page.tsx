import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, CheckCircle, ChevronRight, Zap, BookOpen, MessageSquare, TrendingUp } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Student Progress Tracking for Driving Instructors | DriveBook',
  description:
    'Log lesson notes after every session. Track student skill development toward PDA readiness. Students see their own progress dashboard. All included in DriveBook.',
  openGraph: {
    title: 'Student Progress Tracking for Driving Instructors | DriveBook',
    description: 'Track student skill development, log lesson notes, and prepare students for their PDA — all from one dashboard.',
    url: `${BASE_URL}/features/student-progress`,
  },
  alternates: { canonical: `${BASE_URL}/features/student-progress` },
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

export default function StudentProgressPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'Student Progress Tracking', item: `${BASE_URL}/features/student-progress` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Can students see their own progress?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Students have their own dashboard where they can view lesson notes and progress after each session. Instructors control what feedback is visible.' } },
      { '@type': 'Question', name: 'Does DriveBook tell students when they are ready for the PDA?', acceptedAnswer: { '@type': 'Answer', text: 'No. DriveBook displays progress as a teaching guide. Only the instructor determines PDA readiness. The platform includes a disclaimer making this clear.' } },
      { '@type': 'Question', name: 'Can I track progress for multiple students at once?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Your instructor dashboard shows all active students and their progress status at a glance. You can click into any student to see their full lesson history.' } },
      { '@type': 'Question', name: 'How long does it take to log lesson notes?', acceptedAnswer: { '@type': 'Answer', text: 'Most instructors complete a lesson note in 2–3 minutes. The interface is designed for quick entry immediately after a lesson — while parked, before moving to the next student.' } },
    ],
  }

  const skills = ['Road positioning', 'Speed management', 'Observation / mirrors', 'Give way', 'Roundabouts', 'Parking & manoeuvres', 'Freeway driving', 'Night driving', 'PDA readiness']

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-slate-950 py-20 md:py-28 px-4">
          <div className="absolute top-0 left-1/3 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
              <span>/</span>
              <span className="text-white/60">Student Progress Tracking</span>
            </nav>
            <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Available on all plans</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Know Exactly Where<br />
              <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">Every Student Stands</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl leading-relaxed">
              Log lesson notes after each session. Track skill development over time. Let students see their own progress. Prepare them precisely for their PDA.
            </p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
              Start Free Trial →
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-3">How Progress Tracking Works</h2>
          <p className="text-white/50 text-center mb-12 text-sm">Three minutes after each lesson. Visible to the student immediately.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', icon: MessageSquare, colour: 'from-violet-600 to-purple-600', title: 'Log notes after the lesson', desc: 'After each lesson ends, open DriveBook and spend 2–3 minutes logging what was covered, what went well, and what needs work next session.' },
              { n: '2', icon: BarChart3, colour: 'from-pink-600 to-rose-600', title: 'Skills tracked over time', desc: 'Each note contributes to a running picture of the student\'s development across key skill areas — from road positioning to PDA manoeuvres.' },
              { n: '3', icon: TrendingUp, colour: 'from-emerald-600 to-teal-600', title: 'Student sees their dashboard', desc: 'Students log into their DriveBook dashboard and see their progress, lesson history, and what their instructor noted — keeping them engaged between sessions.' },
            ].map(({ n, icon: Icon, colour, title, desc }) => (
              <div key={n} className="relative bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="absolute top-4 right-4 text-4xl font-black text-white/[0.06]">{n}</div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Skill areas */}
        <section className="bg-white/[0.02] border-y border-white/10 py-14 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Skill areas tracked</h2>
                <p className="text-white/60 leading-relaxed mb-6">Progress is tracked across the core competencies assessed in the WA PDA. Each lesson note contributes to the student's running profile.</p>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map(s => (
                    <div key={s} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { skill: 'Road positioning', pct: 85, colour: 'bg-violet-500' },
                  { skill: 'Give way rules', pct: 70, colour: 'bg-pink-500' },
                  { skill: 'Roundabouts', pct: 60, colour: 'bg-indigo-500' },
                  { skill: 'Parking & manoeuvres', pct: 45, colour: 'bg-cyan-500' },
                  { skill: 'Freeway driving', pct: 30, colour: 'bg-emerald-500' },
                ].map(({ skill, pct, colour }) => (
                  <div key={skill} className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-medium">{skill}</span>
                      <span className="text-xs text-white/50">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${colour} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-10">Why It Matters</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: BookOpen, title: 'Never repeat yourself', desc: 'Starting a new lesson without notes means asking the student what you covered last time. With DriveBook, you open their record and know instantly.' },
              { icon: TrendingUp, title: 'Students stay engaged', desc: 'Students who can see their own progress between lessons are more motivated and more likely to book their next session promptly.' },
              { icon: CheckCircle, title: 'Dispute protection', desc: 'If a student later disputes their lesson history or PDA readiness, your logged notes are a factual record of what was covered and when.' },
              { icon: BarChart3, title: 'Identify patterns', desc: 'Across your full student base, you can spot which skills consistently take longer to develop — and adjust your teaching approach accordingly.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{title}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Can students see their own progress?', a: 'Yes. Students have their own dashboard showing lesson notes and progress after each session. Instructors control what feedback is visible.' },
              { q: 'Does DriveBook tell students when they\'re ready for the PDA?', a: 'No. DriveBook displays progress as a teaching guide only. PDA readiness is always determined by the instructor — not the platform.' },
              { q: 'Can I track progress for multiple students?', a: 'Yes. Your dashboard shows all active students and their progress status at a glance. Click any student for their full lesson history.' },
              { q: 'How long does logging take?', a: 'Most instructors complete a lesson note in 2–3 minutes — designed for quick entry while parked immediately after a lesson.' },
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
              { href: '/blog/student-progress-tracking-lesson-feedback-drivebook', title: 'Why progress tracking makes you a better instructor' },
              { href: '/blog/how-student-dashboards-improve-lesson-retention', title: 'How student dashboards improve lesson retention' },
              { href: '/blog/preparing-students-for-pda-using-progress-tracking', title: 'Preparing students for PDA using progress tracking' },
            ].map(({ href, title }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{title}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-violet-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Build Better Students, Faster</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Progress tracking is included on every DriveBook plan.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
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
