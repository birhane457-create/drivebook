'use client';

import React from 'react';

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps?: Step[];
}

export default function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  // Default steps if not provided
  const defaultSteps: Step[] = [
    { number: 1, label: 'Instructor' },
    { number: 2, label: 'Package' },
    { number: 3, label: 'Test' },
    { number: 4, label: 'Schedule' },
    { number: 5, label: 'Details' },
    { number: 6, label: 'Register' },
    { number: 7, label: 'Payment' }
  ];

  const displaySteps = steps || defaultSteps;

  return (
    <div className="w-full py-6 text-white">
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between max-w-5xl mx-auto px-4">
        {displaySteps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isUpcoming = currentStep < step.number;

          return (
            <React.Fragment key={step.number}>
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-200
                    ${isCompleted ? 'bg-green-400 text-white' : ''}
                    ${isCurrent ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-4 ring-white/10' : ''}
                    ${isUpcoming ? 'bg-white/5 text-white/60' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium text-center ${isCurrent ? 'text-white' : ''} ${isCompleted ? 'text-green-300' : ''} ${isUpcoming ? 'text-white/60' : ''}`}>
                  {step.label}
                </span>
              </div>

              {/* Connecting Line */}
              {index < displaySteps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 -mt-8">
                  <div className={`h-full transition-all duration-200 ${currentStep > step.number ? 'bg-green-400' : 'bg-white/6'}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile View - Simplified */}
      <div className="md:hidden px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/80">Step {currentStep} of {displaySteps.length}</span>
          <span className="text-sm font-medium text-white">{displaySteps.find(s => s.number === currentStep)?.label}</span>
        </div>
        <div className="w-full bg-white/6 rounded-full h-2">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(currentStep / displaySteps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
