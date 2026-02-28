'use client';

import React, { useState, useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

interface AvailableSlot {
  time: string;
  available: boolean;
}

// Generate a unique session ID for this booking flow
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default function BookingDetailsForm() {
  const { bookingState, addScheduledBooking, removeScheduledBooking } = useBooking();
  const { instructor, hours, scheduledBookings } = bookingState;

  const [sessionId] = useState(generateSessionId());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [pickupLocation, setPickupLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [reservedSlots, setReservedSlots] = useState<Set<string>>(new Set());

  // Calculate booked and remaining hours
  const bookedHours = scheduledBookings.reduce((sum, booking) => sum + (booking.duration / 60), 0);
  const remainingHours = hours - bookedHours;

  // Get instructor's allowed durations
  const allowedDurations = (instructor as any)?.allowedDurations || [60, 120];

  // Generate time slots (9 AM to 5 PM in 30-minute intervals)
  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 17 && minute > 0) break; // Stop at 5:00 PM
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  // Fetch available slots when date changes
  useEffect(() => {
    if (selectedDate && instructor) {
      fetchAvailableSlots();
    }
  }, [selectedDate, instructor]);

  // Cleanup: Release all reserved slots when component unmounts or user leaves
  useEffect(() => {
    return () => {
      // Release all reserved slots
      scheduledBookings.forEach(async (booking) => {
        try {
          await fetch(
            `/api/availability/check-and-reserve?instructorId=${instructor?.id}&date=${booking.date}&time=${booking.time}&duration=${booking.duration}&sessionId=${sessionId}`,
            { method: 'DELETE' }
          );
        } catch (error) {
          console.error('Error releasing slot on cleanup:', error);
        }
      });
    };
  }, [scheduledBookings, instructor, sessionId]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !instructor) return;

    setIsLoadingSlots(true);
    try {
      const response = await fetch(
        `/api/availability/slots?instructorId=${instructor.id}&date=${selectedDate}&duration=${selectedDuration}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Mark slots that are already scheduled in this session as unavailable
        const filteredSlots = (data.slots || []).map((slot: AvailableSlot) => {
          const isScheduledInSession = scheduledBookings.some(
            booking => booking.date === selectedDate && 
                      booking.time === slot.time && 
                      booking.duration === selectedDuration
          );
          
          return {
            ...slot,
            available: slot.available && !isScheduledInSession
          };
        });
        
        setAvailableSlots(filteredSlots);
      } else {
        // Fallback: generate all slots as available
        const allSlots = generateTimeSlots();
        const filteredSlots = allSlots.map(time => {
          const isScheduledInSession = scheduledBookings.some(
            booking => booking.date === selectedDate && 
                      booking.time === time && 
                      booking.duration === selectedDuration
          );
          return { time, available: !isScheduledInSession };
        });
        setAvailableSlots(filteredSlots);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      // Fallback: generate all slots as available
      const allSlots = generateTimeSlots();
      const filteredSlots = allSlots.map(time => {
        const isScheduledInSession = scheduledBookings.some(
          booking => booking.date === selectedDate && 
                    booking.time === time && 
                    booking.duration === selectedDuration
        );
        return { time, available: !isScheduledInSession };
      });
      setAvailableSlots(filteredSlots);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleAddBooking = async () => {
    // Validation
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }
    if (!selectedTime) {
      alert('Please select a time');
      return;
    }
    if (!pickupLocation.trim()) {
      alert('Please enter a pickup location');
      return;
    }

    // Check if adding this booking would exceed total hours
    const bookingHours = selectedDuration / 60;
    if (bookedHours + bookingHours > hours) {
      alert(`Cannot add booking. You only have ${remainingHours.toFixed(1)} hours remaining.`);
      return;
    }

    // Reserve the slot before adding
    try {
      const response = await fetch('/api/availability/check-and-reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: instructor!.id,
          date: selectedDate,
          time: selectedTime,
          duration: selectedDuration,
          sessionId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.available) {
        alert(result.reason || 'This time slot is no longer available. Please select another time.');
        // Refresh available slots
        fetchAvailableSlots();
        return;
      }

      // Add the booking
      addScheduledBooking({
        date: selectedDate,
        time: selectedTime,
        duration: selectedDuration,
        pickupLocation,
        notes
      });

      // Track reserved slot
      const slotKey = `${selectedDate}:${selectedTime}:${selectedDuration}`;
      setReservedSlots(prev => new Set(prev).add(slotKey));

      // Reset form
      setSelectedTime('');
      setPickupLocation('');
      setNotes('');
      
      // Refresh available slots
      fetchAvailableSlots();
    } catch (error) {
      console.error('Error reserving slot:', error);
      alert('Failed to reserve time slot. Please try again.');
    }
  };

  const handleRemoveBooking = async (index: number) => {
    if (confirm('Are you sure you want to remove this booking?')) {
      const booking = scheduledBookings[index];
      
      // Release the reserved slot
      try {
        await fetch(
          `/api/availability/check-and-reserve?instructorId=${instructor!.id}&date=${booking.date}&time=${booking.time}&duration=${booking.duration}&sessionId=${sessionId}`,
          { method: 'DELETE' }
        );
      } catch (error) {
        console.error('Error releasing slot:', error);
      }

      // Remove from reserved slots tracking
      const slotKey = `${booking.date}:${booking.time}:${booking.duration}`;
      setReservedSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotKey);
        return newSet;
      });

      // Remove the booking
      removeScheduledBooking(index);
      
      // Refresh available slots
      if (selectedDate) {
        fetchAvailableSlots();
      }
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get maximum date (3 months from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  };

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Hours Scheduled</span>
          <span className="text-sm font-semibold text-blue-600">
            {bookedHours.toFixed(1)} / {hours} hours
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(bookedHours / hours) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {remainingHours > 0 
            ? `${remainingHours.toFixed(1)} hours remaining` 
            : 'All hours scheduled'}
        </p>
      </div>

      {/* Scheduled Bookings List */}
      {scheduledBookings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Scheduled Lessons ({scheduledBookings.length})
          </h3>
          <div className="space-y-3">
            {scheduledBookings.map((booking, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {formatDate(booking.date)} at {booking.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Duration: {formatDuration(booking.duration)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Pickup: {booking.pickupLocation}
                  </p>
                  {booking.notes && (
                    <p className="text-sm text-gray-500 mt-1">
                      Notes: {booking.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveBooking(index)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Remove booking"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Booking Form */}
      {remainingHours > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {scheduledBookings.length === 0 ? 'Schedule Your First Lesson' : 'Add Another Lesson'}
          </h3>

          <div className="space-y-4">
            {/* Date Selection */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Duration Selection */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duration *
              </label>
              <select
                id="duration"
                value={selectedDuration}
                onChange={(e) => {
                  setSelectedDuration(Number(e.target.value));
                  if (selectedDate) {
                    fetchAvailableSlots();
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {allowedDurations.map((duration: number) => (
                  <option key={duration} value={duration}>
                    {formatDuration(duration)}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Selection */}
            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                Time *
              </label>
              {!selectedDate ? (
                <p className="text-sm text-gray-500 py-3">Please select a date first</p>
              ) : isLoadingSlots ? (
                <p className="text-sm text-gray-500 py-3">Loading available times...</p>
              ) : (
                <select
                  id="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a time</option>
                  {availableSlots.map(slot => (
                    <option 
                      key={slot.time} 
                      value={slot.time}
                      disabled={!slot.available}
                    >
                      {slot.time} {!slot.available ? '(Unavailable)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Pickup Location */}
            <div>
              <label htmlFor="pickupLocation" className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Location *
              </label>
              <input
                type="text"
                id="pickupLocation"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Enter your pickup address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or information for the instructor"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Add Booking Button */}
            <button
              onClick={handleAddBooking}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              + Add This Lesson
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Scheduling Tips</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>You can schedule all hours now or leave some for later</li>
              <li>Remaining hours can be scheduled from your dashboard</li>
              <li>You must schedule at least one lesson to continue</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
