'use client';

import { useState } from 'react';
import SubdomainBookingWizard from './SubdomainBookingWizard';
import { BookingProvider } from '@/lib/contexts/BookingContext';

interface SubdomainBookingEntryProps {
  instructor: {
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
    allowedDurations?: number[];
  };
  primary: string;
  /** Optional: pre-select a package when opening the overlay from a pricing row */
  initialPackage?: { packageType: string; hours: number; label: string };
}

export default function SubdomainBookingEntry({ instructor, primary, initialPackage }: SubdomainBookingEntryProps) {
  const [open, setOpen] = useState(false);
  const [preSelected, setPreSelected] = useState<{ packageType: string; hours: number; label: string } | null>(null);

  const openOverlay = (pkg?: { packageType: string; hours: number; label: string }) => {
    setPreSelected(pkg ?? null);
    setOpen(true);
  };

  // Expose openOverlay so pricing buttons on the same page can call it.
  // We attach it to a DOM data attribute so the Server Component can wire up
  // client buttons via a thin wrapper instead — but the cleanest pattern here
  // is to render the pricing buttons as part of this Client Component via a
  // render-prop / slot approach. Instead we export a companion hook-free trigger
  // by rendering the pricing rows as children passed from the page.
  return (
    <>
      {/* Primary CTA button */}
      <button
        type="button"
        onClick={() => openOverlay()}
        className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: primary }}
      >
        Book Your Lesson →
      </button>

      {/* Full-screen booking overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-y-auto">
          {/* Compact header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-white/5 to-white/2 border-b border-white/6 backdrop-blur-sm shadow-sm">
            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: primary }}
                >
                  {instructor.name.charAt(0)}
                </div>
                <span className="font-semibold text-white/90 text-sm truncate max-w-[200px]">
                  {instructor.name}
                </span>
                {preSelected && (
                  <span className="text-white/40 text-xs hidden sm:inline">· {preSelected.label}</span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Back to profile</span>
              </button>
            </div>
          </div>

          {/* Wizard */}
          <div className="max-w-4xl mx-auto px-4 py-6">
            <BookingProvider>
              <SubdomainBookingWizard
                instructor={instructor}
                primary={primary}
                initialPackage={preSelected ?? undefined}
              />
            </BookingProvider>
          </div>
        </div>
      )}
    </>
  );
}
