'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES } from '@/lib/config/packages';

interface BookingSummaryProps {
  showButtons?: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  continueText?: string;
  backText?: string;
  loading?: boolean;
}

export default function BookingSummary({ 
  showButtons = false,
  onContinue,
  onBack,
  continueText = 'Continue →',
  backText = '← Back',
  loading = false
}: BookingSummaryProps) {
  const { bookingState, toggleTestPackage } = useBooking();
  const [showPackageInfo, setShowPackageInfo] = useState(false);
  const { instructor, packageType, hours, includeTestPackage, pricing, pdaTestBooking } = bookingState;
  const testPackagePrice = instructor?.testPackagePrice ?? 0;

  if (!instructor) {
    return (
      <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl p-4 sm:p-6 sticky top-4 border border-white/20 backdrop-blur-sm text-white">
        <h3 className="text-lg font-semibold mb-4 text-white/90">Booking Summary</h3>
        <p className="text-white/70 text-sm">Select an instructor to begin</p>
      </div>
    );
  }

  const packageInfo = packageType === 'CUSTOM' 
    ? { name: 'Custom Package', hours } 
    : HOUR_PACKAGES[packageType];

  return (
    <>
      <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl shadow-2xl p-4 sm:p-6 sticky top-4 border border-white/20 backdrop-blur-sm text-white">
        <h3 className="text-lg font-semibold mb-4 text-white/90">Booking Summary</h3>

        {/* Instructor Info */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/6">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/6 flex-shrink-0">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 text-2xl font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white truncate">{instructor.name}</h4>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-yellow-400">★</span>
              <span className="text-white/80">
                {instructor.averageRating?.toFixed(1) || 'New'}
              </span>
              <span className="text-white/60">({instructor.totalReviews})</span>
            </div>
          </div>
        </div>

        {/* COMPACT Package Details - 2 LINES */}
        <div className="bg-white/5 rounded-lg p-3 mb-6 pb-6 border-b border-white/6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-semibold text-white mb-1">{packageInfo.name}</p>
              <p className="text-sm text-white/80">{hours}h • ${instructor.hourlyRate}/h</p>
            </div>
            <button
              onClick={() => setShowPackageInfo(true)}
              className="text-white/80 hover:text-white p-1 flex-shrink-0"
              title="Click for details"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Optional PDA Add-on */}
        {instructor.offersTestPackage && !pdaTestBooking && (
          <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Add PDA test pack</p>
                <p className="text-xs text-white/70 mt-1">Optional driving test preparation add-on before scheduling and payment.</p>
              </div>
              <button
                type="button"
                onClick={toggleTestPackage}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${includeTestPackage ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
              >
                {includeTestPackage ? 'Remove add-on' : 'Add PDA pack'}
              </button>
            </div>
            <div className="mt-3 text-xs text-white/70 flex flex-wrap gap-3">
              <span className="font-semibold">Price:</span>
              <span>${testPackagePrice.toFixed(2)}</span>
              {instructor.testPackageDuration ? <span>• {Math.floor(instructor.testPackageDuration / 60)}h {instructor.testPackageDuration % 60}m</span> : null}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="space-y-2 mb-6 pb-6 border-b border-white/6">
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

        {/* Total */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-white">Total</span>
            <span className="text-2xl font-bold text-white">${pricing.total.toFixed(2)}</span>
          </div>

          {/* Scheduled Bookings (if any) */}
          {(bookingState.scheduledBookings.length > 0 || bookingState.includeTestPackage) && (
            <div className="space-y-2 mb-6">
              {bookingState.scheduledBookings.length > 0 && (
                <div className="bg-green-800/20 rounded-lg p-3 border border-green-700/30">
                  <p className="text-xs text-green-200 font-semibold mb-1">✓ Lessons Scheduled: {bookingState.scheduledBookings.length}</p>
                  {bookingState.remainingHours > 0 && (
                    <p className="text-xs text-green-200">Extra hours to schedule: {bookingState.remainingHours.toFixed(1)}h</p>
                  )}
                </div>
              )}
              
              {pdaTestBooking && (
                <div className="bg-blue-800/20 rounded-lg p-3 border border-blue-700/30">
                  <p className="text-xs text-blue-200 font-semibold mb-1">✓ PDA Test Booked</p>
                  <p className="text-xs text-blue-200 mb-1">{pdaTestBooking.configName}</p>
                  <p className="text-xs text-blue-200 font-mono mb-1">📅 {new Date(pdaTestBooking.testDate).toLocaleDateString('en-AU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-blue-200 font-mono mb-1">🕐 {pdaTestBooking.testTime}</p>
                  <p className="text-xs text-blue-200 font-mono">📍 {pdaTestBooking.testCentreName}</p>
                </div>
              )}
              
              {bookingState.includeTestPackage && !pdaTestBooking && (
                <div className="bg-blue-800/20 rounded-lg p-3 border border-blue-700/30">
                  <p className="text-xs text-blue-200 font-semibold mb-1">📝 PDA Test Pending</p>
                  <p className="text-xs text-blue-200">{bookingState.instructor?.testPackageDuration ? `${Math.floor((bookingState.instructor.testPackageDuration || 165) / 60)}h ${((bookingState.instructor.testPackageDuration || 165) % 60)}m` : '2h 45m'} test preparation</p>
                  <p className="text-xs text-blue-300 mt-1">Use the "Schedule PDA Test" tab to book your test</p>
                </div>
              )}
            </div>
          )}

          {/* Buttons at Bottom - Left Aligned */}
          {showButtons && (
            <div className="mt-6 pt-6 border-t border-white/6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-white/5 border border-white/8 text-white/90 rounded-lg font-semibold hover:bg-white/6 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {backText}
              </button>
              <button
                onClick={onContinue}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  continueText
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Package Details Modal */}
      {showPackageInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 sm:p-6 animate-in fade-in">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Package Details</h3>
              <button
                onClick={() => setShowPackageInfo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Package Type</p>
                <p className="font-semibold text-gray-900">{packageInfo.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Total Hours</p>
                <p className="font-semibold text-gray-900">{hours} hours</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Instructor Rate</p>
                <p className="font-semibold text-gray-900">${instructor.hourlyRate}/hour</p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-2">Pricing</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price</span>
                    <span className="text-gray-900">${pricing.subtotal.toFixed(2)}</span>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({pricing.discountPercentage}%)</span>
                      <span>-${pricing.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {includeTestPackage && pricing.testPackage > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Test Package Add-on</span>
                      <span className="text-gray-900">${pricing.testPackage.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="text-gray-900">${pricing.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span className="text-gray-900">Total Cost</span>
                    <span className="text-blue-600">${pricing.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {includeTestPackage && instructor.offersTestPackage && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="text-xs font-semibold text-green-900 mb-1">✓ Test Package Included</p>
                  <p className="text-xs text-green-800">{instructor.testPackageDuration || 2} hour PDA test preparation</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPackageInfo(false)}
              className="w-full mt-6 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
