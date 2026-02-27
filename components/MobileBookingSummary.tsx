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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
      {/* Collapsed View */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{instructor.name}</p>
            <p className="text-xs text-gray-600">{packageInfo.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">
            ${pricing.total.toFixed(2)}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
        <div className="px-4 pb-4 border-t">
          <div className="space-y-3 pt-4">
            {/* Package Details */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Hours</span>
              <span className="font-medium text-gray-900">{hours} hours</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Hourly Rate</span>
              <span className="font-medium text-gray-900">${instructor.hourlyRate}/hr</span>
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">${pricing.subtotal.toFixed(2)}</span>
              </div>
              
              {pricing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">
                    Discount ({pricing.discountPercentage}%)
                  </span>
                  <span className="text-green-600">-${pricing.discount.toFixed(2)}</span>
                </div>
              )}

              {includeTestPackage && pricing.testPackage > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Test Package</span>
                  <span className="text-gray-900">${pricing.testPackage.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="text-gray-900">${pricing.platformFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
