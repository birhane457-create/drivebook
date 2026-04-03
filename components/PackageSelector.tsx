'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES, PackageType } from '@/lib/config/packages';

export default function PackageSelector() {
  const { bookingState, setPackage, setInstructorPackage } = useBooking();
  const [customHours, setCustomHours] = useState(bookingState.hours);

  const hourlyRate = bookingState.instructor?.hourlyRate || 0;
  const lessonPackages = (bookingState.instructor as any)?.lessonPackages?.filter((p: any) => p.isActive !== false) || [];
  const s = bookingState.platformSettings;

  // Use DB-driven discount rates
  const getDiscountForHours = (hours: number): number => {
    if (hours >= 15) return s.package15Discount;
    if (hours >= 10) return s.package10Discount;
    if (hours >= 6) return s.package6Discount;
    return 0;
  };

  const handlePackageSelect = (type: PackageType) => {
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

  // Handle instructor custom lesson package selection (fixed price — no platform discount applied)
  const handleCustomPackageSelect = (pkg: any) => {
    setInstructorPackage(pkg.id, pkg.price, pkg.durationMinutes);
  };

  // Generate dropdown options (1-50 hours)
  const generateHourOptions = () => {
    const options = [];
    for (let i = 1; i <= 50; i++) {
      const discount = getDiscountForHours(i);
      const basePrice = hourlyRate * i;
      const finalPrice = basePrice * (1 - discount / 100);
      const savings = basePrice - finalPrice;
      
      options.push({
        value: i,
        label: discount > 0 
          ? `${i} hour${i > 1 ? 's' : ''} - $${finalPrice.toFixed(0)} (${discount}% discount - Save $${savings.toFixed(0)})`
          : `${i} hour${i > 1 ? 's' : ''} - $${finalPrice.toFixed(0)} (No discount)`
      });
    }
    return options;
  };

  const predefinedPackages: Array<{ type: PackageType; hours: number; discount: number }> = [
    { type: 'PACKAGE_6', hours: 6, discount: s.package6Discount },
    { type: 'PACKAGE_10', hours: 10, discount: s.package10Discount },
    { type: 'PACKAGE_15', hours: 15, discount: s.package15Discount },
  ];

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-gray-900">Select Your Package</h3>
      
      {/* Predefined Package Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {predefinedPackages.map(({ type, hours, discount }) => {
          const isSelected = bookingState.packageType === type;
          const basePrice = hourlyRate * hours;
          const finalPrice = basePrice * (1 - discount / 100);
          const savings = basePrice - finalPrice;

          return (
            <button
              key={type}
              onClick={() => handlePackageSelect(type)}
              className={`
                relative p-4 rounded-lg border text-left transition-all flex flex-col justify-between
                ${isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300'}
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-600' : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <h4 className="font-medium text-gray-900">{hours} hr</h4>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500 line-through">${basePrice.toFixed(0)}</div>
                  <div className="text-lg font-bold text-blue-600">${finalPrice.toFixed(0)}</div>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
                <div className="truncate">{hours} hours • ${(finalPrice / hours).toFixed(2)}/hr</div>
                <div className="text-xs text-green-600">Save ${savings.toFixed(0)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Instructor's custom lesson packages (from settings) */}
      {lessonPackages.length > 0 && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or choose a lesson package</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lessonPackages.map((pkg: any) => {
              const pkgHours = pkg.durationMinutes / 60;
              const isSelected = bookingState.customPackageId === pkg.id;
              const hourlyEquiv = hourlyRate * pkgHours;
              const saving = hourlyEquiv > pkg.price ? hourlyEquiv - pkg.price : 0;
              return (
                <button
                  key={pkg.id}
                  onClick={() => handleCustomPackageSelect(pkg)}
                  className={`p-4 rounded-lg border text-left transition-all ${isSelected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-300'}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{pkg.name}</p>
                        {pkg.description && <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-blue-600">${pkg.price.toFixed(2)}</p>
                      {saving > 0 && <p className="text-xs text-green-600">Save ${saving.toFixed(0)} vs hourly</p>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-6">
                    {pkgHours === 1 ? '1 hr' : pkgHours % 1 === 0 ? `${pkgHours} hrs` : `${pkg.durationMinutes} min`}
                    {' · '}${(pkg.price / pkgHours).toFixed(2)}/hr
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Or choose custom hours</span>
        </div>
      </div>

      {/* Custom Hours Dropdown */}
      <div className="max-w-md mx-auto">
        <label htmlFor="customHours" className="block text-sm font-medium text-gray-700 mb-2">
          Select Hours:
        </label>
        <select
          id="customHours"
          value={bookingState.packageType === 'CUSTOM' ? customHours : ''}
          onChange={(e) => handleCustomHoursChange(parseInt(e.target.value))}
          onClick={() => {
            if (bookingState.packageType !== 'CUSTOM') {
              handlePackageSelect('CUSTOM');
            }
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
        >
          <option value="">Choose custom hours...</option>
          {generateHourOptions().map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {bookingState.packageType === 'CUSTOM' && customHours > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Selected:</span> {customHours} hour{customHours > 1 ? 's' : ''} for ${(hourlyRate * customHours * (1 - getDiscountForHours(customHours) / 100)).toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Package Benefits */}
      <div className="bg-blue-50 rounded-lg p-4 mt-6">
        <h4 className="font-semibold text-blue-900 mb-2">Package Benefits</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Flexible scheduling - book lessons at your convenience
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Bigger packages = bigger savings (up to {s.package15Discount}% off)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            All hours paid upfront, schedule as you go
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Rate &amp; discount locked at purchase — instructor price changes won&apos;t affect your package</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
