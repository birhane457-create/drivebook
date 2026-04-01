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

        {/* How it works for instructors */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">Built for Instructors Too</h2>
          <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
            DriveBook isn't just for learners. We give driving instructors the tools to run a professional, growing business — without the admin overhead.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">📅 Smart Scheduling</h3>
              <p className="text-gray-600 text-sm">Set your availability once. Clients book into your real-time calendar. No double-bookings, no back-and-forth.</p>
            </div>
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">💰 Guaranteed Payments</h3>
              <p className="text-gray-600 text-sm">Clients pay upfront. You get paid within 48 hours of lesson completion. No chasing invoices.</p>
            </div>
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">🌐 Your Own Booking Page</h3>
              <p className="text-gray-600 text-sm">Every instructor gets a personalised booking page at their own subdomain — share it anywhere and clients can book directly.</p>
            </div>
            <div className="p-6 border border-gray-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">📱 AI Receptionist</h3>
              <p className="text-gray-600 text-sm">Our AI phone receptionist answers calls and takes bookings 24/7 — even when you're in the middle of a lesson.</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link href="/teach-with-drivebook" className="inline-block bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700">
              Learn About Joining as an Instructor →
            </Link>
          </div>
        </section>

        {/* Founder's Story */}
        <section className="bg-white rounded-2xl border border-purple-100 shadow-sm p-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Why I Built DriveBook</h2>
            </div>
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              I built DriveBook while navigating a neurological condition and a period of unemployment. I needed work that could flex around my health — not the other way around. Teaching driving was something I could do on my own terms, but the admin side was a mess: chasing payments, managing schedules, answering calls mid-lesson.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              So I built the platform I wished existed. Every feature — the AI receptionist, automated payouts, the booking system — came from a real problem I faced or heard from other instructors in the same boat.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              Whether you're teaching full-time or fitting lessons around life's challenges, DriveBook is built to give you back your time and your independence.
            </p>
            <p className="text-sm text-purple-600 font-medium mt-6">— Birhane, Founder of DriveBook</p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-2xl p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-purple-100 mb-8 text-lg">Find a verified instructor near you and book your first lesson today.</p>
          <Link href="/book" className="inline-block bg-white text-purple-600 px-10 py-4 rounded-lg font-bold text-lg hover:shadow-xl transition-all">
            Find Your Instructor →
          </Link>
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
