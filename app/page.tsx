'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import BookingFlowShowcase from '@/components/landing/BookingFlowShowcase'
import TrustSafetyShowcase from '@/components/landing/TrustSafetyShowcase'
import AIReceptionistShowcase from '@/components/landing/AIReceptionistShowcase'
import ProgressTrackingShowcase from '@/components/landing/ProgressTrackingShowcase'
import PackagePricingShowcase from '@/components/landing/PackagePricingShowcase'

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-purple-600 no-underline">
            DriveBook
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/about" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              About Us
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              Contact Us
            </Link>
            <Link href="/blog" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              Blog
            </Link>
            <Link href="/teach-with-drivebook" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              For Instructors
            </Link>
            <Link href="/login" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              Login
            </Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-lg no-underline font-medium hover:bg-purple-700">
              Sign Up
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 py-4">
            <div className="max-w-7xl mx-auto px-4 space-y-2">
              <Link href="/about" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                About Us
              </Link>
              <Link href="/contact" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                Contact Us
              </Link>
              <Link href="/blog" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                Blog
              </Link>
              <Link href="/terms" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                Terms & Conditions
              </Link>
              <Link href="/privacy" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                Privacy Policy
              </Link>
              <Link href="/teach-with-drivebook" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                For Instructors
              </Link>
              <Link href="/login" className="block text-gray-700 hover:text-purple-600 no-underline font-medium py-2">
                Login
              </Link>
              <Link href="/register" className="block bg-purple-600 text-white px-5 py-2 rounded-lg no-underline font-medium hover:bg-purple-700 text-center">
                Sign Up
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Learner Focused */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-20 px-4 text-center">
        <h1 className="text-5xl font-bold mb-4">Pass Your Driving Test with Confidence</h1>
        <p className="text-2xl mb-6 opacity-95">Book verified local instructors in seconds. Flexible lessons, transparent pricing, guaranteed safety.</p>
        <ul className="list-none p-0 my-6 text-left inline-block max-w-2xl text-lg">
          <li className="my-2">🎯 Smart booking with real-time availability—no waiting, no phone tag</li>
          <li className="my-2">📍 Location-based matching to find instructors who service your area</li>
          <li className="my-2">💰 Save up to 12% with bulk hour packages and test preparation bundles</li>
          <li className="my-2">🛡️ Every instructor is background-checked and fully verified</li>
          <li className="my-2">📱 Manage everything 24/7 from your personal dashboard</li>
        </ul>
        <div className="mt-8">
          <Link href="/book" className="inline-block bg-white text-purple-600 px-10 py-5 rounded-lg no-underline font-bold text-xl hover:-translate-y-1 hover:shadow-2xl transition-all">
            Find Your Perfect Instructor →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {/* Trust & Safety Section */}
        <section className="my-16 pt-8">
          <h2 className="text-4xl text-center mb-4 text-gray-800">Your Safety is Guaranteed</h2>
          <p className="text-center text-gray-600 mb-10 text-lg">Every instructor undergoes rigorous verification</p>
          <TrustSafetyShowcase />
        </section>

        {/* Why Choose DriveBook - Learner Focused */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">Why Choose DriveBook?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Verified Instructors</h3>
              <p className="text-gray-700">Every instructor is background-checked, qualified, and reviewed by real students. Your safety is guaranteed.</p>
            </div>
            
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Book in Seconds</h3>
              <p className="text-gray-700">See real-time availability and reserve your lesson instantly—no phone calls, no waiting, no hassle.</p>
            </div>
            
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Flexible Packages</h3>
              <p className="text-gray-700">Pay-as-you-go or save up to 12% with bulk packages. Cancel or reschedule easily through your dashboard.</p>
            </div>
            
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Smart Reminders</h3>
              <p className="text-gray-700">Get SMS notifications before your lesson so you never miss a session. Stay on track with your learning.</p>
            </div>
            
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Track Your Progress</h3>
              <p className="text-gray-700">View lesson notes and track your improvement over time. See exactly what you need to work on.</p>
            </div>
            
            <div className="bg-white border-2 border-purple-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Test Preparation</h3>
              <p className="text-gray-700">Book mock tests and test-day packages to boost your confidence and pass on your first try.</p>
            </div>
          </div>
        </section>

        {/* AI Voice Receptionist Showcase */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-4 text-gray-800">Book by Phone - AI Answers 24/7</h2>
          <p className="text-center text-gray-600 mb-10 text-lg">Prefer to call? Our AI receptionist handles everything</p>
          <AIReceptionistShowcase />
        </section>

        {/* Progress Tracking Showcase */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-4 text-gray-800">Track Your Progress</h2>
          <p className="text-center text-gray-600 mb-10 text-lg">See exactly where you stand and what to improve</p>
          <ProgressTrackingShowcase />
        </section>

        {/* How it works */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-4 text-gray-800">How It Works</h2>
          <p className="text-center text-gray-600 mb-10 text-lg">Book your driving lesson in 3 simple steps</p>
          <BookingFlowShowcase />
        </section>

        {/* Simple Steps Summary */}
        <section className="bg-amber-50 p-8 rounded-xl border-l-4 border-amber-500 my-16">
          <h3 className="text-2xl mb-4 font-semibold">Quick Summary</h3>
          <ol className="text-lg my-4 space-y-3">
            <li>Search or enter your postcode</li>
            <li>Choose an instructor and a timeslot</li>
            <li>Book and pay securely—get confirmation by SMS</li>
          </ol>
        </section>

        {/* What You Get - Learner Focused */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">What You Get</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-6 rounded-xl">
              <h3 className="text-xl mb-2 font-semibold text-gray-900">💳 Flexible Payment</h3>
              <p className="text-gray-700">Pay per lesson or save with 5, 10, or 20-hour packages</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-6 rounded-xl">
              <h3 className="text-xl mb-2 font-semibold text-gray-900">📝 Test Preparation</h3>
              <p className="text-gray-700">Book mock tests and test-day packages to boost your confidence</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-6 rounded-xl">
              <h3 className="text-xl mb-2 font-semibold text-gray-900">📊 Progress Tracking</h3>
              <p className="text-gray-700">View lesson notes and track your improvement over time</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-6 rounded-xl">
              <h3 className="text-xl mb-2 font-semibold text-gray-900">✅ Instant Confirmation</h3>
              <p className="text-gray-700">Get booking confirmation via SMS immediately</p>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-6 text-gray-800">What Our Community Says</h2>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            I passed my test on the first try! DriveBook matched me with an instructor who understood exactly what I needed. The booking system made everything so easy. <strong>— Sarah M., Perth</strong>
          </blockquote>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            Since joining DriveBook, my bookings have doubled. The AI receptionist handles calls while I'm teaching, and I get paid on time every week. Game changer! <strong>— James T., Driving Instructor</strong>
          </blockquote>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            The bulk package saved me money and the SMS reminders kept me on track. Highly recommend! <strong>— Michael K., New Driver</strong>
          </blockquote>
        </section>

        {/* FAQ - Learner Focused */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">Frequently Asked Questions</h2>
          
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: How do I know an instructor is qualified?</strong></p>
              <p className="text-gray-700">A: All instructors must provide valid credentials and undergo background checks. You can also read reviews from real students before booking.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: Can I cancel or reschedule my lesson?</strong></p>
              <p className="text-gray-700">A: Yes! You can cancel or reschedule through your dashboard. Each instructor&apos;s cancellation policy is clearly shown on their profile.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: What payment methods do you accept?</strong></p>
              <p className="text-gray-700">A: We accept all major credit/debit cards and process payments securely through Stripe.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: How do bulk packages work?</strong></p>
              <p className="text-gray-700">A: Purchase 5, 10, or 20-hour packages at a discounted rate. Hours are added to your account and you can book lessons as needed.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: Can I choose my own instructor?</strong></p>
              <p className="text-gray-700">A: Absolutely! Browse instructor profiles, read reviews, check their availability, and choose the one that&apos;s right for you.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-purple-600 text-lg">Q: What if I need to contact my instructor?</strong></p>
              <p className="text-gray-700">A: You can message your instructor directly through the platform, or call our AI receptionist 24/7 for immediate assistance.</p>
            </div>
          </div>
        </section>

        {/* CTA - Learner Focused */}
        <section id="get-started" className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-12 rounded-2xl text-center my-16 shadow-2xl">
          <h2 className="text-4xl font-bold mb-4 mt-0">Ready to Start Your Driving Journey?</h2>
          <p className="text-xl mb-8">Find a verified instructor near you and book your first lesson today. Pass your test with confidence.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/book" className="inline-block bg-white text-purple-600 px-10 py-5 rounded-lg no-underline font-bold text-lg hover:-translate-y-1 hover:shadow-2xl transition-all">
              Find Your Instructor →
            </Link>
            {VOICE_NUMBER && (
              <a href={`tel:${VOICE_NUMBER}`} className="inline-block bg-purple-500 text-white px-10 py-5 rounded-lg no-underline font-bold text-lg hover:-translate-y-1 hover:shadow-2xl transition-all border-2 border-white">
                Or Call {VOICE_NUMBER}
              </a>
            )}
          </div>
          <p className="mt-6 text-purple-100">
            Are you a driving instructor? <Link href="/teach-with-drivebook" className="text-white underline font-semibold hover:text-purple-200">Learn how DriveBook can grow your business →</Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-10 px-4 text-center mt-16">
        <p>DriveBook - Connecting learners with professional driving instructors</p>
        <p className="mt-4 text-sm">Last updated: Feb 28, 2026</p>
      </footer>
    </div>
  )
}
