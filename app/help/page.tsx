'use client';

import Link from 'next/link';
import { HelpCircle, BookOpen, Users, Zap } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-blue-300" />
            <h1 className="text-4xl font-bold">Help Center</h1>
          </div>
          <p className="text-blue-200 text-lg">Clear guides to help you use DriveBook</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Quick Start */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            Quick Start
          </h2>
          <p className="text-slate-300 mb-4">Get started in 30 seconds</p>
          <Link 
            href="/help/quick-start"
            className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            View Quick Start →
          </Link>
        </div>

        {/* For Students */}
        <div className="mb-12 bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-sky-400" />
            For Students
          </h2>
          <p className="text-slate-400 mb-6">Learn how to find instructors, book lessons, and track your progress</p>
          
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200">Popular Topics:</h3>
            <ul className="space-y-2 text-slate-300">
              <li>✓ Create an account</li>
              <li>✓ Find and book an instructor</li>
              <li>✓ Make a payment</li>
              <li>✓ Reschedule or cancel</li>
              <li>✓ Leave a review</li>
              <li>✓ Troubleshooting</li>
            </ul>
          </div>

          <Link 
            href="/help/students"
            className="inline-block mt-6 bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Student Guide →
          </Link>
        </div>

        {/* For Instructors */}
        <div className="mb-12 bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            For Instructors
          </h2>
          <p className="text-slate-400 mb-6">Learn how to set up your profile, manage bookings, and get paid</p>
          
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200">Popular Topics:</h3>
            <ul className="space-y-2 text-slate-300">
              <li>✓ Get approved</li>
              <li>✓ Set your availability</li>
              <li>✓ Manage bookings</li>
              <li>✓ Set up payouts</li>
              <li>✓ Track earnings</li>
              <li>✓ Manage reviews</li>
            </ul>
          </div>

          <Link 
            href="/help/instructors"
            className="inline-block mt-6 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Instructor Guide →
          </Link>
        </div>

        {/* FAQ */}
        <div className="mb-12 bg-slate-900 rounded-lg p-8 border border-slate-800">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">How long until my booking is confirmed?</h3>
              <p className="text-slate-400">Usually within 24 hours. You'll get an email notification.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-200 mb-2">Can I cancel my booking?</h3>
              <p className="text-slate-400">Yes, but timing matters. Cancel before confirmation for a full refund. See your guide for details.</p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200 mb-2">When do instructors get paid?</h3>
              <p className="text-slate-400">Automatic payouts every Tuesday to your bank account.</p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200 mb-2">How do I get approved as an instructor?</h3>
              <p className="text-slate-400">Upload your documents (ID, etc.) and our admin team reviews within 2-5 business days.</p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200 mb-2">Is my payment information safe?</h3>
              <p className="text-slate-400">Yes. We use Stripe for payments — your card details are secure and encrypted.</p>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Can't find what you need?</h2>
          <p className="text-slate-300 mb-4">Our support team is here to help</p>
          <a 
            href="mailto:support@drivebook.com.au"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
