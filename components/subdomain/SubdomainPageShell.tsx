'use client';

import { useState, useCallback } from 'react';
import SubdomainBookingWizard from './SubdomainBookingWizard';
import { BookingProvider } from '@/lib/contexts/BookingContext';

interface InstructorProps {
  id: string;
  name: string;
  profileImage: string | null;
  hourlyRate: number;
  averageRating: number | null;
  totalReviews: number;
  offersTestPackage: boolean;
  testPackagePrice: number | null;
  testPackageDuration: number | null;
  testPackageIncludes: string[];
  lessonPackages?: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
    description: string;
    isActive: boolean;
  }>;
}

interface SubdomainPageShellProps {
  instructor: InstructorProps;
  primary: string;
  /** All the static page content (profile, services, reviews, FAQ) */
  children: React.ReactNode;
}

export default function SubdomainPageShell({ instructor, primary, children }: SubdomainPageShellProps) {
  const [bookingActive, setBookingActive] = useState(false);

  const handleStart = useCallback(() => {
    setBookingActive(true);
    // Scroll to top of booking area smoothly
    setTimeout(() => {
      document.getElementById('booking-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const handleClose = useCallback(() => {
    setBookingActive(false);
    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (bookingActive) {
    return (
      <BookingProvider>
        <div id="booking-wizard" className="min-h-screen bg-gray-50">
          {/* Compact header strip showing instructor name + close */}
          <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: primary }}
                >
                  {instructor.name.charAt(0)}
                </div>
                <span className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">{instructor.name}</span>
              </div>
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Back to profile</span>
              </button>
            </div>
          </div>

          {/* Wizard — full width, focused */}
          <div className="max-w-4xl mx-auto px-4 py-6">
            <SubdomainBookingWizard instructor={instructor} primary={primary} />
          </div>
        </div>
      </BookingProvider>
    );
  }

  // Normal page — pass onBook callback down via context trick using a data attribute
  // We inject a "Book Now" trigger button that the children can reference
  return (
    <>
      {/* Hidden trigger — children reference this via the onBook prop pattern */}
      <div data-booking-shell="true" data-primary={primary} />
      {/* Inject the onBook handler into children via a wrapper */}
      <BookingShellContext.Provider value={{ onBook: handleStart, primary }}>
        {children}
      </BookingShellContext.Provider>
    </>
  );
}

// Context so any child can trigger the booking flow
import { createContext, useContext } from 'react';

interface BookingShellContextType {
  onBook: () => void;
  primary: string;
}

export const BookingShellContext = createContext<BookingShellContextType>({
  onBook: () => {},
  primary: '#3B82F6',
});

export function useBookingShell() {
  return useContext(BookingShellContext);
}

// Drop-in "Book Now" button that any child can use
export function BookNowButton({ label = 'Book Your Lesson →', className }: { label?: string; className?: string }) {
  const { onBook, primary } = useBookingShell();
  return (
    <button
      type="button"
      onClick={onBook}
      className={className ?? 'w-full py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 active:scale-95'}
      style={!className ? { backgroundColor: primary } : undefined}
    >
      {label}
    </button>
  );
}
