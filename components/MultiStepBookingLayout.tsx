'use client';

import React, { ReactNode } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import StepIndicator from './StepIndicator';
import BookingSummary from './BookingSummary';
import MobileBookingSummary from './MobileBookingSummary';

interface MultiStepBookingLayoutProps {
  currentStep: number;
  children: ReactNode;
}

export default function MultiStepBookingLayout({ currentStep, children }: MultiStepBookingLayoutProps) {
  const { bookingState } = useBooking();

  // Generate dynamic steps based on the booking flow
  const generateSteps = () => {
    const steps = [
      { number: 1, label: 'Instructor' },
      { number: 2, label: 'Package' }
    ];

    let stepNumber = 3;

    // Add schedule step directly; test package is offered inline in summary
    steps.push({ number: stepNumber, label: 'Schedule' });
    stepNumber++;

    // Add booking details step if "Book Now" is selected
    if (bookingState.bookingType === 'now') {
      steps.push({ number: stepNumber, label: 'Details' });
      stepNumber++;
    }

    // Add registration step
    steps.push({ number: stepNumber, label: 'Register' });
    stepNumber++;

    // Add payment step
    steps.push({ number: stepNumber, label: 'Payment' });

    return steps;
  };

  const steps = generateSteps();

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32 lg:pb-12">
      {/* 3D Structural Step Indicator Frame */}
      <div className="relative z-30 mx-2 sm:mx-6 my-4 rounded-2xl border-2 border-slate-400 bg-slate-900 shadow-[0_6px_0_0_#475569,0_15px_25px_0_rgba(0,0,0,0.6)]">
        {/* Luminous top rim specular line for high daylight focus */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-t-xl" />
        
        <div className="max-w-7xl mx-auto px-1 py-1.5 sm:py-2">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-2 sm:mx-4 px-2 sm:px-4 py-4 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Booking Summary Sidebar (Desktop Only) */}
          <div className="hidden lg:block">
            <BookingSummary />
          </div>

          {/* Right Column - Main Content Dashboard Cards */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-3 sm:p-6 border-2 border-slate-700 shadow-[0_8px_0_0_#1e293b,0_25px_35px_0_rgba(0,0,0,0.5)]">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Booking Summary (Fixed Bottom) */}
      <MobileBookingSummary />
    </div>
  );
}
