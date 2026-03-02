import React from 'react';

interface BookingFlowButtonsProps {
  onBack?: () => void;
  onContinue?: () => void;
  backLabel?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
  showContinue?: boolean;
}

export default function BookingFlowButtons({
  onBack,
  onContinue,
  backLabel = '← Back',
  continueLabel = 'Continue →',
  continueDisabled = false,
  loading = false,
  showBack = true,
  showContinue = true
}: BookingFlowButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-200">
      {showBack && onBack && (
        <button
          onClick={onBack}
          type="button"
          disabled={loading}
          className="flex-1 bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {backLabel}
        </button>
      )}
      {showContinue && onContinue && (
        <button
          onClick={onContinue}
          type="button"
          disabled={continueDisabled || loading}
          className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : (
            continueLabel
          )}
        </button>
      )}
    </div>
  );
}
