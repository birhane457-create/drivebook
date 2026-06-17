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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-br from-white/5 to-white/2 border-t border-white/10 shadow-2xl z-40 safe-area-bottom backdrop-blur-sm text-white">
      {/* Collapsed View */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-white/6 flex-shrink-0">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 text-lg font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">{instructor.name}</p>
            <p className="text-xs text-white/70 truncate">{packageInfo.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg sm:text-xl font-bold text-white">${pricing.total.toFixed(2)}</span>
          <svg
            className={`w-5 h-5 text-white/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:pb-6 border-t max-h-[60vh] overflow-y-auto border-white/6">
          <div className="space-y-3 pt-4 text-white">
            {/* Package Details */}
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Hours</span>
              <span className="font-medium text-white">{hours} hours</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Hourly Rate</span>
              <span className="font-medium text-white">${instructor.hourlyRate}/hr</span>
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t space-y-2 border-white/6">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Subtotal</span>
                <span className="text-white">${pricing.subtotal.toFixed(2)}</span>
              </div>
              
              {pricing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-300">Discount ({pricing.discountPercentage}%)</span>
                  <span className="text-green-300">-${pricing.discount.toFixed(2)}</span>
                </div>
              )}

              {includeTestPackage && pricing.testPackage > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Test Package</span>
                  <span className="text-white">${pricing.testPackage.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-white/70">Platform Fee</span>
                <span className="text-white">${pricing.platformFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
