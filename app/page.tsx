'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import BookingFlowShowcase from '@/components/landing/BookingFlowShowcase'
import AIReceptionistShowcase from '@/components/landing/AIReceptionistShowcase'
import ProgressTrackingShowcase from '@/components/landing/ProgressTrackingShowcase'

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              DriveBook
            </span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/about" className="text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              About Us
            </Link>
            <Link href="/contact" className="text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              Contact Us
            </Link>
            <Link href="/blog" className="text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              Blog
            </Link>
            <Link href="/teach-with-drivebook" className="text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              For Instructors
            </Link>

            <div className="w-px h-5 bg-white/10 mx-2" />

            <Link href="/login" className="text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              Login
            </Link>
            <Link href="/register" className="ml-1 bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-2 rounded-xl no-underline text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:from-pink-400 hover:to-violet-400 transition-all">
              Get Started
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-950/95 border-t border-white/10 px-4 py-4 space-y-2">
            <Link href="/about" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              About Us
            </Link>
            <Link href="/contact" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Contact Us
            </Link>
            <Link href="/blog" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Blog
            </Link>
            <Link href="/terms" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Learner Terms
            </Link>
            <Link href="/instructor-terms" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Instructor Terms
            </Link>
            <Link href="/privacy" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Privacy Policy
            </Link>
            <Link href="/teach-with-drivebook" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              For Instructors
            </Link>
            <div className="h-px bg-white/10 my-2" />
            <Link href="/login" className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
              Login
            </Link>
            <Link href="/register" className="block bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-3 rounded-lg no-underline font-bold text-center text-sm shadow-lg shadow-purple-500/20 mt-2">
              Get Started
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section - Learner Focused */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-20 md:py-32 px-4 text-center">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-violet-500/20 rounded-full blur-2xl -translate-x-1/2" />

        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Pass Your Driving Test<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">with Confidence</span>
          </h1>
          <p className="text-lg md:text-xl mb-8 text-purple-100 max-w-2xl mx-auto">Book local instructors in seconds. Flexible lessons, transparent pricing, approved instructors.</p>
          <ul className="list-none p-0 my-8 text-left inline-block max-w-2xl text-base md:text-lg space-y-2 text-purple-100">
            <li>🎯 Smart booking with real-time availability—no waiting, no phone tag</li>
            <li>📍 Location-based matching to find instructors who service your area</li>
            <li>💰 Save up to 12% with bulk hour packages and test preparation bundles</li>
            <li>📞 Book by phone — AI answers 24/7, no app download needed</li>
            <li>📱 Manage everything 24/7 from your personal dashboard</li>
          </ul>
          <div className="mt-10">
            <Link href="/book" className="inline-block bg-white text-violet-900 px-10 py-4 rounded-xl no-underline font-bold text-lg shadow-2xl shadow-purple-900/50 hover:shadow-purple-500/50 hover:scale-105 transition-all">
              Book Your First Lesson →
            </Link>
          </div>
        </div>
      </header>

      <main className="bg-slate-950">
        {/* Audience fork — get each visitor into their lane immediately */}
        <section className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link href="/book" className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm no-underline">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 group-hover:from-cyan-500/20 transition-all duration-500" />
              <div className="relative p-8 md:p-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/30">
                  <span className="text-2xl">🎓</span>
                </div>
                <h2 className="text-xl font-bold mb-3 text-white">I want to learn to drive</h2>
                <p className="text-purple-300 mb-6 text-sm leading-relaxed">Find a verified local instructor, book instantly, track your progress.</p>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-cyan-400 group-hover:gap-3 transition-all">
                  Find an instructor →
                </div>
              </div>
            </Link>

            <Link href="/teach-with-drivebook" className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-pink-400/40 hover:shadow-2xl hover:shadow-pink-500/20 transition-all bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm no-underline">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-violet-600/5 group-hover:from-pink-500/20 transition-all duration-500" />
              <div className="relative p-8 md:p-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-pink-500/30">
                  <span className="text-2xl">🚗</span>
                </div>
                <h2 className="text-xl font-bold mb-3 text-white">I want to grow my driving school</h2>
                <p className="text-purple-300 mb-6 text-sm leading-relaxed">Automate bookings, payments, and admin. AI receptionist included.</p>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-pink-400 group-hover:gap-3 transition-all">
                  Learn more →
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Trust Badge — single authoritative statement */}
        <section className="py-8 md:py-12">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-br from-white/5 to-white/0 border border-emerald-500/30 rounded-2xl backdrop-blur-sm px-6 py-6 max-w-3xl mx-auto">
            <span className="text-4xl flex-shrink-0">🛡️</span>
            <div className="text-center sm:text-left">
              <p className="font-bold text-white text-lg">Every instructor is background-checked, licensed &amp; approved</p>
              <p className="text-emerald-300/70 text-sm mt-1">Credentials verified by DriveBook before they can accept a single booking.</p>
            </div>
          </div>
        </section>

        {/* AI Voice Receptionist — primary differentiator */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">AI-Powered</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-3 text-white">Book by Phone — AI Answers 24/7</h2>
            <p className="text-lg text-purple-300 mb-2">No app download required. Just call and book.</p>
            <p className="text-white/50 text-sm">Our AI receptionist handles availability, booking, and SMS confirmation — any time of day.</p>
          </div>
          <AIReceptionistShowcase />
        </section>

        {/* Why Choose DriveBook - Learner Focused */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-pink-400 uppercase tracking-wider mb-3">Why DriveBook</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Why Choose <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">DriveBook?</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-5 shadow-lg text-white font-bold">✓</div>
              <h3 className="text-lg font-bold mb-2 text-white">Trusted & Approved</h3>
              <p className="text-white/60 text-sm">Background-checked, licensed, and reviewed by real students before they can take a booking. Your safety comes first.</p>
            </div>
            
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/40 hover:shadow-xl hover:shadow-yellow-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg text-white font-bold">⚡</div>
              <h3 className="text-lg font-bold mb-2 text-white">Book in Seconds</h3>
              <p className="text-white/60 text-sm">See real-time availability and reserve your lesson instantly—no phone calls, no waiting, no hassle.</p>
            </div>
            
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-5 shadow-lg text-white font-bold">💰</div>
              <h3 className="text-lg font-bold mb-2 text-white">Flexible Packages</h3>
              <p className="text-white/60 text-sm">Pay-as-you-go or save up to 12% with bulk packages. Cancel or reschedule easily through your dashboard.</p>
            </div>
            
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/40 hover:shadow-xl hover:shadow-pink-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-5 shadow-lg text-white font-bold">📱</div>
              <h3 className="text-lg font-bold mb-2 text-white">Smart Reminders</h3>
              <p className="text-white/60 text-sm">Get SMS notifications before your lesson so you never miss a session. Stay on track with your learning.</p>
            </div>
            
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg text-white font-bold">📊</div>
              <h3 className="text-lg font-bold mb-2 text-white">Track Your Progress</h3>
              <p className="text-white/60 text-sm">View lesson notes and track your improvement over time. See exactly what you need to work on.</p>
            </div>
            
            <div className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/20 backdrop-blur-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 flex items-center justify-center mb-5 shadow-lg text-white font-bold">🎯</div>
              <h3 className="text-lg font-bold mb-2 text-white">Test Preparation</h3>
              <p className="text-white/60 text-sm">Book mock tests and test-day packages to boost your confidence and pass on your first try.</p>
            </div>
          </div>
        </section>

        {/* AI Voice Receptionist Showcase — already shown above */}

        {/* Progress Tracking Showcase */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Track Your Progress</h2>
            <p className="text-lg text-white/70 mb-2">See exactly where you stand and what to improve</p>
            <p className="text-white/50 text-sm mb-6">After every lesson, your instructor logs your performance directly into DriveBook — giving you personalised feedback on exactly what to work on next.</p>
            <p className="text-xs text-white/40">Scores are based on your instructor&apos;s observations and are a learning guide only. Always follow your instructor&apos;s advice on test readiness — DriveBook does not certify when you are ready to sit your test.</p>
          </div>
          <ProgressTrackingShowcase />
        </section>

        {/* How it works */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-lg text-white/70">From search to test-ready in 4 simple steps</p>
          </div>
          <BookingFlowShowcase />
        </section>

        {/* Simple Steps Summary */}
        <section className="bg-gradient-to-br from-white/5 to-white/0 border border-amber-500/30 p-8 md:p-10 rounded-2xl backdrop-blur-sm my-12 md:my-16">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6">Quick Summary</h3>
          <ol className="text-base md:text-lg space-y-3 text-white/80">
            <li><span className="text-amber-400 font-bold">1.</span> Search or enter your postcode</li>
            <li><span className="text-amber-400 font-bold">2.</span> Choose an instructor and a timeslot</li>
            <li><span className="text-amber-400 font-bold">3.</span> Book and pay securely — get confirmation by SMS</li>
            <li><span className="text-amber-400 font-bold">4.</span> After each lesson, review your personalised feedback and track your progress to test day</li>
          </ol>
        </section>

        {/* What You Get - Learner Focused */}
        <section className="py-12 md:py-20">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-12">What You Get</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-purple-400/50 transition-all">
              <h3 className="text-lg font-bold text-white mb-2">💳 Flexible Payment</h3>
              <p className="text-white/70 text-sm">Pay per lesson or save with 5, 10, or 20-hour packages</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-blue-400/50 transition-all">
              <h3 className="text-lg font-bold text-white mb-2">📝 Test Preparation</h3>
              <p className="text-white/70 text-sm">Book mock tests and test-day packages to boost your confidence</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-green-400/50 transition-all">
              <h3 className="text-lg font-bold text-white mb-2">📊 Progress Tracking</h3>
              <p className="text-white/70 text-sm">View lesson notes and track your improvement over time</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 p-6 rounded-xl backdrop-blur-sm hover:border-amber-400/50 transition-all">
              <h3 className="text-lg font-bold text-white mb-2">✅ Instant Confirmation</h3>
              <p className="text-white/70 text-sm">Get booking confirmation via SMS immediately</p>
            </div>
          </div>
        </section>



        {/* FAQ - Learner Focused */}
        <section className="py-12 md:py-20">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-12">Frequently Asked Questions</h2>
          
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: How do I know an instructor is qualified?</strong></p>
              <p className="text-white/70">A: All instructors must provide valid credentials and undergo background checks. You can also read reviews from real students before booking.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: Can I cancel or reschedule my lesson?</strong></p>
              <p className="text-white/70">A: Yes! You can cancel or reschedule through your dashboard. Each instructor&apos;s cancellation policy is clearly shown on their profile.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: What payment methods do you accept?</strong></p>
              <p className="text-white/70">A: We accept all major credit/debit cards and process payments securely through Stripe.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: How do bulk packages work?</strong></p>
              <p className="text-white/70">A: Purchase 5, 10, or 20-hour packages at a discounted rate. Hours are added to your account and you can book lessons as needed.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: Can I choose my own instructor?</strong></p>
              <p className="text-white/70">A: Absolutely! Browse instructor profiles, read reviews, check their availability, and choose the one that&apos;s right for you.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-lg hover:border-white/20 hover:bg-white/10 transition-all backdrop-blur-sm">
              <p className="mb-3"><strong className="text-cyan-400 text-lg">Q: What if I need to contact my instructor?</strong></p>
              <p className="text-white/70">A: You can message your instructor directly through the platform, or call our AI receptionist 24/7 for immediate assistance.</p>
            </div>
          </div>
        </section>

        {/* CTA - Learner Focused */}
        <section className="bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-8 md:p-16 rounded-2xl text-center my-12 md:my-20 shadow-2xl shadow-purple-900/50">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Start Your Driving Journey?</h2>
          <p className="text-xl text-purple-100 mb-10">Book your first lesson today and pass your test with confidence.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/book" className="inline-block bg-white text-violet-900 px-10 py-4 rounded-xl no-underline font-bold text-lg shadow-xl shadow-purple-900/50 hover:shadow-purple-500/50 hover:scale-105 transition-all">
              Find Your Instructor →
            </Link>
            {VOICE_NUMBER && (
              <a href={`tel:${VOICE_NUMBER}`} className="inline-block bg-gradient-to-r from-pink-500 to-violet-500 text-white px-10 py-4 rounded-xl no-underline font-bold text-lg border-2 border-white/20 hover:shadow-lg hover:from-pink-400 hover:to-violet-400 transition-all shadow-lg shadow-purple-500/20">
                Or Call {VOICE_NUMBER}
              </a>
            )}
          </div>
          <p className="mt-8 text-purple-200">
            Are you a driving instructor? <Link href="/teach-with-drivebook" className="text-white underline font-semibold hover:text-purple-100 transition-colors">Learn how DriveBook can grow your business →</Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 backdrop-blur border-t border-white/10 text-white py-12 px-4 md:px-8 mt-16">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8 text-left">
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
          © {new Date().getFullYear()} DriveBook. All rights reserved. ·{' '}
          <Link href="/terms" className="hover:text-white/60 transition-colors no-underline">Learner Terms</Link> ·{' '}
          <Link href="/instructor-terms" className="hover:text-white/60 transition-colors no-underline">Instructor Terms</Link> ·{' '}
          <Link href="/privacy" className="hover:text-white/60 transition-colors no-underline">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
