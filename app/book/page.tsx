"use client";

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/Logo';
import LocationSearchBooking from '@/components/LocationSearchBooking';

export default function BookingLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/[0.04] border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="no-underline"><Logo size={34} dark /></Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex gap-1 items-center">
              <Link href="/learn-to-drive" className="text-white/70 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">
                Learn to Drive
              </Link>
              <Link href="/about" className="text-white/70 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">
                About
              </Link>
              <Link href="/blog" className="text-white/70 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">
                Blog
              </Link>
              <Link href="/login" className="text-white/70 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">
                Login
              </Link>
              <Link href="/teach-with-drivebook" className="bg-gradient-to-r from-pink-600 to-violet-600 text-white px-4 py-2 rounded-xl hover:from-pink-500 hover:to-violet-500 text-sm font-bold no-underline transition-all ml-1">
                For Instructors
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-950/95 border-t border-white/10 py-4 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              <Link href="/learn-to-drive" className="block text-white/80 hover:text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 no-underline">Learn to Drive</Link>
              <Link href="/about" className="block text-white/80 hover:text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 no-underline">About</Link>
              <Link href="/blog" className="block text-white/80 hover:text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 no-underline">Blog</Link>
              <Link href="/login" className="block text-white/80 hover:text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 no-underline">Login</Link>
              <Link href="/teach-with-drivebook" className="block bg-gradient-to-r from-pink-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold text-center no-underline mt-2">
                For Instructors
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 text-white">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 mb-4">
            Book Your Driving Lesson
          </h1>
          <p className="text-xl text-white/70 mb-2">
            Find qualified instructors in your area
          </p>
          <p className="text-lg text-white/60 mb-4">
            Search by location → Choose instructor → Book instantly
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <Link href="/learn-to-drive" className="text-violet-400 hover:text-violet-300 text-sm no-underline font-medium">
              New to driving? Read our guide →
            </Link>
            <span className="text-white/30">·</span>
            <Link href="/pda-guide" className="text-violet-400 hover:text-violet-300 text-sm no-underline font-medium">
              WA PDA Guide →
            </Link>
          </div>
        </div>

        {/* Location Search Component */}
        <div className="max-w-3xl mx-auto">
          <LocationSearchBooking />
        </div>

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {[
            { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Search by Location', desc: 'Enter your suburb or postcode to find instructors who service your area.' },
            { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', title: 'Choose Your Instructor', desc: 'View profiles, ratings, and availability of verified, approved instructors.' },
            { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Book Instantly', desc: 'Select your preferred time, pay securely, and get SMS confirmation immediately.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white/[0.04] rounded-2xl p-6 text-center border border-white/10 hover:border-violet-500/30 transition-all text-white">
              <div className="w-14 h-14 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
