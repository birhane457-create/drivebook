import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { motion } from 'framer-motion';

const VOICE_NUMBER = '+1 (708) 933-5601';

export default function TeachWithDriveBook() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section - Instructor Focused */}
      <header className="bg-gradient-to-r from-green-600 to-green-800 text-white py-12 md:py-20 px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grow Your Driving School with DriveBook</h1>
          <p className="text-xl md:text-2xl mb-6 opacity-95 max-w-2xl mx-auto">
            Automate bookings, payments, and admin. AI receptionist included — free.
          </p>
          <ul className="list-none p-0 my-6 text-left inline-block max-w-2xl text-base md:text-lg space-y-2">
            <li>📞 AI receptionist answers calls 24/7 — never miss a booking again</li>
            <li>💰 Zero setup fees — only pay a small fee per completed lesson</li>
            <li>📅 Automated scheduling, reminders, and SMS confirmations</li>
            <li>💳 Weekly payouts via direct deposit — no chasing payments</li>
          </ul>
          <div className="mt-8">
            <Link to="/register" className="inline-block bg-white text-green-700 px-10 py-4 rounded-lg font-bold text-xl hover:-translate-y-1 hover:shadow-2xl transition-all">
              Start Your Free Trial →
            </Link>
          </div>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Founder story */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16 bg-purple-50 border-l-4 border-purple-500 rounded-2xl p-8 md:p-10"
        >
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-3">Why this platform exists</p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Built for instructors — by someone who wished he could be one</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>I built DriveBook while living with a neurological condition that took away my ability to work the way I'd planned. I'm not a driving instructor — I wish my health allowed it. But I couldn't teach, so I built the platform I wished existed for those who can.</p>
            <p>I watched instructors lose bookings to missed calls, chase payments, and burn time on admin that had nothing to do with teaching. I had the skills and the drive to fix it — even when my health made every day uncertain.</p>
            <p>Every feature — the AI receptionist, automated payouts, the booking system — came from real problems real instructors face. I may not be able to teach, but I can build something that makes teaching easier for everyone who does.</p>
            <p className="font-semibold text-purple-700">— Birhane, Founder of DriveBook</p>
          </div>
        </motion.section>

        {/* AI Receptionist */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center">📞 Your Free 24/7 Virtual Receptionist</h2>
          <p className="text-center text-gray-600 mb-10 text-lg">Never Miss Another Booking While You Teach</p>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="bg-white rounded-2xl border-2 border-red-100 p-6 md:p-8">
              <h3 className="font-bold text-gray-900 text-lg mb-4">Picture this scenario:</h3>
              <p className="text-gray-600 mb-4">You're helping a nervous student parallel park. Your phone rings - it's a parent ready to book a $1,000 package.</p>
              <div className="space-y-3">
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <p className="text-sm font-semibold text-red-700 mb-1">❌ With traditional driving schools:</p>
                  <p className="text-sm text-red-600">That call goes to voicemail. The parent hangs up and calls your competitor. Revenue lost forever.</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <p className="text-sm font-semibold text-green-700 mb-1">✅ With DriveBook:</p>
                  <p className="text-sm text-green-600">Your AI receptionist answers professionally, checks your real-time availability, books the lesson instantly, and sends SMS confirmation to both parties. All while you stay focused on teaching.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 text-lg">What Your AI Receptionist Does:</h3>
              {[
                ['Answers calls professionally', 'Introduces your driving school by name'],
                ['Checks real-time availability', 'Knows your exact schedule'],
                ['Books lessons instantly', 'Secures the booking while they\'re on the phone'],
                ['Sends SMS confirmations', 'To both you and the student'],
                ['Handles rescheduling', 'Manages changes without interrupting you'],
              ].map(([title, sub]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="text-green-500 font-bold text-lg flex-shrink-0">✓</span>
                  <div>
                    <span className="font-semibold text-gray-800">{title}</span>
                    <span className="text-gray-500"> — {sub}</span>
                  </div>
                </div>
              ))}

              <div className="mt-6 bg-purple-600 rounded-2xl p-5 text-white text-center">
                <p className="text-sm mb-1">Try it now - Call to experience it</p>
                <a href={`tel:${VOICE_NUMBER}`} className="text-2xl font-bold no-underline text-white">{VOICE_NUMBER}</a>
                <p className="text-xs text-purple-200 mt-1">Available 24/7 • Never Sleeps • Never Misses a Call</p>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-sm font-semibold text-amber-800 mb-1">💡 Recovered Revenue Calculator</p>
                <p className="text-sm text-amber-700">Average driving instructor misses 3-5 calls per week while teaching. At $500 average package value, that's <strong>$1,500–$2,500 in lost revenue every week</strong>. Your AI receptionist pays for itself instantly.</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Why Instructors Choose Us */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center">Why Instructors Choose DriveBook</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '💰', title: 'Zero Setup Fees', desc: 'Start with a free trial - no credit card required. Only pay a small platform fee per completed lesson.' },
              { icon: '📈', title: 'More Students', desc: 'Appear in local searches when learners are actively looking. Get discovered by students in your area right now.' },
              { icon: '⚡', title: 'Automated Admin', desc: 'Stop chasing payments and managing spreadsheets. We handle scheduling, payments, and reminders automatically.' },
              { icon: '💳', title: 'Weekly Payouts', desc: 'Get paid every week via direct deposit. Transparent fee structure with no hidden costs.' },
              { icon: '📅', title: 'Full Control', desc: 'Set your own availability, pricing, and cancellation policy. You\'re in complete control of your schedule.' },
              { icon: '📱', title: 'Professional Dashboard', desc: 'Manage your calendar, track earnings, view student notes, and monitor performance all in one place.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-green-200 hover:shadow-lg transition-all">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* How It Works */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center">How It Works — Get Started in 3 Steps</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'Sign Up & Create Your Profile', desc: 'Complete your instructor profile with credentials, availability, and pricing. Takes less than 10 minutes.' },
              { num: '2', title: 'Get Verified', desc: 'Submit your credentials for verification. We check your license, insurance, and background to ensure quality.' },
              { num: '3', title: 'Start Receiving Bookings', desc: 'Go live and start receiving bookings. Your AI receptionist is ready to handle calls 24/7 from day one.' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">{step.num}</div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Early Access CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 md:p-10 text-center"
        >
          <p className="text-gray-600 mb-4">Be among the first instructors on DriveBook — early members shape the platform.</p>
          <div className="inline-block bg-green-600 text-white rounded-2xl px-6 py-4 mb-6">
            <p className="font-bold text-lg">🎯 Early Access — Limited Spots</p>
            <p className="text-sm text-green-100 mt-1">DriveBook is launching soon. The first instructors to join get priority listing, lower commission rates during the launch period, and direct input into new features.</p>
          </div>
          <div>
            <Link to="/register" className="inline-block bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 hover:-translate-y-0.5 transition-all">
              Claim Your Spot →
            </Link>
          </div>
        </motion.section>

        {/* Pricing */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-green-200 p-8 shadow-lg">
            <h3 className="font-bold text-xl text-gray-900 mb-2">Pay Per Completed Lesson</h3>
            <p className="text-gray-500 mb-6">No monthly fees. No hidden costs.</p>
            <ul className="space-y-3 text-left mb-8">
              {[
                'Free trial — Test the platform with no commitment',
                'Small platform fee — Only charged on completed lessons',
                'AI receptionist included — Free 24/7 call handling',
                'Weekly payouts — Direct deposit every week',
                'No setup fees — Start earning immediately',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 font-bold flex-shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className="block w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
              Start Your Free Trial →
            </Link>
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16 max-w-3xl mx-auto"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'How much does it cost to join?', a: 'Start with a free trial. After that, we charge a small platform fee per completed lesson - no monthly fees or hidden costs.' },
              { q: 'How do I get paid?', a: 'Payments are processed weekly via direct deposit. You can track all earnings in your instructor dashboard in real-time.' },
              { q: 'Can I set my own availability and pricing?', a: 'Absolutely! You control your schedule completely. Set your working hours, block off time, update availability in real-time, and set your own pricing.' },
              { q: "What if a student doesn't show up?", a: 'Our automated SMS reminders reduce no-shows significantly. You can also set your own cancellation policy and charge for late cancellations.' },
              { q: 'How does the AI receptionist work?', a: 'The AI answers calls 24/7, checks your real-time availability, books lessons, and sends SMS confirmations - all automatically while you focus on teaching.' },
              { q: 'What credentials do I need?', a: 'You need a valid driving instructor license, comprehensive insurance, and a clean background check. We verify all credentials before you go live.' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="font-semibold text-gray-900 mb-2">Q: {faq.q}</p>
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="my-16 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-2xl p-10 md:p-16 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Grow Your Driving School?</h2>
          <p className="text-lg text-green-100 mb-8">Join DriveBook today and start receiving bookings with zero setup fees. Your AI receptionist is waiting.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="inline-block bg-white text-green-700 px-8 py-4 rounded-xl font-bold text-lg hover:-translate-y-0.5 hover:shadow-xl transition-all">
              Start Your Free Trial →
            </Link>
            <a href={`tel:${VOICE_NUMBER}`} className="inline-block border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all no-underline">
              Or Call {VOICE_NUMBER}
            </a>
          </div>
          <p className="mt-6 text-sm text-green-200">
            Looking for driving lessons?{' '}
            <Link to="/" className="text-white underline underline-offset-4 hover:text-green-100">Find an instructor near you →</Link>
          </p>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}