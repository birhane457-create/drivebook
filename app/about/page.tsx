import Link from 'next/link'
import { Car, Shield, Users, Star, Target, Heart } from 'lucide-react'

export const metadata = {
  title: 'About Us | DriveBook',
  description: 'DriveBook connects learners with verified driving instructors across Australia. Learn about our mission, values, and how we work.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-white shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-purple-600">DriveBook</Link>
          <div className="flex items-center gap-4">
            <Link href="/book" className="text-gray-700 hover:text-purple-600 font-medium hidden md:block">Find Instructor</Link>
            <Link href="/login" className="text-gray-700 hover:text-purple-600 font-medium">Login</Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">About DriveBook</h1>
        <p className="text-xl text-purple-100 max-w-2xl mx-auto">
          We're on a mission to make learning to drive simple, safe, and stress-free for every Australian learner.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-16 space-y-20">

        {/* Founder's Story — leads the page */}
        <section className="bg-purple-50 rounded-2xl border border-purple-100 p-10">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-purple-500 uppercase tracking-widest mb-4">Why DriveBook exists</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Built from necessity — and a wish I couldn't fulfil</h2>
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              I built DriveBook while living with a neurological condition that took away my ability to work in the way I'd planned. I'm not a driving instructor — I wish my health allowed it. But I couldn't teach, so I built the platform I wished existed for those who can.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              I watched instructors struggle with the same problems: chasing payments, managing schedules, answering calls mid-lesson, losing clients to disorganisation. I had the time, the skills, and the drive to solve it — even when my health made every day uncertain.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              DriveBook is the result of that effort. Every feature — the AI receptionist, automated payouts, the booking system — came from real problems real instructors face. I may not be able to teach, but I can build something that makes teaching easier for everyone who does.
            </p>
            <p className="text-sm text-purple-600 font-medium mt-6">— Birhane, Founder of DriveBook</p>
          </div>
        </section>

        {/* Mission */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            DriveBook exists to connect learner drivers with qualified, verified driving instructors — making the booking process instant, transparent, and trustworthy. We handle the admin so instructors can focus on teaching, and learners can focus on passing.
          </p>
        </section>

        {/* What we do */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">What We Do</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Learners & Instructors</h3>
              <p className="text-gray-600">We match learner drivers with local, verified instructors based on location, availability, and price — no phone tag required.</p>
            </div>
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Verify Every Instructor</h3>
              <p className="text-gray-600">Every instructor on DriveBook is background-checked, licensed, and reviewed by real students before they can accept bookings.</p>
            </div>
            <div className="text-center p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Simplify the Booking</h3>
              <p className="text-gray-600">Book a lesson in seconds. See real-time availability, pay securely, and get instant SMS confirmation — all from your phone.</p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-gray-50 rounded-2xl p-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Safety First</h3>
                <p className="text-gray-600 text-sm">Every instructor is verified. Every payment is protected. Every learner deserves to feel safe.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Transparency</h3>
                <p className="text-gray-600 text-sm">Clear pricing, clear cancellation policies, clear refunds. No hidden fees, no surprises.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Quality</h3>
                <p className="text-gray-600 text-sm">We hold instructors to a high standard. Real reviews from real students keep the bar high.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Fair for Everyone</h3>
                <p className="text-gray-600 text-sm">Instructors get paid fairly and on time. Learners get honest pricing. The platform earns only when both parties succeed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-2xl p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-purple-100 mb-8 text-lg">Find a verified instructor near you and book your first lesson today.</p>
          <Link href="/book" className="inline-block bg-white text-purple-600 px-10 py-4 rounded-lg font-bold text-lg hover:shadow-xl transition-all">
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
      <footer className="bg-gray-800 text-white py-10 px-4 mt-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3">DriveBook</h3>
            <p className="text-gray-400 text-sm">Connecting learners with professional driving instructors across Australia.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Company</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-white">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link href="/teach-with-drivebook" className="hover:text-white">For Instructors</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Get Started</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/book" className="hover:text-white">Find an Instructor</Link></li>
              <li><Link href="/register" className="hover:text-white">Create Account</Link></li>
              <li><Link href="/login" className="hover:text-white">Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-6 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} DriveBook. All rights reserved. ABN: [Your ABN]
        </div>
      </footer>
    </div>
  )
}
