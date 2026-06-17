'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function StudentHelpPage() {
  const sections = [
    { id: 'account', title: 'Create Your Account', icon: '📱' },
    { id: 'find', title: 'Find an Instructor', icon: '🔍' },
    { id: 'book', title: 'Book Your First Lesson', icon: '📅' },
    { id: 'payment', title: 'Make a Payment', icon: '💳' },
    { id: 'reschedule', title: 'Reschedule or Cancel', icon: '↔️' },
    { id: 'history', title: 'Check Booking History', icon: '📊' },
    { id: 'review', title: 'Leave a Review', icon: '⭐' },
    { id: 'profile', title: 'Update Your Profile', icon: '👤' },
    { id: 'faq', title: 'Common Questions', icon: '❓' },
    { id: 'troubleshoot', title: 'Troubleshooting', icon: '🔧' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-900 to-sky-800 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/help" className="flex items-center gap-2 text-sky-300 hover:text-sky-200 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Help Center
          </Link>
          <h1 className="text-3xl font-bold">Student Guide</h1>
          <p className="text-sky-200 mt-2">Everything you need to know about using DriveBook</p>
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
          
          {/* Create Account */}
          <section id="account" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📱 Create Your Account</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>What you need:</strong> Email, password, name, phone number</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to DriveBook homepage</li>
                <li>Click "Sign Up"</li>
                <li>Select "I'm a Student"</li>
                <li>Enter your details</li>
                <li>Check email for confirmation link</li>
                <li>✅ You're ready to go!</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4">Tip: Add a profile photo and location for better instructor matches.</p>
            </div>
          </section>

          {/* Find Instructor */}
          <section id="find" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">🔍 Find an Instructor</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to the booking page</li>
                <li>Browse all approved instructors listed by name</li>
                <li>See each instructor's profile: photo, rating, hourly rate, vehicle types (manual/automatic)</li>
                <li>Click on an instructor to see their full profile</li>
                <li>Read their bio, reviews, and availability</li>
                <li>When ready, instructor books you for available date/time</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>All instructors shown:</strong> Only approved instructors with active subscriptions appear. No filtering by location, price, or specialty available in the app.</p>
              <p className="text-slate-400 text-sm"><strong>Rating info:</strong> You can see instructor reviews and star rating (1-5 stars). Higher rated instructors usually get more bookings.</p>
            </div>
          </section>

          {/* Book Lesson */}
          <section id="book" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📅 Book Your First Lesson</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Instructor selects your name, date, time, and duration</li>
                <li>System calculates price (instructor hourly rate × duration)</li>
                <li>Booking created and waiting for payment</li>
                <li>You receive SMS with payment link</li>
                <li>Click link and enter your card details (secure Stripe page)</li>
                <li>Click "Pay $X.XX" → Stripe processes payment</li>
                <li>✅ After payment confirmed: Booking locked in</li>
              </ol>
              <p className="text-slate-400 text-sm mt-3"><strong>No instructor approval step.</strong> Once payment confirmed, the lesson is booked. Check instructor's calendar to confirm date/time.</p>
              <p className="text-slate-400 text-sm"><strong>Important:</strong> You have 10 minutes to complete payment. If you don't pay within 10 minutes, the slot is released.</p>
            </div>
          </section>

          {/* Payment */}
          <section id="payment" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">💳 How Payment Works</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>You pay by card (via secure Stripe):</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Instructor books a lesson for you</li>
                <li>You get SMS with payment link</li>
                <li>Click link → see lesson details and total cost</li>
                <li>Click "Pay" → enter credit/debit card details</li>
                <li>Stripe processes payment (your card info never sent to DriveBook)</li>
                <li>✅ Payment confirmed → booking locked in</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Time limit:</strong> You have 10 minutes to complete payment. If you don't pay, the slot is released.</p>
              <p className="text-slate-400 text-sm"><strong>Safe?</strong> Yes — Stripe handles all payment security. We never see your card details.</p>
            </div>
          </section>

          {/* Reschedule */}
          <section id="reschedule" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">↔️ Reschedule or Cancel</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>Before confirmation:</strong> You can cancel anytime for full refund</p>
              <p><strong>After confirmation:</strong> Use reschedule or follow cancellation policy</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "My Bookings"</li>
                <li>Find your booking</li>
                <li>Click "Reschedule" or "Cancel"</li>
                <li>Choose new time (if rescheduling) or confirm cancellation</li>
                <li>✅ Changes saved</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4">Tip: Reschedule early — instructors have limited availability.</p>
            </div>
          </section>

          {/* History */}
          <section id="history" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">📊 Check Booking History</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to dashboard home</li>
                <li>Click "My Bookings"</li>
                <li>See all bookings (past and future)</li>
                <li>Click on any booking for details</li>
                <li>See instructor info, location, time, notes</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4"><strong>Booking status:</strong> Pending, Confirmed, Completed, Cancelled</p>
            </div>
          </section>

          {/* Review */}
          <section id="review" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">⭐ Leave a Review</h2>
            <div className="space-y-3 text-slate-300">
              <p><strong>After your lesson is completed:</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to "My Bookings"</li>
                <li>Find completed lesson</li>
                <li>Click "Leave a Review"</li>
                <li>Rate 1-5 stars</li>
                <li>Write your feedback</li>
                <li>Submit</li>
              </ol>
              <p className="text-slate-400 text-sm mt-4">Your honest review helps other students and helps instructors improve!</p>
            </div>
          </section>

          {/* Profile */}
          <section id="profile" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">👤 Update Your Profile</h2>
            <div className="space-y-3 text-slate-300">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Click your profile icon (top right)</li>
                <li>Select "Profile Settings"</li>
                <li>Update your info (name, email, phone, photo, address)</li>
                <li>Adjust privacy and notification settings</li>
                <li>Click "Save Changes"</li>
              </ol>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">❓ Common Questions</h2>
            <div className="space-y-4 text-slate-300">
              <div>
                <p className="font-semibold">Q: How long until the booking is confirmed?</p>
                <p className="text-slate-400">A: It's confirmed instantly after payment! No waiting for instructor response.</p>
              </div>
              <div>
                <p className="font-semibold">Q: What if I don't have enough wallet balance?</p>
                <p className="text-slate-400">A: The booking is held for 10 minutes. You'll get an email asking you to top up your wallet to confirm.</p>
              </div>
              <div>
                <p className="font-semibold">Q: Can I reschedule after booking?</p>
                <p className="text-slate-400">A: Yes, but only if the booking is confirmed (not while awaiting payment).</p>
              </div>
              <div>
                <p className="font-semibold">Q: Can I cancel my booking?</p>
                <p className="text-slate-400">A: Yes anytime. If you cancel while awaiting payment, it's free. After confirmation, cancellation policies apply.</p>
              </div>
              <div>
                <p className="font-semibold">Q: How do I pay?</p>
                <p className="text-slate-400">A: We use your wallet balance. If short, top up before the 10-minute window expires.</p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshoot" className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-2xl font-bold mb-4">🔧 Troubleshooting</h2>
            <div className="space-y-4 text-slate-300">
              <div>
                <p className="font-semibold">Payment failed?</p>
                <p className="text-slate-400">Check your card details, expiry, and funds. Try a different card.</p>
              </div>
              <div>
                <p className="font-semibold">Can't log in?</p>
                <p className="text-slate-400">Click "Forgot Password" and check your email for reset link.</p>
              </div>
              <div>
                <p className="font-semibold">Didn't receive confirmation email?</p>
                <p className="text-slate-400">Check spam folder. Wait 5 minutes or refresh the page.</p>
              </div>
              <div>
                <p className="font-semibold">Instructor not responding?</p>
                <p className="text-slate-400">Wait 24 hours. Booking auto-declines and you get refund.</p>
              </div>
            </div>
          </section>

        </div>

        {/* Contact Support */}
        <div className="mt-12 bg-slate-800 rounded-lg p-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Still need help?</h2>
          <p className="text-slate-300 mb-4">Our support team is ready to help</p>
          <a 
            href="mailto:support@drivebook.com.au"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
