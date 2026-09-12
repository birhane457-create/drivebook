'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES } from '@/lib/config/packages';

export default function MobileBookingSummary() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { bookingState } = useBooking();
  const { instructor, packageType, hours, includeTestPackage, pricing } = bookingState;

  if (!instructor) {
    return null;
  }

  const packageInfo = packageType === 'CUSTOM' 
    ? { name: 'Custom Package', hours } 
    : HOUR_PACKAGES[packageType];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t-2 border-slate-400 shadow-[0_-8px_24px_rgba(0,0,0,0.8)] z-40 safe-area-bottom text-foreground">
      {/* Collapsed View */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card border-b-2 border-border"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-secondary flex-shrink-0 border border-border">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-foreground text-lg font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{instructor.name}</p>
            <p className="text-xs font-semibold text-foreground truncate">{packageInfo.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg sm:text-xl font-black text-foreground bg-background px-2 py-0.5 rounded border border-border">${pricing.total.toFixed(2)}</span>
          <svg
            className={`w-5 h-5 text-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:pb-6 max-h-[60vh] overflow-y-auto bg-background">
          <div className="space-y-3 pt-4 text-foreground">
            {/* Package Details */}
            <div className="flex justify-between text-sm font-bold">
              <span className="text-foreground">Hours</span>
              <span className="text-foreground">{hours} hours</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-foreground">Hourly Rate</span>
              <span className="text-foreground">${instructor.hourlyRate}/hr</span>
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t-2 space-y-2 border-border">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-foreground">Subtotal</span>
                <span className="text-foreground">${pricing.subtotal.toFixed(2)}</span>
              </div>
              
              {pricing.discount > 0 && (
                <div className="flex justify-between text-sm font-black px-2 py-1 rounded bg-emerald-950 border border-emerald-500">
                  <span className="text-emerald-300">Discount ({pricing.discountPercentage}%)</span>
                  <span className="text-emerald-300">-${pricing.discount.toFixed(2)}</span>
                </div>
              )}

              {includeTestPackage && pricing.testPackage > 0 && (
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">Test Package</span>
                  <span className="text-foreground">${pricing.testPackage.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold">
                <span className="text-foreground">Platform Fee</span>
                <span className="text-foreground">${pricing.platformFee.toFixed(2)}</span>
              </div>
            </div>

            {/* Total — visible inside expanded panel on mobile only */}
            <div className="flex justify-between items-center pt-3 border-t-2 border-border mt-1">
              <span className="text-sm font-black text-foreground uppercase tracking-wider">Total</span>
              <span className="text-xl font-black text-foreground bg-primary px-3 py-1 rounded-lg border border-sky-400 shadow-[0_3px_0_0_#0369a1]">
                ${pricing.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
