'use client';

import React, { useState, useRef } from 'react';
import { AlertTriangle, Loader2, CheckCircle } from 'lucide-react';

interface CancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  instructorName: string;
  bookingDate: string;
  bookingPrice: number;
  originalBookingDate?: string;  // Add this to show if rescheduled
  onSuccess?: () => void;
}

export function CancelDialog({
  isOpen,
  onClose,
  bookingId,
  instructorName,
  bookingDate,
  bookingPrice,
  originalBookingDate,
  onSuccess
}: CancelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Calculate hours until booking - use original booking time if rescheduled
  const getRefundInfo = () => {
    const now = new Date();
    const policyDate = originalBookingDate || bookingDate;
    const bookingTime = new Date(policyDate);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil >= 48) {
      return {
        percentage: 100,
        amount: bookingPrice,
        notice: '48+ hours',
        policy: 'Full refund',
        isRescheduled: !!originalBookingDate
      };
    } else if (hoursUntil >= 24) {
      return {
        percentage: 50,
        amount: bookingPrice * 0.5,
        notice: '24-48 hours',
        policy: '50% refund',
        isRescheduled: !!originalBookingDate
      };
    } else {
      return {
        percentage: 0,
        amount: 0,
        notice: '<24 hours',
        policy: 'No refund',
        isRescheduled: !!originalBookingDate
      };
    }
  };

  const refundInfo = getRefundInfo();

  const handleCancel = async () => {
    try {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      setSuccess(true);
      // Briefly show success, then refresh parent data and close
      await new Promise((r) => setTimeout(r, 1200));
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="relative p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cancel Booking?</h2>
              <p className="text-sm text-gray-600 mt-1">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Booking Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Instructor</p>
                <p className="font-semibold text-gray-900">{instructorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(bookingDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Original Price</p>
                <p className="font-semibold text-gray-900">${bookingPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Cancellation Notice</p>
                <p className="font-semibold text-gray-900">{refundInfo.notice}</p>
              </div>
            </div>
          </div>

          {/* Refund Policy */}
          <div className={`mb-6 p-4 rounded-lg border ${
            refundInfo.percentage === 100 ? 'bg-green-50 border-green-200' :
            refundInfo.percentage === 50 ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <p className="text-sm font-semibold text-gray-900 mb-3">Cancellation Policy</p>
            
            {/* Reschedule Warning */}
            {refundInfo.isRescheduled && (
              <div className="mb-3 p-2 bg-orange-100 border border-orange-300 rounded">
                <p className="text-xs font-semibold text-orange-900">⚠️ Rescheduled Booking</p>
                <p className="text-xs text-orange-800 mt-1">
                  Policy based on original booking time: {new Date(originalBookingDate!).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Notice Given:</span>
                <span className="font-semibold text-gray-900">{refundInfo.notice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Policy:</span>
                <span className="font-semibold text-gray-900">{refundInfo.policy}</span>
              </div>
              <div className={`flex justify-between border-t pt-2 ${
                refundInfo.percentage === 100 ? 'border-green-300' :
                refundInfo.percentage === 50 ? 'border-yellow-300' :
                'border-red-300'
              }`}>
                <span className="text-sm font-semibold text-gray-900">Refund to Wallet:</span>
                <span className={`font-bold ${
                  refundInfo.percentage === 100 ? 'text-green-600' :
                  refundInfo.percentage === 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>${refundInfo.amount.toFixed(2)}</span>
              </div>
            </div>
            <div className={`mt-3 pt-3 border-t ${
              refundInfo.percentage === 100 ? 'border-green-200' :
              refundInfo.percentage === 50 ? 'border-yellow-200' :
              'border-red-200'
            }`}>
              <p className="text-xs text-gray-600 font-semibold mb-1">Cancellation Policy:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• 48+ hours notice: 100% refund to wallet</li>
                <li>• 24-48 hours notice: 50% refund to wallet</li>
                <li>• Less than 24 hours: No refund</li>
              </ul>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">Booking cancelled successfully</p>
                <p className="text-sm text-green-700">
                  Confirmation email sent to you and {instructorName}
                </p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              disabled={loading}
            >
              Keep Booking
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Booking'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CancelDialog;
