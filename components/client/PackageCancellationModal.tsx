'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, DollarSign, Clock, Package, Loader2, CheckCircle } from 'lucide-react';

interface PackageCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    packageHours: number;
    packageHoursRemaining: number;
    packageTotalPaid: number;
    startTime: string | null;
    provider: { name: string };
  };
  onSuccess: () => void;
}

export default function PackageCancellationModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: PackageCancellationModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundCalculation, setRefundCalculation] = useState<{
    hoursUsed: number;
    hoursRemaining: number;
    baseRefund: number;
    refundPercentage: number;
    estimatedRefund: number;
    policyMessage: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      calculateRefund();
    }
  }, [isOpen, booking]);

  const calculateRefund = () => {
    const hoursUsed = booking.packageHours - booking.packageHoursRemaining;
    const hoursRemaining = booking.packageHoursRemaining;

    // Calculate base refundable amount (tier-aware calculation happens server-side)
    // For preview, we estimate based on simple proportion
    const usedAmount = (hoursUsed / booking.packageHours) * booking.packageTotalPaid;
    const baseRefund = booking.packageTotalPaid - usedAmount;

    // Time-based policy
    const now = new Date();
    const startTime = booking.startTime ? new Date(booking.startTime) : now;
    const hoursNotice = (startTime.getTime() - now.getTime()) / 3600000;

    let refundPercentage = 0;
    let policyMessage = '';

    if (hoursNotice >= 48) {
      refundPercentage = 100;
      policyMessage = '100% refund (48+ hours notice)';
    } else if (hoursNotice >= 24) {
      refundPercentage = 50;
      policyMessage = '50% refund (24-48 hours notice)';
    } else {
      refundPercentage = 0;
      policyMessage = 'No refund (<24 hours notice)';
    }

    const estimatedRefund = baseRefund * (refundPercentage / 100);

    setRefundCalculation({
      hoursUsed,
      hoursRemaining,
      baseRefund,
      refundPercentage,
      estimatedRefund,
      policyMessage,
    });
  };

  const handleSubmit = async () => {
    setError(null);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/bookings/${booking.id}/request-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit cancellation request');
      }

      const data = await res.json();

      // Success!
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit cancellation request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Request Package Cancellation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Package Info */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Package Details</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Package Size:</span>
                <span className="font-semibold text-gray-900">{booking.packageHours} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hours Used:</span>
                <span className="font-semibold text-gray-900">{refundCalculation?.hoursUsed || 0} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hours Remaining:</span>
                <span className="font-semibold text-emerald-600">{refundCalculation?.hoursRemaining || 0} hours</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-bold text-gray-900">${booking.packageTotalPaid.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Refund Calculation */}
          {refundCalculation && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900">Estimated Refund</h3>
              </div>
              
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Refundable:</span>
                  <span className="font-semibold text-gray-900">${refundCalculation.baseRefund.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cancellation Policy:</span>
                  <span className="font-semibold text-orange-600">{refundCalculation.refundPercentage}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-emerald-300">
                <span className="font-semibold text-gray-900">Estimated Refund:</span>
                <span className="text-2xl font-bold text-emerald-600">
                  ${refundCalculation.estimatedRefund.toFixed(2)}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 mt-3 text-xs bg-white/60 rounded-lg px-3 py-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-amber-700 font-medium">{refundCalculation.policyMessage}</span>
              </div>
            </div>
          )}

          {/* Policy Explanation */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-sm">
            <h4 className="font-semibold text-blue-900 mb-2">📋 How It Works</h4>
            <ul className="space-y-1.5 text-blue-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Your request will be reviewed by our admin team within 24 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Refund is based on hours used vs. package discount tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Time-based policy applies: 48h+ = 100%, 24-48h = 50%, &lt;24h = 0%</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Refund goes to your original payment method (5-10 business days)</span>
              </li>
            </ul>
          </div>

          {/* Reason (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Reason for Cancellation <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Help us improve by sharing why you're cancelling..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{reason.length}/500 characters</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (refundCalculation?.estimatedRefund === 0)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>

          {refundCalculation?.estimatedRefund === 0 && (
            <p className="text-xs text-center text-red-600 font-medium">
              ⚠️ No refund available due to late cancellation (&lt;24h notice)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}