import Link from 'next/link'
import { Car, Shield, Users, Star, Target, Heart } from 'lucide-react'

export const metadata = {
  title: 'About Us | DriveBook',
  description: 'DriveBook connects learners with verified driving instructors across Australia. Learn about our mission, values, and how we work.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent no-underline">DriveBook</Link>
          <div className="flex items-center gap-3">
            <Link href="/book" className="text-white/70 hover:text-white font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors hidden md:block no-underline">Find Instructor</Link>
            <Link href="/login" className="text-white/70 hover:text-white font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Login</Link>
            <Link href="/register" className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-2 rounded-xl font-bold hover:from-pink-400 hover:to-violet-400 transition-all no-underline">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">About DriveBook</h1>
        <p className="text-xl text-purple-100 max-w-2xl mx-auto">
          We&apos;re on a mission to make learning to drive simple, safe, and stress-free for every Australian learner.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-16 space-y-20">

        {/* Founder's Story */}
        <section className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 rounded-2xl border border-violet-500/30 p-10">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Why DriveBook exists</p>
            <h2 className="text-3xl font-bold text-white mb-6">Built from necessity — and a wish I couldn&apos;t fulfil</h2>
            <p className="text-white/70 leading-relaxed text-lg mb-4">
              I built DriveBook while living with a neurological condition that took away my ability to work in the way I&apos;d planned. I&apos;m not a driving instructor — I wish my health allowed it. But I couldn&apos;t teach, so I built the platform I wished existed for those who can.
            </p>
            <p className="text-white/70 leading-relaxed text-lg mb-4">
              I watched instructors struggle with the same problems: chasing payments, managing schedules, answering calls mid-lesson, losing clients to disorganisation. I had the time, the skills, and the drive to solve it — even when my health made every day uncertain.
            </p>
            <p className="text-white/70 leading-relaxed text-lg">
              DriveBook is the result of that effort. Every feature — the AI receptionist, automated payouts, the booking system — came from real problems real instructors face. I may not be able to teach, but I can build something that makes teaching easier for everyone who does.
            </p>
            <p className="text-sm text-violet-400 font-medium mt-6">— Birhane, Founder of DriveBook</p>
          </div>
        </section>

        {/* Mission */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-lg text-white/60 max-w-3xl mx-auto leading-relaxed">
            DriveBook exists to connect learner drivers with qualified, verified driving instructors — making the booking process instant, transparent, and trustworthy. We handle the admin so instructors can focus on teaching, and learners can focus on passing.
          </p>
        </section>

        {/* What we do */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-10 text-center">What We Do</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/40 transition-all">
              <div className="w-14 h-14 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Learners &amp; Instructors</h3>
              <p className="text-white/60">We match learner drivers with local, verified instructors based on location, availability, and price — no phone tag required.</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Verify Every Instructor</h3>
              <p className="text-white/60">Every instructor on DriveBook is background-checked, licensed, and reviewed by real students before they can accept bookings.</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all">
              <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Simplify the Booking</h3>
              <p className="text-white/60">Book a lesson in seconds. See real-time availability, pay securely, and get instant SMS confirmation — all from your phone.</p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-10">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Safety First</h3>
                <p className="text-white/60 text-sm">Every instructor is verified. Every payment is protected. Every learner deserves to feel safe.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Transparency</h3>
                <p className="text-white/60 text-sm">Clear pricing, clear cancellation policies, clear refunds. No hidden fees, no surprises.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-pink-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Quality</h3>
                <p className="text-white/60 text-sm">We hold instructors to a high standard. Real reviews from real students keep the bar high.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-rose-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Fair for Everyone</h3>
                <p className="text-white/60 text-sm">Instructors get paid fairly and on time. Learners get honest pricing. The platform earns only when both parties succeed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-2xl p-10 text-center shadow-2xl shadow-purple-900/50">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-purple-100 mb-8 text-lg">Find a verified instructor near you and book your first lesson today.</p>
          <Link href="/book" className="inline-block bg-white text-violet-900 px-10 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all no-underline">
            Find Your Instructor →
          </Link>
          <p className="mt-6 text-purple-200 text-sm">
            Are you a driving instructor?{' '}
            <Link href="/teach-with-drivebook" className="text-white underline hover:text-purple-200">
              See how DriveBook can grow your business →
            </Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 backdrop-blur border-t border-white/10 text-white py-10 px-4 mt-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3 bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">DriveBook</h3>
            <p className="text-white/50 text-sm">Connecting learners with professional driving instructors across Australia.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Company</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/about" className="hover:text-white transition-colors no-underline">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors no-underline">Contact</Link></li>
              <li><Link href="/teach-with-drivebook" className="hover:text-white transition-colors no-underline">For Instructors</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Legal</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/terms" className="hover:text-white transition-colors no-underline">Learner Terms</Link></li>
              <li><Link href="/instructor-terms" className="hover:text-white transition-colors no-underline">Instructor Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors no-underline">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Get Started</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/book" className="hover:text-white transition-colors no-underline">Find an Instructor</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors no-underline">Create Account</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors no-underline">Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-sm text-white/40">
          © {new Date().getFullYear()} DriveBook. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
