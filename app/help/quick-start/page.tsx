'use client';

import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';

export default function QuickStartPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-900 to-yellow-800 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/help" className="flex items-center gap-2 text-yellow-300 hover:text-yellow-200 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Help Center
          </Link>
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-300" />
            <h1 className="text-3xl font-bold">Quick Start</h1>
          </div>
          <p className="text-yellow-200 mt-2">Get going in 30 seconds</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* For Students */}
        <div className="mb-12 bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-2">👨‍🎓 I'm a Student</h2>
          <p className="text-slate-400 mb-6">Start booking lessons in 3 minutes</p>
          
          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 1: Sign Up (2 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Go to drivebook.com.au</li>
              <li>2. Click "Sign Up" → Choose "Student"</li>
              <li>3. Enter email, password, name, phone</li>
              <li>4. Click email verification link</li>
              <li>✅ Account ready!</li>
            </ol>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 2: Find Instructor (1 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Click "Browse Instructors"</li>
              <li>2. Filter by location or price</li>
              <li>3. Click on instructor you like</li>
              <li>4. Read their bio and reviews</li>
              <li>✅ Found someone!</li>
            </ol>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700">
            <h3 className="font-semibold text-slate-200 mb-4">Step 3: Book Lesson (1 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Click "Book a Lesson"</li>
              <li>2. Pick date & time (green = available)</li>
              <li>3. Add any special notes</li>
              <li>4. Enter payment details</li>
              <li>5. Click "Confirm"</li>
              <li>✅ Instructor will accept within 24 hours!</li>
            </ol>
          </div>

          <p className="text-slate-400 text-sm mt-6">
            <strong>Pro tip:</strong> Check instructor ratings and reviews. Higher ratings = better availability.
          </p>

          <Link 
            href="/help/students"
            className="inline-block mt-6 bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Full Student Guide →
          </Link>
        </div>

        {/* For Instructors */}
        <div className="mb-12 bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-2">👨‍🏫 I'm an Instructor</h2>
          <p className="text-slate-400 mb-6">Start accepting bookings in 15 minutes</p>
          
          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 1: Sign Up & Get Approved (2 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Go to drivebook.com.au → Click "Sign Up" → "Instructor"</li>
              <li>2. Enter email, password, name, phone</li>
              <li>3. Upload ID, working permit, police check</li>
              <li>4. ⏳ Wait 2-5 business days for approval</li>
              <li>✅ You'll get approval email!</li>
            </ol>
            <p className="text-slate-400 text-sm mt-3"><strong>Pro tip:</strong> Upload ALL documents immediately — sooner you upload = sooner you're approved!</p>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 2: Set Up Profile (3 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Go to "Profile" → "Edit Profile"</li>
              <li>2. Add professional photo</li>
              <li>3. Write your bio (teaching style, specialties)</li>
              <li>4. Set your hourly rate</li>
              <li>5. Choose subscription tier (Basic/Pro/Business)</li>
              <li>✅ Profile complete!</li>
            </ol>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 3: Set Availability (2 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Go to "Availability"</li>
              <li>2. Click the times you can teach</li>
              <li>3. Save</li>
              <li>✅ Students can now book you!</li>
            </ol>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700 mb-6">
            <h3 className="font-semibold text-slate-200 mb-4">Step 4: Set Up Payouts (2 min)</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. Go to "Settings" → "Payout & Tax Settings"</li>
              <li>2. Click "Connect with Stripe →"</li>
              <li>3. Enter bank details (secure!)</li>
              <li>4. Complete identity verification</li>
              <li>✅ Ready to get paid!</li>
            </ol>
            <p className="text-slate-400 text-sm mt-3"><strong>Note:</strong> You get paid every Tuesday automatically. No minimum payout!</p>
          </div>

          <div className="bg-slate-950 rounded-lg p-6 border border-slate-700">
            <h3 className="font-semibold text-slate-200 mb-4">Step 5: Accept Bookings</h3>
            <ol className="space-y-2 text-slate-300 ml-2">
              <li>1. When students book → You get email</li>
              <li>2. Go to "Bookings"</li>
              <li>3. Review booking details</li>
              <li>4. Click "Accept" or "Decline"</li>
              <li>✅ Respond within 24 hours!</li>
            </ol>
          </div>

          <p className="text-slate-400 text-sm mt-6">
            <strong>Pricing example:</strong> Student pays $100, Pro tier (12% commission) = You get $88
          </p>

          <Link 
            href="/help/instructors"
            className="inline-block mt-6 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Full Instructor Guide →
          </Link>
        </div>

        {/* Common Questions */}
        <div className="bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-6">❓ Quick Questions</h2>
          
          <div className="space-y-6">
            <div>
              <p className="font-semibold text-slate-200 mb-2">Is my payment information safe?</p>
              <p className="text-slate-400">Yes! We use Stripe — your card details are secure and encrypted.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-200 mb-2">How long until instructor accepts?</p>
              <p className="text-slate-400">Usually within 24 hours. You'll get an email notification.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-200 mb-2">When do instructors get paid?</p>
              <p className="text-slate-400">Every Tuesday automatically. Money appears in bank 1-2 days later.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-200 mb-2">Can I cancel a booking?</p>
              <p className="text-slate-400">Yes. Cancel before confirmation = full refund. After confirmation = depends on policy.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-200 mb-2">What if I'm nervous as a student?</p>
              <p className="text-slate-400">Many instructors specialize in nervous students. Filter by this or ask them directly!</p>
            </div>

            <div>
              <p className="font-semibold text-slate-200 mb-2">How do I get approved faster as an instructor?</p>
              <p className="text-slate-400">Upload ALL documents immediately. Admin reviews within 2-5 business days.</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12 bg-slate-800 rounded-lg p-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Need more help?</h2>
          <p className="text-slate-300 mb-4">Check the full guides or contact support</p>
          <div className="flex gap-4">
            <Link 
              href="/help"
              className="inline-block bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ← Back to Help Center
            </Link>
            <a 
              href="mailto:support@drivebook.com.au"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
