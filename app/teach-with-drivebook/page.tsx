import Link from 'next/link'
import type { Metadata } from 'next'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Grow Your Driving School with DriveBook',
  description:
    'DriveBook helps driving instructors automate bookings, payments, and admin. AI receptionist answers calls 24/7. Join Australia\'s smart instructor platform.',
  openGraph: {
    title: 'Grow Your Driving School with DriveBook',
    description:
      'Automate bookings, payments, and admin. AI receptionist included. Join hundreds of instructors across Australia.',
  },
  alternates: {
    canonical: 'https://drivebook.com.au/teach-with-drivebook',
  },
}

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER

export default function TeachWithDriveBookPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 py-4 px-4 sm:px-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="no-underline shrink-0"><Logo size={34} dark /></Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hide text links on mobile — they're not the conversion action */}
            <Link href="/" className="hidden sm:inline-flex text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              For Learners
            </Link>
            <Link href="/login" className="hidden sm:inline-flex text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Login
            </Link>
            <Link href="/register" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 sm:px-5 py-2 rounded-xl no-underline font-medium text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all whitespace-nowrap">
              <span className="sm:hidden">Free Trial</span>
              <span className="hidden sm:inline">Start Free Trial</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Instructor Focused */}
      <header className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white py-14 sm:py-20 px-4 sm:px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 blur-3xl opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500 rounded-full"></div>
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent leading-tight">Grow Your Driving School Without the Admin Headaches</h1>
          <p className="text-lg sm:text-2xl mb-6 text-emerald-100">Your free AI receptionist answers calls 24/7 while you teach. Never miss a booking again.</p>
          <ul className="list-none p-0 my-6 text-left inline-block max-w-2xl text-lg text-white/80">
            <li className="my-2">💰 Zero setup fees - Start with a free trial</li>
            <li className="my-2">📞 AI receptionist handles calls while you&apos;re teaching</li>
            <li className="my-2">💳 Weekly payouts directly to your account</li>
            <li className="my-2">⚡ Automated booking, payments, and reminders</li>
            <li className="my-2">📈 Get discovered by learners actively searching</li>
          </ul>
          <div className="mt-8">
            <Link href="/register" className="inline-block bg-white text-emerald-900 px-10 py-5 rounded-xl no-underline font-bold text-xl shadow-xl shadow-emerald-900/50 hover:shadow-emerald-500/50 hover:scale-105 transition-all">
              Start Your Free Trial →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-5">
        {/* Founder story — leads the instructor page */}
        <section className="my-16 -mt-6">
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-2xl shadow-xl border border-emerald-500/30 p-8 md:p-10 max-w-3xl mx-auto backdrop-blur-sm hover:border-emerald-400/50 transition-all">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Why this platform exists</p>
            <h2 className="text-2xl font-bold text-white mb-4">Built for instructors — by someone who wished he could be one</h2>
            <p className="text-white/70 leading-relaxed mb-3">
              I built DriveBook while living with a neurological condition that took away my ability to work the way I'd planned. I'm not a driving instructor — I wish my health allowed it. But I couldn't teach, so I built the platform I wished existed for those who can.
            </p>
            <p className="text-white/70 leading-relaxed mb-3">
              I watched instructors lose bookings to missed calls, chase payments, and burn time on admin that had nothing to do with teaching. I had the skills and the drive to fix it — even when my health made every day uncertain.
            </p>
            <p className="text-white/70 leading-relaxed font-medium">
              Every feature — the AI receptionist, automated payouts, the booking system — came from real problems real instructors face. I may not be able to teach, but I can build something that makes teaching easier for everyone who does.
            </p>
            <p className="text-sm text-emerald-300 font-medium mt-4">— Birhane, Founder of DriveBook</p>
          </div>
        </section>

        {/* AI Receptionist - Instructor Angle */}
        <section className="my-16 -mt-10">
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-2xl shadow-xl p-4 sm:p-8 md:p-12 border border-emerald-500/30 backdrop-blur-sm">
            <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-4xl font-bold mb-3">📞 Your Free 24/7 Virtual Receptionist</h2>
              <p className="text-xl text-emerald-100">Never Miss Another Booking While You Teach</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-xl p-2 sm:p-8 mb-8 backdrop-blur-sm">
              <h3 className="text-2xl font-semibold text-white mb-4">Picture this scenario:</h3>
              <p className="text-lg text-white/80 mb-4">
                You&apos;re helping a nervous student parallel park. Your phone rings - it&apos;s a parent ready to book a $1,000 package.
              </p>
              <p className="text-lg text-white/80 mb-4">
                <strong className="text-red-400">With traditional driving schools:</strong> That call goes to voicemail. The parent hangs up and calls your competitor. <span className="text-red-400 font-semibold">Revenue lost forever.</span>
              </p>
              <p className="text-lg text-white/80">
                <strong className="text-emerald-400">With DriveBook:</strong> Your AI receptionist answers professionally, checks your real-time availability, books the lesson instantly, and sends SMS confirmation to both parties. <span className="text-emerald-400 font-semibold">All while you stay focused on teaching.</span>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-4">What Your AI Receptionist Does:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    <span className="text-white/80"><strong>Answers calls professionally</strong> - Introduces your driving school by name</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    <span className="text-white/80"><strong>Checks real-time availability</strong> - Knows your exact schedule</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    <span className="text-white/80"><strong>Books lessons instantly</strong> - Secures the booking while they&apos;re on the phone</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    <span className="text-white/80"><strong>Sends SMS confirmations</strong> - To both you and the student</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                    <span className="text-white/80"><strong>Handles rescheduling</strong> - Manages changes without interrupting you</span>
                  </li>
                </ul>
              </div>

              {VOICE_NUMBER ? (
                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-xl p-4 sm:p-8 text-center border border-emerald-500/50 backdrop-blur-sm hover:border-emerald-400/70 transition-all">
                  <p className="text-sm uppercase tracking-wide text-emerald-300 font-semibold mb-3">
                    Try it now - Call to experience it
                  </p>
                  <a
                    href={`tel:${VOICE_NUMBER}`}
                    className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-5 rounded-xl no-underline font-bold text-3xl hover:from-emerald-400 hover:to-teal-400 hover:scale-105 transition-all shadow-lg shadow-emerald-500/30"
                  >
                    {VOICE_NUMBER}
                  </a>
                  <p className="text-sm text-white/80 mt-4 font-semibold">
                    Available 24/7 • Never Sleeps • Never Misses a Call
                  </p>
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-white/70">
                      Call now and see how our AI handles inquiries, checks availability, and books lessons - just like it will for your driving school.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-xl p-4 sm:p-8 text-center border border-white/10 backdrop-blur-sm">
                  <p className="text-white/70">AI receptionist phone number will be displayed here once configured.</p>
                </div>
              )}
            </div>

            <div className="mt-8 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/30 p-6 rounded-lg backdrop-blur-sm">
              <h4 className="font-semibold text-white mb-2">💡 Recovered Revenue Calculator</h4>
              <p className="text-white/70">
                Average driving instructor misses 3-5 calls per week while teaching. At $500 average package value, that&apos;s <strong className="text-cyan-300">$1,500–$2,500 in lost revenue every week</strong>. Your AI receptionist pays for itself instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Platform Features — deep dive links */}
        <section className="my-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Explore Every Feature</h2>
            <p className="text-white/50 text-sm">Deep-dive guides on what each part of DriveBook actually does.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { href: '/features/ai-receptionist', emoji: '📞', title: 'AI Phone Receptionist', desc: 'Answers every call 24/7 and books lessons while you teach.' },
              { href: '/features/online-booking', emoji: '📅', title: 'Online Booking', desc: 'Students book and pay directly from your booking page.' },
              { href: '/features/custom-domain', emoji: '🌐', title: 'Custom Domain', desc: 'Your own website address — no building required.' },
              { href: '/features/payments', emoji: '💳', title: 'Payments & Payouts', desc: 'Student wallets, lesson packages, weekly payouts.' },
              { href: '/features/student-progress', emoji: '📊', title: 'Student Progress', desc: 'Track lesson notes and skill development over time.' },
              { href: '/features/multi-instructor', emoji: '👥', title: 'Multi-Instructor Schools', desc: 'Manage your whole school from one admin dashboard.' },
            ].map(({ href, emoji, title, desc }) => (
              <Link key={href} href={href} className="flex gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-500/40 transition-all no-underline group">
                <span className="text-2xl shrink-0">{emoji}</span>
                <div>
                  <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors text-sm mb-1">{title}</p>
                  <p className="text-white/50 text-xs leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {[
              { href: '/compare/google-calendar', label: 'DriveBook vs Google Calendar →' },
              { href: '/compare/paper-diary', label: 'DriveBook vs Paper Diary →' },
              { href: '/compare/calendly', label: 'DriveBook vs Calendly →' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="text-center p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/50 hover:text-white text-xs font-medium no-underline transition-all">
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* Why Instructors Choose Us */}
        <section className="my-16">
          <h2 className="text-2xl sm:text-4xl text-center mb-10 text-white">Why Instructors Choose DriveBook</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-emerald-400/50 transition-all">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-white">Zero Setup Fees</h3>
              <p className="text-white/70">Start with a free trial - no credit card required. Only pay a small platform fee per completed lesson.</p>
            </div>
            
            <div className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border border-teal-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-teal-400/50 transition-all">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold mb-3 text-white">More Students</h3>
              <p className="text-white/70">Appear in local searches when learners are actively looking. Get discovered by students in your area right now.</p>
            </div>
            
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-cyan-400/50 transition-all">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-3 text-white">Automated Admin</h3>
              <p className="text-white/70">Stop chasing payments and managing spreadsheets. We handle scheduling, payments, and reminders automatically.</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-blue-400/50 transition-all">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-semibold mb-3 text-white">Weekly Payouts</h3>
              <p className="text-white/70">Get paid every week via direct deposit. Transparent fee structure with no hidden costs.</p>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-indigo-400/50 transition-all">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-3 text-white">Full Control</h3>
              <p className="text-white/70">Set your own availability, pricing, and cancellation policy. You&apos;re in complete control of your schedule.</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-purple-400/50 transition-all">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-3 text-white">Professional Dashboard</h3>
              <p className="text-white/70">Manage your calendar, track earnings, view student notes, and monitor performance all in one place.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4 sm:p-8 rounded-xl border border-emerald-500/30 my-16 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl mb-6 text-white">How It Works - Get Started in 3 Steps</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold shadow-lg shadow-emerald-500/30">1</div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Sign Up & Create Your Profile</h3>
                <p className="text-white/70">Complete your instructor profile with credentials, availability, and pricing. Takes less than 10 minutes.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold shadow-lg shadow-emerald-500/30">2</div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Get Verified</h3>
                <p className="text-white/70">Submit your credentials for verification. We check your license, insurance, and background to ensure quality.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold shadow-lg shadow-emerald-500/30">3</div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Start Receiving Bookings</h3>
                <p className="text-white/70">Go live and start receiving bookings. Your AI receptionist is ready to handle calls 24/7 from day one.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="my-16">
          <h2 className="text-2xl sm:text-4xl text-center mb-4 text-white">What Instructors Say</h2>
          <p className="text-center text-white/50 mb-10 text-sm">Be among the first instructors on DriveBook — early members shape the platform.</p>
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 rounded-2xl p-6 sm:p-10 text-center max-w-2xl mx-auto backdrop-blur-sm">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-white mb-3">Early Access — Limited Spots</h3>
            <p className="text-white/70 mb-6">
              DriveBook is launching soon. The first instructors to join get priority listing, lower commission rates during the launch period, and direct input into new features.
            </p>
            <Link href="/register" className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-4 rounded-xl no-underline font-bold text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all">
              Claim Your Spot →
            </Link>
          </div>
        </section>

        {/* Pricing */}
        <section className="my-16">
          <h2 className="text-2xl sm:text-4xl text-center mb-10 text-white">Simple, Transparent Pricing</h2>
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 rounded-2xl p-4 sm:p-8 shadow-xl backdrop-blur-sm">
            <div className="text-center mb-6">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Pay Per Completed Lesson</h3>
              <p className="text-xl text-emerald-100">No monthly fees. No hidden costs.</p>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                <span className="text-white/80"><strong>Free trial</strong> - Test the platform with no commitment</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                <span className="text-white/80"><strong>Small platform fee</strong> - Only charged on completed lessons</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                <span className="text-white/80"><strong>AI receptionist included</strong> - Free 24/7 call handling</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                <span className="text-white/80"><strong>Weekly payouts</strong> - Direct deposit every week</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl flex-shrink-0">✓</span>
                <span className="text-white/80"><strong>No setup fees</strong> - Start earning immediately</span>
              </li>
            </ul>

            <div className="text-center">
              <Link href="/register" className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-10 py-4 rounded-xl no-underline font-bold text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all">
                Start Your Free Trial →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="my-16">
          <h2 className="text-2xl sm:text-4xl text-center mb-10 text-white">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: How much does it cost to join?</strong></p>
              <p className="text-white/70">A: Start with a free trial. After that, we charge a small platform fee per completed lesson - no monthly fees or hidden costs.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: How do I get paid?</strong></p>
              <p className="text-white/70">A: Payments are processed weekly via direct deposit. You can track all earnings in your instructor dashboard in real-time.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: Can I set my own availability and pricing?</strong></p>
              <p className="text-white/70">A: Absolutely! You control your schedule completely. Set your working hours, block off time, update availability in real-time, and set your own pricing.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: What if a student doesn&apos;t show up?</strong></p>
              <p className="text-white/70">A: Our automated SMS reminders reduce no-shows significantly. You can also set your own cancellation policy and charge for late cancellations.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: How does the AI receptionist work?</strong></p>
              <p className="text-white/70">A: The AI answers calls 24/7, checks your real-time availability, books lessons, and sends SMS confirmations - all automatically while you focus on teaching.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-2"><strong className="text-emerald-400 text-lg">Q: What credentials do I need?</strong></p>
              <p className="text-white/70">A: You need a valid driving instructor license, comprehensive insurance, and a clean background check. We verify all credentials before you go live.</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-6 sm:p-12 rounded-2xl text-center my-16 shadow-2xl shadow-emerald-900/50">
          <h2 className="text-2xl sm:text-4xl font-bold mb-4 mt-0">Ready to Grow Your Driving School?</h2>
          <p className="text-lg sm:text-xl mb-8 text-emerald-100">Join DriveBook today and start receiving bookings with zero setup fees. Your AI receptionist is waiting.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register" className="inline-block bg-white text-emerald-900 px-10 py-5 rounded-xl no-underline font-bold text-lg shadow-xl shadow-emerald-900/50 hover:shadow-emerald-500/50 hover:scale-105 transition-all">
              Start Your Free Trial →
            </Link>
            {VOICE_NUMBER && (
              <a href={`tel:${VOICE_NUMBER}`} className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-10 py-5 rounded-xl no-underline font-bold text-lg border-2 border-white/20 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all">
                Or Call {VOICE_NUMBER}
              </a>
            )}
          </div>
          <p className="mt-6 text-emerald-200">
            Looking for driving lessons? <Link href="/" className="text-white underline font-semibold hover:text-emerald-100 transition-colors">Find an instructor near you →</Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 backdrop-blur border-t border-white/10 text-white py-10 px-5 text-center mt-16">
        <p className="text-white/70">DriveBook - Empowering driving instructors to grow their business</p>
        <p className="mt-4 text-sm text-white/50">Last updated: June 8, 2026</p>
      </footer>
    </div>
  )
}
