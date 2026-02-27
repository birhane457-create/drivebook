'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Loader2, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  instructorId: string;
  currentDate: string;
  currentTime: string;
  currentDuration: number; // in minutes
  currentPrice: number;
  instructorName: string;
  instructorHourlyRate: number;
  onSuccess?: () => void;
}

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

export default function RescheduleModal({
  isOpen,
  onClose,
  bookingId,
  instructorId,
  currentDate,
  currentTime,
  currentDuration,
  currentPrice,
  instructorName,
  instructorHourlyRate,
  onSuccess
}: RescheduleModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState(currentDuration);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const submittingRef = useRef(false);

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const min = new Date();
    min.setDate(min.getDate() + 1);
    return min.toISOString().split('T')[0];
  };

  // Calculate new price based on duration change
  const calculateNewPrice = () => {
    const hours = newDuration / 60;
    return instructorHourlyRate * hours;
  };

  const newPrice = calculateNewPrice();
  const priceDifference = newPrice - currentPrice;
  const needsAdditionalCredit = priceDifference > walletBalance;

  // Fetch wallet balance
  useEffect(() => {
    if (isOpen) {
      fetch('/api/client/wallet')
        .then(res => res.json())
        .then(data => setWalletBalance(data.creditsRemaining || 0))
        .catch(err => console.error('Failed to fetch wallet:', err));
    }
  }, [isOpen]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (newDate && instructorId) {
      setLoadingSlots(true);
      setAvailableSlots([]);
      setError(null);
      
      const url = `/api/availability/slots?instructorId=${instructorId}&date=${newDate}&duration=${newDuration}&excludeBookingId=${bookingId}`;
      console.log('Fetching availability:', url);
      
      fetch(url)
        .then(res => {
          if (!res.ok) {
            throw new Error(`API returned ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('Availability response:', data);
          if (data.message) {
            setError(data.message);
          }
          setAvailableSlots(data.slots || []);
          setLoadingSlots(false);
        })
        .catch(err => {
          console.error('Failed to fetch slots:', err);
          setError('Failed to load available time slots. Please try again.');
          setLoadingSlots(false);
        });
    }
  }, [newDate, newDuration, instructorId, bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newDate || !newTime) {
      setError('Please select both date and time');
      return;
    }

    // Check if additional credit is needed
    if (needsAdditionalCredit) {
      setError(`Insufficient credits. You need $${priceDifference.toFixed(2)} more. Please add credits to your wallet first.`);
      return;
    }

    const selectedDate = new Date(newDate);
    const today = new Date();
    
    if (selectedDate < today) {
      setError('Cannot reschedule to a past date');
      return;
    }

    // Check 24-hour notice
    const hoursUntil = (selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      setError('You must reschedule at least 24 hours in advance');
      return;
    }

    try {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);

      const response = await fetch(`/api/client/bookings/${bookingId}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          time: newTime,
          duration: newDuration / 60 // Convert minutes to hours for API
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reschedule booking');
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
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Reschedule Booking</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Current Booking Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 mb-2">Current Booking</p>
            <p className="font-semibold text-gray-900 mb-1">{instructorName}</p>
            <p className="text-sm text-gray-700">
              {new Date(currentDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })} at {currentTime}
            </p>
            <p className="text-sm text-gray-700">
              Duration: {currentDuration} minutes • ${currentPrice.toFixed(2)}
            </p>
          </div>

          {/* Reschedule Policy Warning */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Reschedule Policy</p>
            <p className="text-xs text-yellow-800">
              Rescheduling must be done at least 12 hours before the lesson. Within 12 hours, you must cancel (cancellation fees apply).
            </p>
          </div>

          {/* Wallet Balance */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-700">Wallet Balance:</span>
            <span className="font-semibold text-gray-900">${walletBalance.toFixed(2)}</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Booking rescheduled successfully!</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Duration Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Duration (Edit Hours)
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewDuration(Math.max(60, newDuration - 60))}
                    disabled={newDuration <= 60 || loading}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-semibold"
                  >
                    − Reduce
                  </button>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value={60}>1 hour - ${(instructorHourlyRate).toFixed(2)}</option>
                    <option value={90}>1.5 hours - ${(instructorHourlyRate * 1.5).toFixed(2)}</option>
                    <option value={120}>2 hours - ${(instructorHourlyRate * 2).toFixed(2)}</option>
                    <option value={150}>2.5 hours - ${(instructorHourlyRate * 2.5).toFixed(2)}</option>
                    <option value={180}>3 hours - ${(instructorHourlyRate * 3).toFixed(2)}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setNewDuration(Math.min(180, newDuration + 60))}
                    disabled={newDuration >= 180 || loading}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 font-semibold"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-700">Current:</span>
                  <span className="font-semibold text-gray-900">${currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-700">After change:</span>
                  <span className="font-semibold text-gray-900">${newPrice.toFixed(2)}</span>
                </div>
                {priceDifference !== 0 && (
                  <div className={`flex justify-between items-center pt-2 border-t border-gray-200 ${priceDifference > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    <span className="text-sm font-semibold">{priceDifference > 0 ? 'Additional charge' : 'Refund'}:</span>
                    <span className="font-bold">{priceDifference > 0 ? '+' : ''}${priceDifference.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Date Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                New Date
              </label>
              <input
                type="date"
                min={getMinDate()}
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setNewTime(''); // Reset time when date changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 24 hours from now
              </p>
            </div>

            {/* Time Slot Selector */}
            {newDate && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Available Time Slots
                </label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading available slots...</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No available slots for this date
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {availableSlots.filter(slot => slot.available).map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setNewTime(slot.time)}
                        className={`px-3 py-2 text-sm rounded-lg border transition ${
                          newTime === slot.time
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Reschedule'
                )}
              </button>
            </div>
          </form>

          {/* Info */}
          <p className="text-xs text-gray-500 text-center mt-4">
            A confirmation email will be sent to both you and {instructorName}
          </p>
        </div>
      </div>
    </div>
  );
}
