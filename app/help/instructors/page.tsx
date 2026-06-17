'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function InstructorHelpPage() {
  const sections = [
    { id: 'account', title: 'Create & Get Approved', icon: '✅' },
    { id: 'profile', title: 'Set Up Your Profile', icon: '👤' },
    { id: 'availability', title: 'Set Your Availability', icon: '📅' },
    { id: 'pricing', title: 'Subscription & Pricing', icon: '💰' },
    { id: 'bookings', title: 'Manage Bookings', icon: '📋' },
    { id: 'payouts', title: 'Set Up Payouts', icon: '🏦' },
    { id: 'earnings', title: 'Track Earnings', icon: '💵' },
    { id: 'reviews', title: 'Manage Reviews', icon: '⭐' },
    { id: 'offline', title: 'Record Offline Bookings', icon: '📝' },
    { id: 'faq', title: 'Common Questions', icon: '❓' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/help" className="flex items-center gap-2 text-emerald-300 hover:text-emerald-200 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Help Center
          </Link>
          <h1 className="text-3xl font-bold">Instructor Guide</h1>
          <p className="text-emerald-200 mt-2">Complete guide to managing your lessons and getting paid</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Quick Navigation */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sections.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="bg-slate-900 hover:bg-slate-800 px-4 py-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <span className="mr-2">{section.icon}</span>
                <span className="text-sm font-medium">{section.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          
          {/* Account */}
          <section id="account" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">✅ Create & Get Approved</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>What you need:</strong> Email, password, name, phone, valid ID, ABN (optional)</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to DriveBook and click "Sign Up"</li>
                <li>Select "I'm an Instructor"</li>
                <li>Enter your details and verify email</li>
                <li>Upload documents (ID, working permit, police check)</li>
                <li>⏳ Wait 2-5 business days for approval</li>
                <li>✅ You'll get approval email</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Tip:</strong> Upload ALL documents immediately — the sooner you upload, the sooner you're approved!</p>
            </div>
          </section>

          {/* Profile */}
          <section id="profile" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">👤 Set Up Your Profile</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Profile" → "Edit Profile"</li>
                <li>Add professional photo</li>
                <li>Write your bio (what makes you great)</li>
                <li>Add years of experience</li>
                <li>List specialties (nervous students, manual, etc.)</li>
                <li>Save changes</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Pro tip:</strong> Better profile = more bookings. Be detailed about your teaching style!</p>
            </div>
          </section>

          {/* Availability */}
          <section id="availability" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📅 Set Your Availability</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Only show times you're ACTUALLY available</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Availability"</li>
                <li>Click on times you can teach</li>
                <li>Set recurring schedule (e.g., "Every Mon 9 AM - 5 PM")</li>
                <li>Save changes</li>
                <li>✅ Students can now book these times</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Taking time off?</strong> Go to "Block Time" and select your vacation/sick dates.</p>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">💰 Subscription & Pricing</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Choose your subscription tier:</strong></p>
              <ul className="space-y-3 ml-2">
                <li>🟦 <strong>Basic:</strong> $29/month, 15% commission</li>
                <li>🟩 <strong>Pro:</strong> $79/month, 12% commission</li>
                <li>🟪 <strong>Studio:</strong> $129/month, 11% commission (custom domain included)</li>
                <li>🟫 <strong>Business:</strong> $199/month, 10% commission (multiple instructors)</li>
              </ul>
              <p className="text-slate-400 text-sm mt-3"><strong>How earnings work:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Student pays $100 for a lesson</li>
                <li>Platform takes 3.6% fee = $3.60</li>
                <li>Remaining: $96.40</li>
                <li>Your tier takes commission (e.g., Pro 12% = $11.57)</li>
                <li>You receive: $84.83</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>Trial:</strong> 14 days free for all tiers (30 days for Business). After trial, you're charged monthly.</p>
            </div>
          </section>

          {/* Bookings */}
          <section id="bookings" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📋 Create & Manage Bookings</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Book lessons for your students:</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Bookings"</li>
                <li>Click "Book a Lesson" (or "Create Offline Booking" for cash/bank payments)</li>
                <li>Pick a student from your list (or add new)</li>
                <li>Select date, time, and duration</li>
                <li>Add notes if needed</li>
                <li>System calculates price (your hourly rate × duration)</li>
                <li>Click "Confirm" → Booking created</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>Important:</strong> To create bookings, you must:</p>
              <ul className="space-y-1 ml-2">
                <li>✅ Be approved by admin (pending approval = no bookings)</li>
                <li>✅ Have an active subscription (trial or paid)</li>
              </ul>
              <p className="text-slate-400 text-sm mt-3"><strong>Wallet requirement:</strong> Student must have enough wallet balance to confirm. If short, they get emailed to top up within 10 minutes.</p>
            </div>
          </section>

          {/* Payouts */}
          <section id="payouts" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">🏦 Set Up Payouts</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Automatic payouts every Tuesday morning</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Settings" → "Payout & Tax Settings"</li>
                <li>Select "Stripe Connect" (recommended)</li>
                <li>Click "Connect with Stripe →"</li>
                <li>Enter business details and bank account (secure Stripe page)</li>
                <li>Complete identity verification</li>
                <li>✅ Status shows "Stripe account ready"</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>Important payout details:</strong></p>
              <ul className="space-y-1 ml-2">
                <li>• Payouts run every Tuesday at 2:00 AM</li>
                <li>• Your lesson must be completed at least 48 hours before payout to be included</li>
                <li>• If you have an ABN, verify it to avoid 47% tax withholding</li>
                <li>• Requires Stripe Connect setup (above)</li>
              </ul>
              <p className="text-slate-400 text-sm mt-3"><strong>Example:</strong> Lesson on Monday, completed Monday evening. Included in Tuesday payout.</p>
            </div>
          </section>

          {/* Earnings */}
          <section id="earnings" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">💵 Track Earnings</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Earnings" in your dashboard</li>
                <li>See this week's earnings</li>
                <li>See this month's total</li>
                <li>See all-time earnings</li>
                <li>Click "Transactions" for detailed history</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>What counts:</strong> Completed lessons only (not pending or cancelled)</p>
              <p className="text-slate-400 text-sm"><strong>When paid:</strong> Every Tuesday automatically to your bank account</p>
              <p className="text-slate-400 text-sm"><strong>Example:</strong> $100 lesson, Pro tier (12% commission) = You get $88</p>
            </div>
          </section>

          {/* Reviews */}
          <section id="reviews" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">⭐ Manage Reviews</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Your rating affects your visibility in search</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Profile" → "Reviews"</li>
                <li>See all student reviews</li>
                <li>See your overall star rating</li>
                <li>Respond to reviews (optional)</li>
                <li>Keep rating at 4.5+ for best visibility</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>Affects your rating:</strong></p>
              <ul className="space-y-1 ml-2">
                <li>✅ Professional behavior</li>
                <li>✅ Quality instruction</li>
                <li>✅ Good communication</li>
                <li>❌ Cancellations</li>
                <li>❌ Being late</li>
              </ul>
            </div>
          </section>

          {/* Offline Bookings */}
          <section id="offline" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📝 Record Offline Bookings</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>For lessons outside the platform (cash, friends, etc.)</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "Bookings" → "Add Offline Booking"</li>
                <li>Enter student name</li>
                <li>Enter date, time, duration</li>
                <li>Enter amount paid</li>
                <li>Add notes (what you worked on)</li>
                <li>Save</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Why record offline?</strong> Tracks your total earnings, helps with taxes, counts toward activity.</p>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">❓ Common Questions</h2>
            <div className="space-y-4 text-slate-300">
              <div>
                <p className="font-semibold">Q: How long until I'm approved?</p>
                <p className="text-slate-400">A: Usually 2-5 business days. Upload documents immediately for faster approval.</p>
              </div>
              <div>
                <p className="font-semibold">Q: When do I get paid?</p>
                <p className="text-slate-400">A: Every Tuesday automatically. Money appears in your bank 1-2 days later.</p>
              </div>
              <div>
                <p className="font-semibold">Q: Can I change my hourly rate?</p>
                <p className="text-slate-400">A: Yes, anytime. Changes apply to new bookings only.</p>
              </div>
              <div>
                <p className="font-semibold">Q: What if a student doesn't show up?</p>
                <p className="text-slate-400">A: Mark as "No-show" — you still get paid.</p>
              </div>
              <div>
                <p className="font-semibold">Q: Can I set package discounts?</p>
                <p className="text-slate-400">A: Not per student, but you can offer package rates. Pricing applies to everyone equally.</p>
              </div>
              <div>
                <p className="font-semibold">Q: How do I respond to bad reviews?</p>
                <p className="text-slate-400">A: Go to Profile → Reviews → Click review → Add response. Keep it professional!</p>
              </div>
            </div>
          </section>

        </div>

        {/* Contact Support */}
        <div className="mt-12 bg-slate-800 rounded-lg p-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Need help?</h2>
          <p className="text-slate-300 mb-4">Our instructor support team is here for you</p>
          <a 
            href="mailto:instructors@drivebook.com.au"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Contact Instructor Support
          </a>
        </div>
      </div>
    </div>
  );
}
