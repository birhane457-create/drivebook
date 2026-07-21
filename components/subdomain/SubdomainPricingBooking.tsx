'use client';

import { useState } from 'react';
import SubdomainBookingWizard from './SubdomainBookingWizard';
import { BookingProvider } from '@/lib/contexts/BookingContext';

type PreSelected = { packageType: string; hours: number; label: string };

interface Package {
  packageType: string;
  hours: number;
  label: string;
  discountPct: number;
  price: number;
}

interface InstructorProps {
  id: string;
  name: string;
  displayName?: string;
  profileImage: string | null;
  hourlyRate: number;
  averageRating: number | null;
  totalReviews: number;
  offersTestPackage: boolean;
  testPackagePrice: number | null;
  testPackageDuration: number | null;
  testPackageIncludes: string[];
  allowedDurations?: number[];
}

interface Props {
  instructor: InstructorProps;
  primary: string;
  secondary: string;
  packages: Package[];
  pdaPackage: { price: number } | null;
  /** Hours value of the most-booked package — shows a "Most popular" badge */
  popularHours?: number | null;
}

export default function SubdomainPricingBooking({
  instructor,
  primary,
  secondary,
  packages,
  pdaPackage,
  popularHours,
}: Props) {
  const [open, setOpen] = useState(false);
  const [preSelected, setPreSelected] = useState<PreSelected | null>(null);
  // key forces wizard remount when a different package is selected
  const [overlayKey, setOverlayKey] = useState(0);

  const openWith = (pkg: PreSelected | null) => {
    setPreSelected(pkg);
    setOverlayKey(k => k + 1);
    setOpen(true);
  };

  return (
    <>
      {/* ── Bulk packages — each row is clickable ───────────────────────── */}
      <div className="py-2 border-b border-gray-50">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Bulk lesson packages</p>
        <div className="space-y-1">
          {packages.map(({ packageType, hours, label, discountPct, price }) => (
            <button
              key={hours}
              type="button"
              onClick={() => openWith({ packageType, hours, label })}
              className="w-full flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors group text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium text-gray-800 group-hover:text-gray-900">{hours} hours</p>
                  {popularHours === hours && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{discountPct}% bulk discount</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-bold" style={{ color: secondary }}>${price.toFixed(0)}</p>
                <span className="text-xs text-gray-300 group-hover:text-gray-500 transition-colors">Book →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── PDA test pack row ────────────────────────────────────────────── */}
      {pdaPackage && (
        <button
          type="button"
          onClick={() => openWith({ packageType: 'CUSTOM', hours: 2, label: 'PDA Test Pack' })}
          className="w-full flex justify-between items-start px-3 py-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors group text-left border-b border-gray-50"
        >
          <div>
            <p className="text-base font-medium text-gray-800 group-hover:text-gray-900">PDA test pack</p>
            <p className="text-xs text-gray-400">Configured by instructor</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-bold" style={{ color: secondary }}>${pdaPackage.price.toFixed(2)}</p>
            <span className="text-xs text-gray-300 group-hover:text-gray-500 transition-colors">Book →</span>
          </div>
        </button>
      )}

      {/* ── Main CTA button — no pre-selection ──────────────────────────── */}
      <button
        type="button"
        onClick={() => openWith(null)}
        className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: primary }}
      >
        Book Your Lesson →
      </button>

      {/* ── Full-screen overlay ──────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-y-auto">
          {/* Header */}
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

          {/* Wizard — key forces remount when pre-selection changes */}
          <div className="max-w-4xl mx-auto px-4 py-6">
            <BookingProvider key={overlayKey}>
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
