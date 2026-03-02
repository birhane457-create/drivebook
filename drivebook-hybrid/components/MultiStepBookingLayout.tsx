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

    // Add test package step if instructor offers it
    if (bookingState.instructor?.offersTestPackage) {
      steps.push({ number: stepNumber, label: 'Test' });
      stepNumber++;
    }

    // Add book type step
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
    <div className="min-h-screen bg-gray-50">
      {/* Step Indicator */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {children}
            </div>
          </div>

          {/* Right Column - Booking Summary (Desktop Only) */}
          <div className="hidden lg:block">
            <BookingSummary />
          </div>
        </div>
      </div>

      {/* Mobile Booking Summary (Fixed Bottom) */}
      <MobileBookingSummary />
    </div>
  );
}
