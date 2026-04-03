'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES, PackageType } from '@/lib/config/packages';

export default function PackageSelector() {
  const { bookingState, setPackage, updateBooking } = useBooking();
  const [customHours, setCustomHours] = useState(bookingState.hours);

  const hourlyRate = bookingState.instructor?.hourlyRate || 0;
  const lessonPackages = (bookingState.instructor as any)?.lessonPackages?.filter((p: any) => p.isActive !== false) || [];
  const s = bookingState.platformSettings;

  const getDiscountForHours = (hours: number): number => {
    if (hours >= 15) return s.package15Discount;
    if (hours >= 10) return s.package10Discount;
    if (hours >= 6) return s.package6Discount;
    return 0;
  };

  const handlePackageSelect = (type: PackageType) => {
    // Selecting a standard package clears any instructor custom package selection
    if (type === 'CUSTOM') {
      setPackage(type, customHours);
    } else {
      setPackage(type, HOUR_PACKAGES[type].hours);
    }
  };

  const handleCustomHoursChange = (hours: number) => {
    setCustomHours(hours);
    setPackage('CUSTOM', hours);
  };

  // Toggle an instructor add-on package — can be combined with a standard package
  // or selected alone (customPackageId set, packageType stays CUSTOM with hours from pkg)
  const handleAddonToggle = (pkg: any) => {
    if (bookingState.customPackageId === pkg.id) {
      // Deselect — revert to whatever standard package was selected
      updateBooking({ customPackageId: null, customPackagePrice: null });
    } else {
      // Select this add-on — store id and price, keep existing standard package selection
      updateBooking({ customPackageId: pkg.id, customPackagePrice: pkg.price });
    }
  };

  const predefinedPackages: Array<{ type: PackageType; hours: number; discount: number }> = [
    { type: 'PACKAGE_6', hours: 6, discount: s.package6Discount },
    { type: 'PACKAGE_10', hours: 10, discount: s.package10Discount },
    { type: 'PACKAGE_15', hours: 15, discount: s.package15Discount },
  ];

  // Standard package is selected when customPackageId is null and packageType is a named package
  const standardSelected = bookingState.packageType !== 'CUSTOM' || bookingState.customPackageId === null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Select Your Package</h3>

      {/* Standard hour packages — radio select */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {predefinedPackages.map(({ type, hours, discount }) => {
          const isSelected = bookingState.packageType === type;
          const basePrice = hourlyRate * hours;
          const finalPrice = basePrice * (1 - discount / 100);
          const savings = basePrice - finalPrice;

          return (
            <button
              key={type}
              onClick={() => handlePackageSelect(type)}
              className={`relative p-4 rounded-lg border text-left transition-all flex flex-col justify-between
                ${isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <h4 className="font-medium text-gray-900">{hours} hrs</h4>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 line-through">${basePrice.toFixed(0)}</div>
                  <div className="font-bold text-blue-600">${finalPrice.toFixed(0)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex justify-between">
                <span>${(finalPrice / hours).toFixed(2)}/hr</span>
                <span className="text-green-600">Save ${savings.toFixed(0)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom hours — always shown unless add-on is the only selection */}
      {!(bookingState.customPackageId && bookingState.packageType === 'CUSTOM' && bookingState.hours === 0) && (
        <div className="max-w-sm">
          <label htmlFor="customHours" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
            Or choose custom hours
          </label>
          <select
            id="customHours"
            value={bookingState.packageType === 'CUSTOM' && !bookingState.customPackageId ? customHours : ''}
            onChange={(e) => handleCustomHoursChange(parseInt(e.target.value))}
            onClick={() => { if (bookingState.packageType !== 'CUSTOM') handlePackageSelect('CUSTOM'); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Choose hours...</option>
            {Array.from({ length: 50 }, (_, i) => i + 1).map(i => {
              const discount = getDiscountForHours(i);
              const price = hourlyRate * i * (1 - discount / 100);
              return (
                <option key={i} value={i}>
                  {i} hr{i > 1 ? 's' : ''} — ${price.toFixed(0)}{discount > 0 ? ` (${discount}% off)` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Instructor add-on packages — optional, checkbox style */}
      {lessonPackages.length > 0 && (
        <div className="border-t border-gray-100 pt-5">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Optional add-ons from {bookingState.instructor?.name}
            <span className="ml-2 text-xs text-gray-400 font-normal">Fixed price · no bulk discount</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lessonPackages.map((pkg: any) => {
              const pkgMins = pkg.durationMinutes;
              const pkgHours = pkgMins / 60;
              const isAddonSelected = bookingState.customPackageId === pkg.id;

              const durationLabel = pkgMins % 60 === 0
                ? `${pkgHours} hr${pkgHours !== 1 ? 's' : ''}`
                : `${Math.floor(pkgHours)}h ${pkgMins % 60}m`;

              return (
                <button
                  key={pkg.id}
                  onClick={() => handleAddonToggle(pkg)}
                  className={`p-4 rounded-lg border text-left transition-all ${isAddonSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox style indicator */}
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${isAddonSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                      {isAddonSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{pkg.name}</p>
                      {pkg.description && <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">{durationLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-blue-600">${pkg.price.toFixed(2)}</p>
                      {/* No "save vs hourly" badge — instructor packages include extras beyond lesson time */}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {bookingState.customPackageId && (
            <p className="text-xs text-gray-500 mt-2">
              You can combine this with a lesson package above, or book it on its own.
            </p>
          )}
        </div>
      )}

      {/* Package Benefits */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 text-sm">Package Benefits</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Flexible scheduling — book lessons at your convenience
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Bigger packages = bigger savings (up to {s.package15Discount}% off)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            Rate &amp; discount locked at purchase
          </li>
        </ul>
      </div>
    </div>
  );
}
