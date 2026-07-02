import Link from 'next/link'
import { Mail, MessageCircle, Clock, HelpCircle } from 'lucide-react'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Contact Us | DriveBook',
  description: 'Get in touch with the DriveBook team. We\'re here to help learners and instructors.',
  openGraph: {
    title: 'Contact DriveBook Support',
    description: 'Email support, instructor enquiries, and common questions answered.',
    url: 'https://drivebook.com.au/contact',
  },
  alternates: { canonical: 'https://drivebook.com.au/contact' },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="bg-slate-950/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
          <div className="flex items-center gap-4">
            <Link href="/book" className="text-white/70 hover:text-white font-medium hidden md:block no-underline">Find Instructor</Link>
            <Link href="/login" className="text-white/70 hover:text-white font-medium no-underline">Login</Link>
            <Link href="/register" className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-2 rounded-xl font-bold hover:from-pink-400 hover:to-violet-400 transition-all no-underline">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
        <p className="text-xl text-purple-100 max-w-2xl mx-auto">
          Have a question or need help? We're here for you.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12">

          {/* Contact options */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white">Get in Touch</h2>

            <div className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Email Support</h3>
                <p className="text-white/60 text-sm mb-2">For general enquiries, billing, or account issues.</p>
                <a href="mailto:support@drivebook.com.au" className="text-violet-400 font-medium hover:underline">
                  support@drivebook.com.au
                </a>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                <MessageCircle className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Instructor Enquiries</h3>
                <p className="text-white/60 text-sm mb-2">Interested in joining DriveBook as an instructor?</p>
                <a href="mailto:instructors@drivebook.com.au" className="text-green-400 font-medium hover:underline">
                  instructors@drivebook.com.au
                </a>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Response Times</h3>
                <p className="text-white/60 text-sm">We aim to respond to all enquiries within <strong>1 business day</strong>. For urgent booking issues, email us with "URGENT" in the subject line.</p>
              </div>
            </div>

            <div className="flex gap-4 p-6 bg-amber-900/20 border border-amber-700/50 rounded-xl">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                <HelpCircle className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Already a Member?</h3>
                <p className="text-white/60 text-sm mb-2">Log in to access your dashboard where you can manage bookings, view your wallet, and get help directly.</p>
                <Link href="/login" className="text-amber-400 font-medium hover:underline">Go to your dashboard →</Link>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Common Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: 'How do I cancel or reschedule a booking?',
                  a: 'Log in to your client dashboard and go to My Bookings. You can cancel or reschedule from there. Refunds are processed automatically based on our cancellation policy.'
                },
                {
                  q: 'I haven\'t received my refund — what do I do?',
                  a: 'Refunds go to your DriveBook wallet immediately. To withdraw to your original payment method, contact support@drivebook.com.au with your booking reference.'
                },
                {
                  q: 'How do I report a problem with an instructor?',
                  a: 'Email support@drivebook.com.au with your booking details. All reports are reviewed within 1 business day and treated confidentially.'
                },
                {
                  q: 'How do I join as an instructor?',
                  a: 'Visit our For Instructors page to learn about the process and apply. We verify all instructors before they can accept bookings.'
                },
                {
                  q: 'Is my payment information secure?',
                  a: 'Yes. All payments are processed by Stripe, a PCI-DSS Level 1 certified payment provider. DriveBook never stores your card details.'
                },
              ].map((item, i) => (
                <details key={i} className="group border border-white/10 bg-white/5 rounded-lg hover:border-white/20 transition-all">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-medium text-white hover:text-violet-400 select-none">
                    {item.q}
                    <span className="text-white/40 group-open:rotate-180 transition-transform text-lg">↓</span>
                  </summary>
                  <p className="px-4 pb-4 text-sm text-white/60 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-8 p-6 bg-violet-900/20 rounded-xl border border-violet-700/40">
              <p className="text-sm text-white/70">
                <strong>For Instructors:</strong> If you have a question about payouts, your account, or platform features, visit the{' '}
                <Link href="/teach-with-drivebook" className="text-violet-400 hover:underline">For Instructors</Link> page or email{' '}
                <a href="mailto:instructors@drivebook.com.au" className="text-violet-400 hover:underline">instructors@drivebook.com.au</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 backdrop-blur border-t border-white/10 text-white py-10 px-4 mt-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Logo size={28} dark />
            <p className="text-white/50 text-sm">Connecting learners with professional driving instructors across Australia.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Company</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/about" className="hover:text-white">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link href="/teach-with-drivebook" className="hover:text-white">For Instructors</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Legal</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/terms" className="hover:text-white">Learner Terms</Link></li>
              <li><Link href="/instructor-terms" className="hover:text-white">Instructor Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3 text-white">Get Started</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/book" className="hover:text-white">Find an Instructor</Link></li>
              <li><Link href="/register" className="hover:text-white">Create Account</Link></li>
              <li><Link href="/login" className="hover:text-white">Login</Link></li>
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
