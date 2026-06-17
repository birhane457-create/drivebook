'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle, Mail, Phone, MessageCircle, BookOpen, CreditCard,
  Calendar, ChevronDown, ChevronUp, Search, TrendingUp, Star,
  RefreshCw, XCircle, Wallet, User, AlertCircle,
} from 'lucide-react';

const faqs = [
  {
    category: 'Booking',
    icon: BookOpen,
    items: [
      {
        q: 'How do I book a lesson?',
        a: 'Click "Book Lesson" in the nav. If you have a current instructor, you\'ll go straight to choosing a duration. Otherwise, enter your suburb to find instructors nearby, pick one, then choose your lesson length, date, and time.',
      },
      {
        q: 'Can I book with a different instructor?',
        a: 'Yes. On the Book Lesson page, click "Switch Instructor" or use the "Find New Instructor" button on your dashboard. This starts a fresh location search.',
      },
      {
        q: 'Can I add multiple lessons to one booking session?',
        a: 'Yes — after adding a lesson to your cart, you can keep adding more with the same instructor before checking out.',
      },
      {
        q: 'What happens after I book?',
        a: 'Your instructor receives a booking request and will confirm it. You\'ll get a notification once confirmed. Credits are held in your wallet and deducted when the lesson is confirmed.',
      },
      {
        q: 'Can my instructor book a lesson on my behalf?',
        a: 'Yes. Instructors can create bookings for you directly. If your wallet doesn\'t have enough credits, they\'ll send you a payment link to top up first.',
      },
    ],
  },
  {
    category: 'Wallet & Payments',
    icon: CreditCard,
    items: [
      {
        q: 'How does the wallet work?',
        a: 'Your DriveBook wallet holds credits used to pay for lessons. You top up in advance and credits are deducted when a booking is confirmed. This keeps things simple — no card details shared with instructors.',
      },
      {
        q: 'How do I add credits?',
        a: 'Go to Wallet → Add Credits. You can add any amount. A small platform processing fee (3.6%) is included in the top-up to cover payment processing costs.',
      },
      {
        q: 'I received a payment link from my instructor — what do I do?',
        a: 'Click the link in the email. It will pre-fill the exact amount needed (lesson cost + processing fee). Once you top up, let your instructor know and they\'ll confirm the booking.',
      },
      {
        q: 'What is the platform processing fee?',
        a: 'A 3.6% fee is applied when you top up your wallet. This covers payment processing costs. It\'s shown clearly before you confirm any top-up.',
      },
      {
        q: 'Can I get a refund to my wallet?',
        a: 'If a booking is cancelled, credits are returned to your wallet automatically. Refunds to your original payment method are handled case-by-case — contact support.',
      },
    ],
  },
  {
    category: 'Rescheduling & Cancellations',
    icon: RefreshCw,
    items: [
      {
        q: 'How do I reschedule a lesson?',
        a: 'Go to My Bookings, find the lesson, and tap "Reschedule". Pick a new date and time from your instructor\'s available slots. You\'ll see the rescheduling policy before confirming.',
      },
      {
        q: 'Is there a limit on rescheduling?',
        a: 'Each booking can be rescheduled up to 3 times. Rescheduling within 24 hours of the lesson may be restricted depending on your instructor\'s policy.',
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Go to My Bookings → tap the booking → Cancel. Cancellation fees may apply depending on how close to the lesson time you cancel. The policy is shown before you confirm.',
      },
      {
        q: 'What if my instructor cancels?',
        a: 'If your instructor cancels, your credits are returned to your wallet in full. You\'ll receive a notification straight away.',
      },
    ],
  },
  {
    category: 'Progress Tracking',
    icon: TrendingUp,
    items: [
      {
        q: 'How does progress tracking work?',
        a: 'After each completed lesson, your instructor can log feedback, a performance score, strengths, and areas to focus on. You can view all of this on your Progress page.',
      },
      {
        q: 'Where do I see my progress?',
        a: 'Go to the Progress page from the nav. You\'ll see your average performance score, recent lesson feedback, top strengths, and areas to work on.',
      },
      {
        q: 'What if I have no progress data yet?',
        a: 'Progress data appears after your first completed lesson where your instructor has submitted feedback. Complete a lesson and ask your instructor to log notes.',
      },
    ],
  },
  {
    category: 'Reviews',
    icon: Star,
    items: [
      {
        q: 'How do I leave a review?',
        a: 'After a lesson is completed, go to the Reviews page. You\'ll see lessons pending a review — tap "Write Review" to rate your instructor and leave a comment.',
      },
      {
        q: 'Can I edit or delete a review?',
        a: 'Reviews cannot be edited once submitted. If you have a concern about a review, contact support.',
      },
    ],
  },
  {
    category: 'Account & Profile',
    icon: User,
    items: [
      {
        q: 'How do I update my profile?',
        a: 'Go to Profile in the nav. You can update your name, phone, address, and profile photo.',
      },
      {
        q: 'How do I change my password?',
        a: 'Go to Profile → Change Password. You\'ll need to enter your current password to set a new one.',
      },
      {
        q: 'How do I contact my instructor?',
        a: 'Your instructor\'s phone number is shown on your dashboard in the "Your Instructor" card. You can also see it on the booking details page.',
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-slate-200 text-sm">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <p className="text-sm text-slate-400 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function ClientHelpPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(
      item =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  const displayed = activeCategory
    ? filtered.filter(c => c.category === activeCategory)
    : filtered;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <HelpCircle className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Help Centre</h1>
          <p className="text-slate-400">Find answers or get in touch with support</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-900 text-slate-100 placeholder-slate-500"
          />
        </div>

        {/* Quick links */}
        {!search && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <Link href="/client-dashboard/book-lesson" className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 hover:bg-blue-900/20 transition text-center">
              <BookOpen className="w-6 h-6 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">Book a Lesson</span>
            </Link>
            <Link href="/client-dashboard/wallet" className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 hover:bg-blue-900/20 transition text-center">
              <Wallet className="w-6 h-6 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">My Wallet</span>
            </Link>
            <Link href="/client-dashboard/bookings" className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 hover:bg-blue-900/20 transition text-center">
              <Calendar className="w-6 h-6 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">My Bookings</span>
            </Link>
            <Link href="/client-dashboard/progress" className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 hover:bg-blue-900/20 transition text-center">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">My Progress</span>
            </Link>
          </div>
        )}

        {/* Category filter pills */}
        {!search && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                !activeCategory ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {faqs.map(cat => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  activeCategory === cat.category ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.category}
              </button>
            ))}
          </div>
        )}

        {/* FAQ sections */}
        <div className="space-y-4 mb-10">
          {displayed.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>No results for &quot;{search}&quot;</p>
              <p className="text-sm mt-1 text-slate-500">Try different keywords or contact support below.</p>
            </div>
          ) : (
            displayed.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.category} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 bg-slate-800/60 border-b border-white/10">
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-slate-200">{cat.category}</span>
                  </div>
                  <div className="px-5">
                    {cat.items.map((item, i) => (
                      <FAQItem key={i} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Contact support */}
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-1">Still need help?</h2>
          <p className="text-sm text-slate-400 mb-5">Our support team is available Mon–Fri, 9 AM – 6 PM.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="mailto:support@drivebook.com.au"
              className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 transition">
              <Mail className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Email</p>
                <p className="text-xs text-slate-500">support@drivebook.com.au</p>
              </div>
            </a>
            <a href="tel:1800DRIVEBOOK"
              className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 transition">
              <Phone className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Phone</p>
                <p className="text-xs text-slate-500">1800 DRIVEBOOK</p>
              </div>
            </a>
            <a href="#"
              className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/60 transition">
              <MessageCircle className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Live Chat</p>
                <p className="text-xs text-slate-500">Available 9 AM – 6 PM</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
