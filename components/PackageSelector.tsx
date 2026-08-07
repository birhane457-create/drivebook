'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES, PackageType } from '@/lib/config/packages';

// Input class used for the custom hours select — animated border + high contrast 3D layer
const INPUT_CLASS = [
  'w-full px-4 py-2.5 rounded-xl text-base font-bold',
  'bg-slate-900 text-white',
  'border-2 border-slate-400',
  'transition-all duration-100',
  'hover:border-white hover:bg-slate-950',
  'focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]',
].join(' ');

export default function PackageSelector() {
  const { bookingState, setPackage } = useBooking();
  const [customHours, setCustomHours] = useState(bookingState.hours);

  const hourlyRate = bookingState.instructor?.hourlyRate || 0;
  const s = bookingState.platformSettings;

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

  const predefinedPackages: Array<{ type: PackageType; hours: number; discount: number; label: string }> = [
    { type: 'PACKAGE_6',  hours: 6,  discount: s.package6Discount,  label: 'Starter' },
    { type: 'PACKAGE_10', hours: 10, discount: s.package10Discount, label: 'Popular' },
    { type: 'PACKAGE_15', hours: 15, discount: s.package15Discount, label: 'Best Value' },
  ];

  return (
    <>
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white tracking-wide">Select Your Package</h3>

        {/* Standard hour packages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-3 pb-6">
          {predefinedPackages.map(({ type, hours, discount, label }) => {
            const isSelected = bookingState.packageType === type;
            const basePrice  = hourlyRate * hours;
            const finalPrice = basePrice * (1 - discount / 100);
            const savings    = basePrice - finalPrice;

            return (
              <button
                key={type}
                onClick={() => handlePackageSelect(type)}
                className={[
                  'relative p-5 rounded-xl text-left flex flex-col justify-between pt-8',
                  'border-2 transition-all duration-100',
                  isSelected
                    ? 'border-white bg-sky-600 text-white shadow-[0_5px_0_0_#0369a1,0_15px_30px_0_rgba(56,189,248,0.5)] translate-y-[4px]'
                    : 'border-slate-400 bg-slate-800 text-slate-100 shadow-[0_9px_0_0_#475569,0_20px_30px_0_rgba(0,0,0,0.6)] hover:border-slate-200 hover:translate-y-[-2px] hover:shadow-[0_11px_0_0_#475569,0_25px_35px_0_rgba(0,0,0,0.7)] active:translate-y-[4px] active:shadow-[0_5px_0_0_#475569,0_15px_20px_0_rgba(0,0,0,0.5)]',
                ].join(' ')}
              >
                {/* Floating Discount Pill - Zero layout space impact */}
                {discount > 0 && (
                  <div className={`absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded border-2 shadow-sm uppercase tracking-wider z-10 ${
                    isSelected 
                      ? 'bg-amber-400 text-slate-950 border-white' 
                      : type === 'PACKAGE_15'
                      ? 'bg-emerald-500 text-white border-white'
                      : 'bg-indigo-500 text-white border-white'
                  }`}>
                    -{discount}%
                  </div>
                )}

                {/* Popular badge */}
                {type === 'PACKAGE_10' && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-extrabold border-2 whitespace-nowrap shadow-md uppercase tracking-wider z-10 ${
                    isSelected 
                      ? 'bg-amber-400 text-slate-950 border-white' 
                      : 'bg-sky-500 text-white border-sky-400'
                  }`}>
                    ★ Most Popular ★
                  </span>
                )}

                <div className="w-full flex items-start justify-between gap-2">
                  {/* Radio + hours */}
                  <div className="flex items-center gap-2.5">
                    <div className={[
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'border-white bg-sky-800' : 'border-slate-400 bg-slate-900',
                    ].join(' ')}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-white text-lg tracking-tight">{hours} hrs</p>
                      <p className={`text-xs font-semibold ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>{label}</p>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="text-right shrink-0">
                    {discount > 0 && (
                      <p className={`text-xs line-through font-medium ${isSelected ? 'text-sky-100/90' : 'text-slate-500'}`}>
                        ${basePrice.toFixed(0)}
                      </p>
                    )}
                    <p className="font-black text-xl tracking-tight text-white">
                      ${finalPrice.toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Per-hour rate + savings */}
                <div className="w-full mt-4 pt-3 border-t border-white/20 flex justify-between text-sm font-bold">
                  <span className={isSelected ? 'text-sky-100' : 'text-slate-300'}>
                    ${(finalPrice / hours).toFixed(2)}/hr
                  </span>
                  {savings > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs uppercase tracking-wide ${
                      isSelected ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-900 text-emerald-400'
                    }`}>
                      Save ${savings.toFixed(0)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom hours */}
        <div className="max-w-sm pt-2">
          <label htmlFor="customHours" className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">
            Or choose custom hours
          </label>
          <div className="relative shadow-[0_4px_0_0_#334155] rounded-xl">
            <select
              id="customHours"
              value={customHours}
              onChange={(e) => handleCustomHoursChange(parseInt(e.target.value))}
              onClick={() => { if (bookingState.packageType !== 'CUSTOM') handlePackageSelect('CUSTOM'); }}
              className={INPUT_CLASS}
            >
              <option value="" className="bg-slate-900 font-bold">Choose hours...</option>
              {Array.from({ length: 50 }, (_, i) => i + 1).map(i => {
                const discount = getDiscountForHours(i);
                const price = hourlyRate * i * (1 - discount / 100);
                return (
                  <option key={i} value={i} className="bg-slate-900 text-white font-bold">
                    {i} hr{i > 1 ? 's' : ''} — ${price.toFixed(0)}{discount > 0 ? ` (${discount}% off)` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Package Benefits */}
        <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-[0_4px_0_0_#1e293b]">
          <h4 className="font-extrabold text-sky-400 mb-3 text-sm uppercase tracking-wider">Package Benefits</h4>
          <ul className="space-y-2.5 text-sm font-bold text-slate-200">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Flexible scheduling — book lessons at your convenience
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Bigger packages unlock better rates (up to {s.package15Discount}% off)
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Hours secured &amp; valid for 12 months from purchase
            </li>
          </ul>
        </div>
      </div>

     
    </>
  );
  
}
