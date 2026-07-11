import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone, Clock, CheckCircle, XCircle, ChevronRight, Zap, MessageSquare, Calendar } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'AI Phone Receptionist for Driving Schools — 24/7 Booking Automation',
  description:
    'DriveBook\'s AI receptionist answers every call, checks your live calendar, books the lesson, and sends an SMS confirmation — while you\'re teaching. No missed calls. No lost bookings.',
  openGraph: {
    title: 'AI Phone Receptionist for Driving Schools | DriveBook',
    description: 'Answer every call 24/7 with AI. Books lessons, sends confirmations, never misses a booking. For driving instructors in Australia.',
    url: `${BASE_URL}/features/ai-receptionist`,
  },
  alternates: { canonical: `${BASE_URL}/features/ai-receptionist` },
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
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-pink-500 hover:to-violet-500 transition-all">
            Start Free Trial
          </Link>
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

export default function AIReceptionistPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DriveBook AI Receptionist',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'AUD',
      description: 'Included in DriveBook PRO plan and above',
    },
    featureList: [
      'AI voice receptionist for driving schools',
      '24/7 phone answering',
      'Automated lesson booking via phone',
      'Real-time calendar integration',
      'SMS booking confirmation',
      'Multi-language support',
      'Cancellation and reschedule handling',
      'Call drop recovery',
      'Duplicate booking detection',
    ],
    description:
      'DriveBook AI Receptionist is a voice AI that answers phone calls for driving instructors 24/7. It books lessons, checks live availability, sends SMS confirmations, and handles cancellations — all without the instructor needing to configure anything.',
    url: `${BASE_URL}/features/ai-receptionist`,
    provider: {
      '@type': 'Organization',
      name: 'DriveBook',
      url: BASE_URL,
    },
    audience: {
      '@type': 'Audience',
      audienceType: 'Driving instructors and driving schools in Australia',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'AI Receptionist', item: `${BASE_URL}/features/ai-receptionist` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Does the AI receptionist work with my existing phone number?', acceptedAnswer: { '@type': 'Answer', text: 'DriveBook provides a dedicated AU phone number for your AI receptionist. You can forward your existing number to it or use the DriveBook number directly on your marketing materials.' } },
      { '@type': 'Question', name: 'What happens if the AI can\'t answer a question?', acceptedAnswer: { '@type': 'Answer', text: 'For anything outside of booking, availability, and basic pricing, the AI directs callers to message you directly. It doesn\'t make up answers for complex questions.' } },
      { '@type': 'Question', name: 'Can the AI book in languages other than English?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The AI can detect and respond in multiple languages. This is particularly useful for instructors who teach students who prefer Arabic, Mandarin, or other languages.' } },
      { '@type': 'Question', name: 'Is the AI available 24 hours a day?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The AI receptionist answers calls at any time — including outside your working hours, on weekends, and on public holidays. Bookings are only offered within your available slots, but the AI itself is always available.' } },
      { '@type': 'Question', name: 'Will students know they\'re talking to an AI?', acceptedAnswer: { '@type': 'Answer', text: 'The AI introduces itself as a booking assistant for your driving school. It is professional and efficient. Most students simply want to book a lesson quickly — the AI does this well.' } },
    ],
  }

  const comparisonRows = [
    { feature: '24/7 availability', ai: true, human: false, note: 'Human receptionists work set hours' },
    { feature: 'Answers during your lessons', ai: true, human: false, note: 'You can\'t take calls while teaching' },
    { feature: 'Real-time calendar access', ai: true, human: 'partial', note: 'Human needs access to your diary' },
    { feature: 'Instant SMS confirmation', ai: true, human: false, note: 'Human needs to send separately' },
    { feature: 'Never misses a call', ai: true, human: false, note: 'Humans have limited lines' },
    { feature: 'Multi-language support', ai: true, human: 'partial', note: 'Depends on staff language skills' },
    { feature: 'Cost', ai: 'Included in PRO+', human: '$40,000+/yr', note: 'Part-time receptionist salary' },
    { feature: 'Complex conversations', ai: false, human: true, note: 'AI handles booking only' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-pink-900 via-violet-900 to-slate-950 py-20 md:py-28 px-4">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
              <span>/</span>
              <span className="text-white/60">AI Receptionist</span>
            </nav>
            <div className="inline-flex items-center gap-2 bg-pink-500/20 border border-pink-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-pink-300 text-xs font-semibold uppercase tracking-wider">Available on PRO and above</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your Driving School's<br />
              <span className="bg-gradient-to-r from-pink-300 to-violet-300 bg-clip-text text-transparent">24/7 AI Receptionist</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl leading-relaxed">
              Every missed call is a potential booking lost. DriveBook's AI receptionist answers immediately, checks your live calendar, confirms the lesson, and sends the student an SMS — while you're in the car teaching.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/teach-with-drivebook" className="bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20 text-center">
                Start Free Trial →
              </Link>
              <Link href="/blog/drivebook-ai-phone-receptionist-driving-instructors" className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold no-underline transition-all border border-white/10 text-center">
                How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">You're in the car. The phone rings. You can't answer.</h2>
              <p className="text-white/60 leading-relaxed mb-4">
                Driving instructors miss calls constantly — because teaching requires full attention. A student who doesn't reach you on the first call rarely calls back. They move on to the next instructor in the search results.
              </p>
              <p className="text-white/60 leading-relaxed">
                The AI receptionist solves this completely. It picks up every call, handles the booking conversation, and confirms the lesson — without you doing anything.
              </p>
            </div>
            <div className="space-y-3">
              {['A student calls during your 10am lesson', 'AI answers immediately — no hold music', 'AI checks your calendar in real time', 'Offers 3 available slots this week', 'Student confirms a time', 'SMS confirmation sent to student', 'Booking appears in your dashboard'].map((step, i) => (
                <div key={step} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{i + 1}</div>
                  <span className="text-white/80 text-sm">{step}</span>
                  {i === 6 && <CheckCircle className="h-4 w-4 text-emerald-400 ml-auto shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key benefits */}
        <section className="bg-white/[0.02] border-y border-white/10 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">What the AI Receptionist Does</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Clock, colour: 'from-pink-600 to-rose-600', title: '24/7 — Including Weekends', desc: 'Answers calls any time of day or night. Students who search on Sunday evenings can book immediately rather than waiting until Monday morning.' },
                { icon: Calendar, colour: 'from-violet-600 to-purple-600', title: 'Real-Time Calendar Access', desc: 'Only offers slots that are genuinely available. It cannot double-book or offer times outside your working hours. Your availability is always live.' },
                { icon: MessageSquare, colour: 'from-cyan-600 to-blue-600', title: 'Instant SMS Confirmation', desc: 'The moment a booking is confirmed, the student receives an SMS with date, time, instructor name, and pickup address. Professional and immediate.' },
                { icon: Phone, colour: 'from-emerald-600 to-teal-600', title: 'Multi-Language Support', desc: 'The AI detects the caller\'s language and responds accordingly. Removes barriers for students who prefer Arabic, Mandarin, or other languages.' },
                { icon: Zap, colour: 'from-amber-500 to-orange-500', title: 'Zero Setup Per Call', desc: 'No scripting, no training, no maintenance. The AI reads your calendar and acts on it. You change your availability — the AI adapts immediately.' },
                { icon: CheckCircle, colour: 'from-indigo-600 to-violet-600', title: 'Bookings in Your Dashboard', desc: 'Every AI-created booking appears in your DriveBook dashboard exactly like a manually created one. Full lesson details, student record, payment status.' },
              ].map(({ icon: Icon, colour, title, desc }) => (
                <div key={title} className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white mb-3 text-center">AI Receptionist vs Human Receptionist</h2>
          <p className="text-white/50 text-center mb-10 text-sm">For most driving instructors, a human receptionist is cost-prohibitive. AI fills the gap.</p>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                  <th className="text-center p-4 text-pink-400 font-bold">AI Receptionist</th>
                  <th className="text-center p-4 text-white/50 font-semibold">Human Receptionist</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ feature, ai, human, note }) => (
                  <tr key={feature} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <span className="text-white font-medium">{feature}</span>
                      {note && <span className="block text-white/40 text-xs mt-0.5">{note}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {ai === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                       ai === false ? <XCircle className="h-5 w-5 text-red-400/60 mx-auto" /> :
                       <span className="text-pink-300 font-semibold text-xs">{ai}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {human === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                       human === false ? <XCircle className="h-5 w-5 text-red-400/60 mx-auto" /> :
                       human === 'partial' ? <span className="text-yellow-400 text-xs font-semibold">Partial</span> :
                       <span className="text-white/50 text-xs">{human}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Does it work with my existing phone number?', a: 'DriveBook provides a dedicated AU phone number. You can forward your existing number to it, or use the DriveBook number directly on your marketing materials.' },
              { q: 'What if the AI can\'t answer a question?', a: 'For anything outside booking, availability, and basic pricing, the AI directs callers to message you. It doesn\'t make up answers.' },
              { q: 'Can it book in other languages?', a: 'Yes. The AI detects and responds in multiple languages — useful for instructors teaching students who prefer Arabic, Mandarin, or other languages.' },
              { q: 'Is it available 24 hours a day?', a: 'Yes — including weekends and public holidays. Bookings are only offered within your available slots, but the AI itself always answers.' },
              { q: 'Will students know they\'re talking to an AI?', a: 'The AI introduces itself as a booking assistant. It is professional and efficient. Most students just want to book quickly — the AI does that well.' },
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
              { href: '/blog/drivebook-ai-phone-receptionist-driving-instructors', label: 'How DriveBook\'s AI receptionist books lessons while you teach' },
              { href: '/blog/ai-voice-receptionist-vs-human-receptionist-driving-school', label: 'AI receptionist vs human receptionist for driving schools' },
              { href: '/blog/how-ai-reduces-missed-calls-lost-bookings-driving-instructors', label: 'How AI reduces missed calls and lost bookings' },
              { href: '/blog/can-ai-really-book-driving-lessons', label: 'Can AI really book driving lessons? How it actually works' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-pink-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-pink-900/60 to-violet-900/60 border border-pink-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Stop Missing Calls. Start Growing.</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">The AI receptionist is included in every DriveBook PRO plan. Start your free trial today.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-pink-500/20">
              Start Free Trial →
            </Link>
            <p className="text-white/30 text-xs mt-4">No credit card required · Full PRO features during trial</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
