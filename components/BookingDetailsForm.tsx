'use client';

import React, { useState, useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

interface AvailableSlot {
  time: string;
  available: boolean;
}

export default function BookingDetailsForm() {
  const { bookingState, addScheduledBooking, removeScheduledBooking, setPdaTestBooking, getSessionId, reserveSlot, releaseSlot } = useBooking();
  const { instructor, hours, scheduledBookings, includeTestPackage, pdaTestBooking } = bookingState;
  const showPdaPackage = includeTestPackage;

  // Tab state: 'lessons' or 'pda-test'
  const [activeTab, setActiveTab] = useState<'lessons' | 'pda-test'>('lessons');

  // Use context's sessionId instead of generating a new one
  // This ensures reservation ownership is consistent across component refreshes and storage recovery
  const sessionId = getSessionId();
  
  // Lesson scheduling state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [pickupLocation, setPickupLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // PDA test scheduling state
  const [pdaConfigs, setPdaConfigs] = useState<any[]>([]);
  const [pdaTestCentres, setPdaTestCentres] = useState<any[]>([]);
  const [selectedPdaConfig, setSelectedPdaConfig] = useState('');
  const [selectedTestCentre, setSelectedTestCentre] = useState('');
  const [selectedTestDate, setSelectedTestDate] = useState('');
  const [selectedTestTime, setSelectedTestTime] = useState('');
  const [pdaPickupLocation, setPdaPickupLocation] = useState('');
  const [pdaNotes, setPdaNotes] = useState('');
  const [pickupOption, setPickupOption] = useState<'pickup' | 'centre' | 'none'>('pickup');
  const [isLoadingPda, setIsLoadingPda] = useState(false);

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

  // Fetch PDA configs when includeTestPackage is enabled
  useEffect(() => {
    if (showPdaPackage && instructor?.id) {
      fetchPdaConfigs();
    }
  }, [showPdaPackage, instructor?.id]);

  // Auto-switch to PDA tab if all lesson hours are scheduled and PDA is included
  useEffect(() => {
    if (showPdaPackage && remainingHours === 0 && activeTab === 'lessons') {
      setActiveTab('pda-test');
    }
  }, [showPdaPackage, remainingHours, activeTab]);

  // Cleanup: Release all reserved slots when component unmounts or user leaves
  useEffect(() => {
    return () => {
      // Release all reserved slots
      scheduledBookings.forEach((booking) => {
        const slotKey = `${instructor?.id}:${booking.date}:${booking.time}:${booking.duration}`;
        releaseSlot(slotKey);
      });
    };
  }, [scheduledBookings, instructor?.id, releaseSlot]);

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

  const fetchPdaConfigs = async () => {
    if (!instructor?.id) return;
    
    setIsLoadingPda(true);
    try {
      const response = await fetch(`/api/instructor/pda-configs?instructorId=${instructor.id}`);
      if (response.ok) {
        const data = await response.json();
        setPdaConfigs(data.configs || []);
        
        // If there's only one config, select it
        if (data.configs && data.configs.length === 1) {
          setSelectedPdaConfig(data.configs[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching PDA configs:', error);
    } finally {
      setIsLoadingPda(false);
    }
  };

  const fetchTestCentres = async (configId: string) => {
    if (!configId) return;
    
    try {
      const response = await fetch(`/api/instructor/pda-configs/${configId}`);
      if (response.ok) {
        const data = await response.json();
        setPdaTestCentres(data.config?.testCentres || []);
        
        // Auto-select centre if only one available
        if (data.config?.testCentres && data.config.testCentres.length === 1) {
          setSelectedTestCentre(data.config.testCentres[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching test centres:', error);
    }
  };

  // Get selected PDA config object
  const getSelectedPdaConfig = () => {
    return pdaConfigs.find((c: any) => c.id === selectedPdaConfig);
  };

  // Get config includes settings
  const getConfigIncludes = () => {
    const config = getSelectedPdaConfig();
    if (!config) return { pickup: false, dropoff: false, debriefing: false };
    return config.includes || { pickup: false, dropoff: false, debriefing: false };
  };

  // Format duration minutes to human readable
  const formatDurationMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const handleAddPdaTest = async () => {
    // Validation
    if (!selectedPdaConfig) {
      alert('Please select a PDA test configuration');
      return;
    }
    if (!selectedTestCentre) {
      alert('Please select a test centre');
      return;
    }
    if (!selectedTestDate) {
      alert('Please select a test date');
      return;
    }
    if (!selectedTestTime) {
      alert('Please select a test time');
      return;
    }

    // Check if pickup address is required but not provided
    const includes = getConfigIncludes();
    if ((pickupOption === 'pickup' || includes.pickup) && !pdaPickupLocation.trim()) {
      alert('Please enter a pickup location');
      return;
    }

    try {
      // Call the API to create PDA test booking
      const response = await fetch('/api/pda-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: selectedPdaConfig,
          testCentreId: selectedTestCentre,
          testDate: selectedTestDate,
          testTime: selectedTestTime,
          pickupLocation: pickupOption === 'pickup' ? pdaPickupLocation : undefined,
          notes: pdaNotes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to book PDA test');
        return;
      }

      const result = await response.json();
      
      // Find the config and centre details for context storage
      const config = pdaConfigs.find((c: any) => c.id === selectedPdaConfig);
      const centre = pdaTestCentres.find((c: any) => c.id === selectedTestCentre);
      
      // Store in context
      if (config && centre) {
        setPdaTestBooking({
          id: result.booking.id,
          configId: selectedPdaConfig,
          configName: config.name,
          testCentreId: selectedTestCentre,
          testCentreName: centre.name,
          testCentreAddress: centre.address,
          testDate: selectedTestDate,
          testTime: selectedTestTime,
          price: result.booking.price || config.price,
          durationMinutes: config.durationMinutes,
          status: result.booking.status || 'PENDING'
        });
      }
      
      // Clear form
      setSelectedPdaConfig('');
      setSelectedTestCentre('');
      setSelectedTestDate('');
      setSelectedTestTime('');
      setPdaPickupLocation('');
      setPdaNotes('');
      setPickupOption('pickup');
      
      // Switch back to lessons tab
      setActiveTab('lessons');
      
      alert(`PDA Test booked successfully! Booking ID: ${result.booking.id}`);
    } catch (error) {
      console.error('Error booking PDA test:', error);
      alert('Failed to book PDA test. Please try again.');
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

    // Check for overlap with already-scheduled local bookings
    const newStart = new Date(`${selectedDate}T${selectedTime}`);
    const newEnd = new Date(newStart.getTime() + selectedDuration * 60 * 1000);
    const hasLocalConflict = scheduledBookings.some(b => {
      const bStart = new Date(`${b.date}T${b.time}`);
      const bEnd = new Date(bStart.getTime() + b.duration * 60 * 1000);
      return newStart < bEnd && newEnd > bStart;
    });
    if (hasLocalConflict) {
      alert('This time overlaps with a lesson you already scheduled. Please choose a different time.');
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

      // Track reserved slot in context
      reserveSlot(instructor!.id, selectedDate, selectedTime, selectedDuration);

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
      
      // Release the reserved slot from both context and server
      try {
        // Call server DELETE to release the reservation
        await fetch('/api/availability/check-and-reserve', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorId: instructor!.id,
            date: booking.date,
            time: booking.time,
            duration: booking.duration,
            sessionId
          })
        });
      } catch (error) {
        console.error('Failed to release server reservation:', error);
        // Still remove from context even if server call fails (cleanup cron will handle it)
      }

      // Also release from context
      const slotKey = `${instructor!.id}:${booking.date}:${booking.time}:${booking.duration}`;
      releaseSlot(slotKey);

      // Remove the booking from context
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
      <div className="bg-gradient-to-br from-white/8 to-white/4 rounded-lg border border-white/20 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-white">Hours Scheduled</span>
          <span className="text-base font-bold text-blue-300">
            {bookedHours.toFixed(1)} / {hours}
          </span>
        </div>
        <div className="w-full bg-white/8 rounded-full h-4 border border-white/10">
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-1"
            style={{ width: `${(bookedHours / hours) * 100}%` }}
          >
            {(bookedHours / hours) * 100 > 10 && (
              <span className="text-xs font-semibold text-white drop-shadow">
                {Math.round((bookedHours / hours) * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-xs text-white/70">
            {remainingHours > 0 
              ? `${remainingHours.toFixed(1)} hours remaining` 
              : '✓ All hours scheduled'}
          </p>
          <p className="text-xs text-white/70 font-mono">
            {bookedHours.toFixed(1)}h / {hours}h
          </p>
        </div>
      </div>

      {/* Scheduled Bookings List */}
      {scheduledBookings.length > 0 && (
        <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-lg border border-white/10 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Scheduled Lessons ({scheduledBookings.length})
          </h3>
          <div className="space-y-3">
            {scheduledBookings.map((booking, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-white">
                      {formatDate(booking.date)} at {booking.time}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">
                    Duration: {formatDuration(booking.duration)}
                  </p>
                  <p className="text-sm text-white/70">
                    Pickup: {booking.pickupLocation}
                  </p>
                  {booking.notes && (
                    <p className="text-sm text-white/60 mt-1">
                      Notes: {booking.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveBooking(index)}
                  className="text-red-400 hover:text-red-300 p-2"
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
      {(remainingHours > 0 || showPdaPackage) && (
        <div className="bg-gradient-to-br from-white/5 to-white/2 rounded-lg border border-white/10 p-4 sm:p-6">
          {remainingHours > 0 && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {scheduledBookings.length === 0 ? 'Schedule Your First Lesson' : 'Add Another Lesson'}
              </h3>
            </div>
          )}

          {!remainingHours && showPdaPackage && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                Schedule Your PDA Test
              </h3>
            </div>
          )}

          {/* Tab Switcher - Show if PDA test is included AND have remaining hours */}
          {showPdaPackage && remainingHours > 0 && (
            <div className="mb-6 flex gap-2 border-b border-white/10">
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'lessons'
                    ? 'border-blue-400 text-blue-300'
                    : 'border-transparent text-white/60 hover:text-white/90'
                }`}
              >
                📅 Schedule Lessons
              </button>
              <button
                onClick={() => {
                  setActiveTab('pda-test');
                  if (pdaConfigs.length === 0) {
                    fetchPdaConfigs();
                  }
                }}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'pda-test'
                    ? 'border-blue-400 text-blue-300'
                    : 'border-transparent text-white/60 hover:text-white/90'
                }`}
              >
                🧪 Schedule PDA Test
              </button>
            </div>
          )}

          {/* If no remaining hours but PDA is included, auto-switch to PDA tab */}
          {showPdaPackage && !remainingHours && (
            <div className="mb-6 text-sm text-white/70 bg-white/5 border border-white/10 rounded p-3">
              ℹ️ All lesson hours scheduled. You can now add your PDA test below.
            </div>
          )}

          <div className="space-y-4">
            {/* LESSONS TAB - Only show if remaining hours */}
            {activeTab === 'lessons' && remainingHours > 0 && (
              <>
                {/* Date Selection */}
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-white/90 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={getMinDate()}
                    max={getMaxDate()}
                    aria-label="Select lesson date"
                    aria-required="true"
                    aria-invalid={!selectedDate}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                  />
                </div>

                {/* Duration Selection */}
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-white/90 mb-1">
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
                    aria-label="Select lesson duration"
                    aria-required="true"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
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
                  <label htmlFor="time" className="block text-sm font-medium text-white/90 mb-1">
                    Time *
                  </label>
                  {!selectedDate ? (
                    <p className="text-sm text-white/50 py-3">Please select a date first</p>
                  ) : isLoadingSlots ? (
                    <p className="text-sm text-white/50 py-3">Loading available times...</p>
                  ) : (
                    <select
                      id="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      aria-label="Select lesson time"
                      aria-required="true"
                      aria-invalid={!selectedTime}
                      className="w-full px-4 py-3 bg-slate-700 dark:bg-slate-700 border-2 border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-600 transition-colors font-semibold"
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
                  <label htmlFor="pickupLocation" className="block text-sm font-medium text-white/90 mb-1">
                    Pickup Location *
                  </label>
                  <PickupLocationInput
                    value={pickupLocation}
                    onChange={setPickupLocation}
                    instructorId={instructor?.id ?? ''}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-white/90 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-label="Special instructions or notes for your lesson"
                    placeholder="Any special requests or information for the instructor"
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                  />
                </div>
              </>
            )}

            {/* PDA TEST TAB */}
            {activeTab === 'pda-test' && showPdaPackage && (
              <>
                {/* If no config selected - Show selection message */}
                {!selectedPdaConfig && (
                  <div className="bg-blue-500/15 rounded-lg p-4 border border-blue-500/40 mb-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-blue-200">
                        <p className="font-semibold mb-1">Select Your PDA Package</p>
                        <p>You've added a PDA test to your booking. Choose which test package to schedule:</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PDA Config Selection */}
                <div>
                  <label htmlFor="pda-config" className="block text-sm font-medium text-white/90 mb-1">
                    PDA Test Package *
                  </label>
                  {isLoadingPda ? (
                    <p className="text-sm text-white/50 py-3">Loading PDA options...</p>
                  ) : pdaConfigs.length === 0 ? (
                    <p className="text-sm text-red-400">No PDA test configurations available</p>
                  ) : (
                    <select
                      id="pda-config"
                      value={selectedPdaConfig}
                      onChange={(e) => {
                        setSelectedPdaConfig(e.target.value);
                        fetchTestCentres(e.target.value);
                        setPdaTestCentres([]);
                        setSelectedTestCentre('');
                        setPickupOption('pickup');
                      }}
                      aria-label="Select PDA test package"
                      aria-required="true"
                      aria-invalid={!selectedPdaConfig}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                    >
                      <option value="">Select a test package</option>
                      {pdaConfigs.map((config: any) => (
                        <option key={config.id} value={config.id}>
                          {config.name} - ${config.price} ({formatDurationMinutes(config.durationMinutes)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Config Info Header - Show when config selected */}
                {selectedPdaConfig && getSelectedPdaConfig() && (
                  <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg p-4 border border-blue-500/40 mb-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-white/60 font-semibold uppercase mb-1">Selected Package:</p>
                        <p className="font-semibold text-white mb-1">{getSelectedPdaConfig().name}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-blue-300">${getSelectedPdaConfig().price}</span>
                          <span className="text-white/70">|</span>
                          <span className="text-blue-300">{formatDurationMinutes(getSelectedPdaConfig().durationMinutes)}</span>
                        </div>
                        {getConfigIncludes().pickup && (
                          <p className="text-xs text-green-300 mt-2">✓ Includes Pickup</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPdaConfig('');
                          setPdaTestCentres([]);
                          setSelectedTestCentre('');
                        }}
                        className="text-sm text-blue-300 hover:text-blue-200 whitespace-nowrap"
                      >
                        Change Package
                      </button>
                    </div>
                  </div>
                )}

                {/* Test Centre Selection */}
                {selectedPdaConfig && pdaTestCentres.length > 1 && (
                  <div>
                    <label htmlFor="test-centre" className="block text-sm font-medium text-white/90 mb-1">
                      Test Centre *
                    </label>
                    {pdaTestCentres.length === 0 ? (
                      <p className="text-sm text-red-400">No test centres available for this configuration</p>
                    ) : (
                      <select
                        id="test-centre"
                        value={selectedTestCentre}
                        onChange={(e) => setSelectedTestCentre(e.target.value)}
                        aria-label="Select test centre"
                        aria-required="true"
                        aria-invalid={!selectedTestCentre}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                      >
                        <option value="">Select a test centre</option>
                        {pdaTestCentres.map((centre: any) => (
                          <option key={centre.id} value={centre.id}>
                            {centre.name} - {centre.address}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Test Date Selection */}
                {selectedPdaConfig && selectedTestCentre && (
                  <div>
                    <label htmlFor="test-date" className="block text-sm font-medium text-white/90 mb-1">
                      Select Date *
                    </label>
                    <input
                      type="date"
                      id="test-date"
                      value={selectedTestDate}
                      onChange={(e) => setSelectedTestDate(e.target.value)}
                      min={getMinDate()}
                      max={getMaxDate()}
                      aria-label="Select test date"
                      aria-required="true"
                      aria-invalid={!selectedTestDate}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                    />
                  </div>
                )}

                {/* Duration Display (Read-only) */}
                {selectedPdaConfig && (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-1">
                      Duration
                    </label>
                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/70">
                      {formatDurationMinutes(getSelectedPdaConfig()?.durationMinutes || 0)}
                    </div>
                    <p className="text-xs text-white/50 mt-1">Fixed duration based on your selected package</p>
                  </div>
                )}

                {/* Test Time Selection */}
                {selectedPdaConfig && selectedTestDate && (
                  <div>
                    <label htmlFor="test-time" className="block text-sm font-medium text-white/90 mb-1">
                      Select Time *
                    </label>
                    <select
                      id="test-time"
                      value={selectedTestTime}
                      onChange={(e) => setSelectedTestTime(e.target.value)}
                      aria-label="Select test time"
                      aria-required="true"
                      aria-invalid={!selectedTestTime}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                    >
                      <option value="">Select a time</option>
                      {generateTimeSlots().map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pickup Location - Conditional based on config */}
                {selectedPdaConfig && selectedTestTime && (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Pickup & Location {getConfigIncludes().pickup ? '' : '*'}
                    </label>

                    {getConfigIncludes().pickup ? (
                      <>
                        {/* Has Pickup */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="pickup-yes"
                              name="pickup"
                              value="pickup"
                              checked={pickupOption === 'pickup'}
                              onChange={(e) => setPickupOption(e.target.value as 'pickup' | 'centre' | 'none')}
                              className="w-4 h-4"
                            />
                            <label htmlFor="pickup-yes" className="text-white/90 cursor-pointer">
                              Pick me up at my address
                            </label>
                          </div>
                          
                          {pickupOption === 'pickup' && (
                            <input
                              type="text"
                              value={pdaPickupLocation}
                              onChange={(e) => setPdaPickupLocation(e.target.value)}
                              placeholder="Enter your pickup address"
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                            />
                          )}

                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="pickup-no"
                              name="pickup"
                              value="centre"
                              checked={pickupOption === 'centre'}
                              onChange={(e) => setPickupOption(e.target.value as 'pickup' | 'centre' | 'none')}
                              className="w-4 h-4"
                            />
                            <label htmlFor="pickup-no" className="text-white/90 cursor-pointer">
                              Meet me at test centre
                            </label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* No Pickup - Meet at centre only */}
                        <div className="px-4 py-3 bg-white/6 border border-white/10 rounded-lg">
                          <p className="text-white/90 mb-2">○ Meet at test centre</p>
                          {pdaTestCentres.find(c => c.id === selectedTestCentre) && (
                            <p className="text-sm text-white/60 flex items-center gap-2">
                              📍 {pdaTestCentres.find(c => c.id === selectedTestCentre)?.name}
                            </p>
                          )}
                          <p className="text-xs text-white/50 mt-2">This package does not include pickup service</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Notes - Optional */}
                {selectedPdaConfig && selectedTestTime && (
                  <div>
                    <label htmlFor="pda-notes" className="block text-sm font-medium text-white/90 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="pda-notes"
                      value={pdaNotes}
                      onChange={(e) => setPdaNotes(e.target.value)}
                      placeholder="Any special requests or information for the test coordinator"
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
                    />
                  </div>
                )}

                {/* Add PDA Test Button */}
                <button
                  onClick={handleAddPdaTest}
                  disabled={!selectedPdaConfig || !selectedTestCentre || !selectedTestDate || !selectedTestTime}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-600 transition-colors disabled:from-white/20 disabled:to-white/20 disabled:cursor-not-allowed mb-32 lg:mb-0"
                >
                  + Add This PDA Test
                </button>
              </>
            )}

            {/* PDA Test Option - Info (for Lessons Tab) */}
            {activeTab === 'lessons' && showPdaPackage && (
              <div className="bg-blue-500/10 rounded-lg p-3 sm:p-4 border border-blue-500/30">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-200">
                    <p className="font-semibold mb-1">PDA Test Included</p>
                    <p>Use the "Schedule PDA Test" tab to schedule your test on a specific date and centre</p>
                  </div>
                </div>
              </div>
            )}

            {/* Add Lesson Button (visible only in lessons tab with remaining hours) */}
            {activeTab === 'lessons' && remainingHours > 0 && (
              <button
                onClick={handleAddBooking}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-500 hover:to-green-600 transition-colors mb-32 lg:mb-0"
              >
                + Add This Lesson
              </button>
            )}

            {/* No remaining hours message */}
            {activeTab === 'lessons' && remainingHours === 0 && (
              <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30 text-center">
                <p className="text-green-300 font-semibold">✓ All lesson hours scheduled</p>
                <p className="text-white/70 text-sm mt-1">
                  {showPdaPackage ? 'Switch to the PDA Test tab to schedule your test.' : 'You can schedule more hours from your dashboard.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-500/10 rounded-lg p-3 sm:p-4 border border-blue-500/30">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-1">Scheduling Tips</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>You can schedule all hours now or leave some for later</li>
              <li>Remaining hours can be scheduled from your dashboard</li>
              {showPdaPackage && <li>You can add your PDA test using the Schedule PDA Test tab</li>}
              <li>You must schedule at least one lesson{showPdaPackage ? ' or a PDA test' : ''} to continue</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pickup Location Input with service-area validation ───────────────────────
// Debounces the address, calls /api/public/check-service-area, and shows an
// inline warning if the address is outside the instructor's radius.
// Does NOT block the booking — it's informational only.

type ServiceAreaResult = 'in' | 'out' | 'unknown' | 'checking' | 'idle';

interface PickupLocationInputProps {
  value: string;
  onChange: (v: string) => void;
  instructorId: string;
}

function PickupLocationInput({ value, onChange, instructorId }: PickupLocationInputProps) {
  const [checkResult, setCheckResult] = React.useState<ServiceAreaResult>('idle');
  const [distanceKm, setDistanceKm] = React.useState<number | null>(null);
  const [radiusKm, setRadiusKm] = React.useState<number | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // Reset on empty
    if (!value.trim() || value.trim().length < 5) {
      setCheckResult('idle');
      setDistanceKm(null);
      return;
    }

    // Debounce — wait 800ms after typing stops
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCheckResult('checking');

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/check-service-area?instructorId=${encodeURIComponent(instructorId)}&address=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) { setCheckResult('unknown'); return; }
        const data = await res.json();
        setCheckResult(data.result as ServiceAreaResult);
        setDistanceKm(data.distanceKm ?? null);
        setRadiusKm(data.radiusKm ?? null);
      } catch {
        setCheckResult('unknown');
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, instructorId]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          type="text"
          id="pickupLocation"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your pickup address"
          aria-label="Pickup location"
          aria-required="true"
          aria-invalid={!value}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/10 transition-colors"
        />
        {/* Spinner while checking */}
        {checkResult === 'checking' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-white/40 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
        {/* In-range tick */}
        {checkResult === 'in' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</div>
        )}
      </div>

      {/* Out of range — amber warning, non-blocking */}
      {checkResult === 'out' && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>
            This address appears to be{distanceKm != null ? ` ~${distanceKm} km` : ''} from the instructor's base
            {radiusKm != null ? `, outside their ${radiusKm} km service area` : ''}.
            You can still book — confirm with your instructor that they cover this location.
          </span>
        </div>
      )}

      {/* Unknown — grey note, non-blocking */}
      {checkResult === 'unknown' && value.trim().length >= 5 && (
        <p className="text-xs text-white/30 px-1">
          Service area check unavailable — please confirm your address with the instructor.
        </p>
      )}
    </div>
  );
}
