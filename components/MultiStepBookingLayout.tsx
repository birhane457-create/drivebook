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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Step Indicator */}
      <div className="bg-gradient-to-r from-white/5 to-white/2 border-b border-white/6 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-2 sm:mx-4 px-2 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Booking Summary Sidebar (Desktop Only) */}
          <div className="hidden lg:block">
            <BookingSummary />
          </div>

          {/* Right Column - Main Content (lg:col-span-3) */}
          <div className="lg:col-span-3">
            <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-2xl shadow-2xl p-3 sm:p-6 border border-white/10 backdrop-blur-sm">
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
