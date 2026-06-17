"use client";

import Link from 'next/link';
import { Car, Menu, X } from 'lucide-react';
import { useState } from 'react';
import LocationSearchBooking from '@/components/LocationSearchBooking';

export default function BookingLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-white/5 to-white/2 border-b border-white/6 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-5 lg:px-7">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-white/90">DriveBook</span>
            </Link>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-2 sm:gap-4 items-center">
              <Link href="/about" className="text-white/70 hover:text-white text-sm sm:text-base">
                About Us
              </Link>
              <Link href="/contact" className="text-white/70 hover:text-white text-sm sm:text-base">
                Contact Us
              </Link>
              <Link href="/blog" className="text-white/70 hover:text-white text-sm sm:text-base">
                Blog
              </Link>
              <Link href="/login" className="text-white/70 hover:text-white text-sm sm:text-base">
                Login
              </Link>
              <Link href="/register" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 text-sm sm:text-base">
                Become Instructor
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
        </div>
        
        {/* Mobile Menu */}
          {menuOpen && (
          <div className="md:hidden bg-gradient-to-br from-white/5 to-white/2 border-t border-white/6 py-4 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-2 sm:px-5 lg:px-7 space-y-2">
              <Link href="/about" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                About Us
              </Link>
              <Link href="/contact" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Contact Us
              </Link>
              <Link href="/blog" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Blog
              </Link>
              <Link href="/terms" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Learner Terms
              </Link>
              <Link href="/instructor-terms" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Instructor Terms
              </Link>
              <Link href="/privacy" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Privacy Policy
              </Link>
              <Link href="/login" className="block text-white/80 hover:text-white text-sm sm:text-base py-2">
                Login
              </Link>
              <Link href="/register" className="block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 text-sm sm:text-base text-center">
                Become Instructor
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-2 sm:px-5 lg:px-7 py-12">
        <div className="text-center mb-12 text-white">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 mb-4">
            Book Your Driving Lesson
          </h1>
          <p className="text-xl text-white/70 mb-2">
            Find qualified instructors in your area
          </p>
          <p className="text-lg text-white/60">
            Search by location → Choose instructor → Book instantly
          </p>
        </div>

        {/* Location Search Component */}
        <div className="max-w-3xl mx-auto">
          <LocationSearchBooking />
        </div>

        {/* Features */}
        <div className="mt-8 md:mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl shadow-2xl p-6 text-center border border-white/10 backdrop-blur-sm text-white">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">Search by Location</h3>
            <p className="text-white/70">
              Enter your suburb or postcode to find instructors who service your area
            </p>
          </div>

          <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl shadow-2xl p-6 text-center border border-white/10 backdrop-blur-sm text-white">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">Choose Your Instructor</h3>
            <p className="text-white/70">
              View profiles, ratings, and availability of qualified instructors
            </p>
          </div>

          <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl shadow-2xl p-6 text-center border border-white/10 backdrop-blur-sm text-white">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">Book Instantly</h3>
            <p className="text-white/70">
              Select your preferred time and create an account to manage bookings 24/7
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
