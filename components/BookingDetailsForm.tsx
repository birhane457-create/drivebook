'use client';

import React, { useState, useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { AU_STATES } from '@/lib/data/au-locations';

interface AvailableSlot {
  time: string;
  available: boolean;
}

// ── Inline notification helpers ────────────────────────────────────────────────
type InlineError = string | null;

function FieldError({ message }: { message: InlineError }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
      ⚠️ {message}
    </p>
  );
}

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <p className="text-white font-semibold mb-5 text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 font-bold text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors border-2 border-transparent"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailsForm() {
  const { bookingState, addScheduledBooking, removeScheduledBooking, setPdaTestBooking, getSessionId, reserveSlot, releaseSlot } = useBooking();
  const { instructor, hours, scheduledBookings, includeTestPackage, pdaTestBooking } = bookingState;
  const showPdaPackage = includeTestPackage;

  // Inline error and confirm-dialog state (replaces alert() / confirm())
  const [formError, setFormError] = useState<InlineError>(null);
  const [pdaError, setPdaError] = useState<InlineError>(null);
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

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
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Fetch available slots when date OR duration changes.
  // Duration is included here so React state is guaranteed settled before the fetch runs —
  // calling fetchAvailableSlots() directly inside the duration onChange would read stale
  // selectedDuration (React batches state updates asynchronously).
  useEffect(() => {
    if (selectedDate && instructor) {
      fetchAvailableSlots();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedDuration, instructor]);

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

  // Keep a ref to the latest bookings so the unmount cleanup sees current state
  // without listing scheduledBookings as a dep (which would fire cleanup prematurely).
  const bookingsRef = React.useRef(scheduledBookings);
  const instructorIdRef = React.useRef(instructor?.id);
  React.useEffect(() => { bookingsRef.current = scheduledBookings; }, [scheduledBookings]);
  React.useEffect(() => { instructorIdRef.current = instructor?.id; }, [instructor?.id]);

  // Cleanup: Release all reserved slots ONLY when component unmounts
  useEffect(() => {
    return () => {
      bookingsRef.current.forEach((booking) => {
        const slotKey = `${instructorIdRef.current}:${booking.date}:${booking.time}:${booking.duration}`;
        releaseSlot(slotKey);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — intentionally runs cleanup only on unmount

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !instructor) return;

    setIsLoadingSlots(true);
    setSlotsError(null);
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
        // Do NOT fall back to generated slots — the server is the only source of truth.
        // Showing fabricated availability would let users pick slots that may already be booked.
        setAvailableSlots([]);
        setSlotsError('Unable to load available times. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      // Network or parse error — show error, never fabricate slots.
      setAvailableSlots([]);
      setSlotsError('Unable to load available times. Please check your connection and try again.');
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
    setPdaError(null);
    // Validation
    if (!selectedPdaConfig) {
      setPdaError('Please select a PDA test configuration');
      return;
    }
    if (!selectedTestCentre) {
      setPdaError('Please select a test centre');
      return;
    }
    if (!selectedTestDate) {
      setPdaError('Please select a test date');
      return;
    }
    if (!selectedTestTime) {
      setPdaError('Please select a test time');
      return;
    }

    // Check if pickup address is required but not provided
    const includes = getConfigIncludes();
    if ((pickupOption === 'pickup' || includes.pickup) && !pdaPickupLocation.trim()) {
      setPdaError('Please enter a pickup location');
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
        setPdaError(error.error || 'Failed to book PDA test');
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
      
      // Show inline success — no alert()
      setPdaError(null);
    } catch (error) {
      console.error('Error booking PDA test:', error);
      setPdaError('Failed to book PDA test. Please try again.');
    }
  };

  const handleAddBooking = async () => {
    setFormError(null);
    // Guard: instructor must be loaded
    if (!instructor) return;
    // Guard: prevent double-submit
    if (isSubmitting) return;

    // Validation
    if (!selectedDate) {
      setFormError('Please select a date');
      return;
    }
    if (!selectedTime) {
      setFormError('Please select a time');
      return;
    }
    if (!pickupLocation.trim()) {
      setFormError('Please enter a pickup location');
      return;
    }

    // Check if adding this booking would exceed total hours
    const bookingHours = selectedDuration / 60;
    if (bookedHours + bookingHours > hours) {
      setFormError(`Cannot add booking. You only have ${remainingHours.toFixed(1)} hours remaining.`);
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
      setFormError('This time overlaps with a lesson you already scheduled. Please choose a different time.');
      return;
    }

    // Reserve the slot before adding
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/availability/check-and-reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: instructor.id,
          date: selectedDate,
          time: selectedTime,
          duration: selectedDuration,
          sessionId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.available) {
        setFormError(result.reason || 'This time slot is no longer available. Please select another time.');
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
      reserveSlot(instructor.id, selectedDate, selectedTime, selectedDuration);

      // Reset form — keep pickup location so the next lesson doesn't need re-entry
      setSelectedTime('');
      setNotes('');
      setFormError(null);
      
      // Refresh available slots
      fetchAvailableSlots();
    } catch (error) {
      console.error('Error reserving slot:', error);
      setFormError('Failed to reserve time slot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveBooking = async (index: number) => {
    setConfirmRemoveIndex(index);
  };

  const executeRemoveBooking = async (index: number) => {
    setConfirmRemoveIndex(null);
    const booking = scheduledBookings[index];
    
    // Release the reserved slot from both context and server
      try {
        // Call server DELETE to release the reservation — params must be in URL query string,
        // not in body (HTTP spec: DELETE body is not guaranteed to be read by servers)
        const params = new URLSearchParams({
          instructorId: instructor!.id,
          date: booking.date,
          time: booking.time,
          duration: String(booking.duration),
          sessionId
        });
        await fetch(`/api/availability/check-and-reserve?${params.toString()}`, {
          method: 'DELETE',
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
    <div className="space-y-3">
      {/* Confirm remove dialog — replaces window.confirm() */}
      {confirmRemoveIndex !== null && (
        <ConfirmDialog
          message="Are you sure you want to remove this booking?"
          onConfirm={() => executeRemoveBooking(confirmRemoveIndex)}
          onCancel={() => setConfirmRemoveIndex(null)}
        />
      )}

      {/* Top-level form error (replaces alert()) */}
      {formError && <FieldError message={formError} />}

      {/* Progress Bar Container - High Visibility 3D Style */}
      <div className="bg-slate-900 rounded-xl border-2 border-slate-700 p-4 sm:p-6 shadow-[0_6px_0_0_#1e293b,0_20px_30px_0_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Hours Scheduled</span>
          <span className="text-base font-black text-sky-400 bg-slate-950 px-2.5 py-0.5 rounded-md border border-slate-800">
            {bookedHours.toFixed(1)} / {hours}
          </span>
        </div>
        
        {/* Progress Track - Opaque and Flat */}
        <div className="w-full bg-slate-950 rounded-full h-5 border-2 border-slate-800 overflow-hidden shadow-inner">
          <div
            className="bg-sky-500 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2 border-r-2 border-white shadow-[inset_-4px_0_0_0_#0284c7]"
            style={{ width: `${(bookedHours / hours) * 100}%` }}
          >
            {(bookedHours / hours) * 100 > 12 && (
              <span className="text-[10px] font-black text-white uppercase tracking-wider">
                {Math.round((bookedHours / hours) * 100)}%
              </span>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-3 font-bold text-sm">
          <p className={`text-xs uppercase tracking-wide ${remainingHours > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {remainingHours > 0 
              ? `⚠️ ${remainingHours.toFixed(1)} hours remaining` 
              : '✓ All hours scheduled'}
          </p>
          <p className="text-xs text-slate-400 font-mono tracking-tight bg-slate-950 px-1.5 py-0.5 rounded">
            {bookedHours.toFixed(1)}h / {hours}h
          </p>
        </div>
      </div>

      {/* Scheduled Bookings List */}
      {scheduledBookings.length > 0 && (
        <div className="bg-slate-900 rounded-xl border-2 border-slate-700 p-4 sm:p-6 shadow-[0_6px_0_0_#1e293b,0_20px_30px_0_rgba(0,0,0,0.5)]">
          <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>Scheduled Lessons</span>
            <span className="bg-sky-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full border border-sky-400">
              {scheduledBookings.length}
            </span>
          </h3>
          
          <div className="space-y-4">
            {scheduledBookings.map((booking, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-4 bg-slate-950 border-2 border-emerald-500 rounded-xl shadow-[0_4px_0_0_#064e3b]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
                    <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-extrabold text-white text-base tracking-tight">
                      {formatDate(booking.date)} at {booking.time}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 font-bold text-sm">
                    <p className="text-slate-200 flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-black">Duration:</span> 
                      {formatDuration(booking.duration)}
                    </p>
                    <p className="text-slate-200 flex items-center gap-1.5 truncate">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-black">Pickup:</span> 
                      {booking.pickupLocation}
                    </p>
                    {booking.notes && (
                      <p className="text-amber-300 bg-amber-950/60 border border-amber-900 rounded px-2 py-1 mt-2 text-xs font-semibold">
                        <span className="font-black uppercase tracking-wider block text-[10px] text-amber-400 mb-0.5">Notes:</span>
                        {booking.notes}
                      </p>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => handleRemoveBooking(index)}
                  className="text-red-400 hover:text-red-300 p-2 ml-2 transition-all duration-100 bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-900 rounded-lg shadow-sm active:scale-95 shrink-0"
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

        {/* Add New Booking Form Container */}
      {(remainingHours > 0 || showPdaPackage) && (
        <div className="bg-slate-900 rounded-xl border-2 border-slate-700 p-4 sm:p-6 shadow-[0_6px_0_0_#1e293b,0_20px_30px_0_rgba(0,0,0,0.5)]">
          {remainingHours > 0 && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                {scheduledBookings.length === 0 ? 'Schedule Your First Lesson' : 'Add Another Lesson'}
              </h3>
            </div>
          )}

          {!remainingHours && showPdaPackage && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Schedule Your PDA Test
              </h3>
            </div>
          )}

          {/* Tab Switcher - Upgraded to Solid 3D Dashboard Selection Tabs */}
          {showPdaPackage && remainingHours > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-xl border-2 border-slate-800">
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 py-2.5 rounded-lg font-black text-sm uppercase tracking-wider text-center transition-all duration-100 border-2 ${
                  activeTab === 'lessons'
                    ? 'border-white bg-sky-600 text-white shadow-[0_3px_0_0_#0369a1]'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                📅 Lessons
              </button>
              <button
                onClick={() => {
                  setActiveTab('pda-test');
                  if (pdaConfigs.length === 0) {
                    fetchPdaConfigs();
                  }
                }}
                className={`px-4 py-2.5 rounded-lg font-black text-sm uppercase tracking-wider text-center transition-all duration-100 border-2 ${
                  activeTab === 'pda-test'
                    ? 'border-white bg-sky-600 text-white shadow-[0_3px_0_0_#0369a1]'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                🧪 PDA Test
              </button>
            </div>
          )}


                  {/* If no remaining hours but PDA is included, auto-switch to PDA tab */}
          {showPdaPackage && !remainingHours && (
            <div className="mb-6 text-sm font-bold text-amber-300 bg-slate-950 border-2 border-amber-900 rounded-xl p-4 shadow-[0_4px_0_0_#451a03]">
              ℹ️ All lesson hours scheduled. You can now add your PDA test below.
            </div>
          )}

          <div className="space-y-4">
                      {/* LESSONS TAB - Only show if remaining hours */}
            {activeTab === 'lessons' && remainingHours > 0 && (
              <>
                {/* Date Selection */}
                <div>
                  <label htmlFor="date" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                    Date *
                  </label>
                  <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
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
                      className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)] [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Duration Selection */}
                <div>
                  <label htmlFor="duration" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                    Duration *
                  </label>
                  <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                    <select
                      id="duration"
                      value={selectedDuration}
                      onChange={(e) => {
                        setSelectedDuration(Number(e.target.value));
                        // No manual fetch needed — the useEffect on [selectedDate, selectedDuration]
                        // fires automatically after the state update settles.
                      }}
                      aria-label="Select lesson duration"
                      aria-required="true"
                      className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                    >
                      {allowedDurations.map((duration: number) => (
                        <option key={duration} value={duration} className="bg-slate-950 font-bold text-white">
                          {formatDuration(duration)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <label htmlFor="time" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                    Time *
                  </label>
                  {!selectedDate ? (
                    <p className="text-sm font-bold text-amber-400 bg-amber-950/40 border border-amber-900 rounded-xl px-4 py-3 shadow-[0_4px_0_0_#451a03]">
                      ⚠️ Please select a date first
                    </p>
                  ) : isLoadingSlots ? (
                    <p className="text-sm font-bold text-sky-400 bg-sky-950/40 border border-sky-900 rounded-xl px-4 py-3 animate-pulse shadow-[0_4px_0_0_#0c4a6e]">
                      🔄 Loading available times...
                    </p>
                  ) : slotsError ? (
                    <div className="bg-red-950/40 border-2 border-red-900 rounded-xl px-4 py-3 shadow-[0_4px_0_0_#450a0a]">
                      <p className="text-sm font-bold text-red-400 mb-2">⚠️ {slotsError}</p>
                      <button
                        type="button"
                        onClick={fetchAvailableSlots}
                        className="text-xs font-black text-sky-400 hover:text-white uppercase tracking-wider transition-colors"
                      >
                        ↻ Try again
                      </button>
                    </div>
                  ) : (
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                      <select
                        id="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        aria-label="Select lesson time"
                        aria-required="true"
                        aria-invalid={!selectedTime}
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-black transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                      >
                        <option value="" className="bg-slate-950 font-bold text-slate-400">Select a time</option>
                        {availableSlots.map(slot => (
                          <option 
                            key={slot.time} 
                            value={slot.time}
                            disabled={!slot.available}
                            className="bg-slate-950 font-bold text-white disabled:text-slate-600"
                          >
                            {slot.time} {!slot.available ? '(Unavailable)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Pickup Location */}
                <div>
                  <label htmlFor="pickupLocation" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
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
                  <label htmlFor="notes" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                    Notes (Optional)
                  </label>
                  <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      aria-label="Special instructions or notes for your lesson"
                      placeholder="Any special requests or information for the instructor"
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold placeholder-slate-500 transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)] resize-none"
                    />
                  </div>
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
                  <label htmlFor="pda-config" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                    PDA Test Package *
                  </label>
                  {isLoadingPda ? (
                    <p className="text-sm font-bold text-sky-400 bg-sky-950/40 border border-sky-900 rounded-xl px-4 py-3 animate-pulse shadow-[0_4px_0_0_#0c4a6e]">
                      🔄 Loading PDA options...
                    </p>
                  ) : pdaConfigs.length === 0 ? (
                    <p className="text-sm font-bold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3 shadow-[0_4px_0_0_#7f1d1d]">
                      ❌ No PDA test configurations available
                    </p>
                  ) : (
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
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
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                      >
                        <option value="" className="bg-slate-950 font-bold text-slate-400">Select a test package</option>
                        {pdaConfigs.map((config: any) => (
                          <option key={config.id} value={config.id} className="bg-slate-950 font-bold text-white">
                            {config.name} - ${config.price} ({formatDurationMinutes(config.durationMinutes)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                              {/* Config Info Header - Show when config selected */}
                {selectedPdaConfig && getSelectedPdaConfig() && (
                  <div className="bg-slate-950 rounded-xl p-4 border-2 border-blue-500 shadow-[0_4px_0_0_#2563eb] mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-sky-400 font-black uppercase tracking-wider mb-1">Selected Package:</p>
                        <p className="font-extrabold text-white text-base mb-1.5 tracking-tight">{getSelectedPdaConfig().name}</p>
                        <div className="flex items-center gap-3 text-sm font-bold">
                          <span className="bg-blue-900 text-blue-100 border border-blue-700 px-2 py-0.5 rounded font-black">${getSelectedPdaConfig().price}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-300">{formatDurationMinutes(getSelectedPdaConfig().durationMinutes)}</span>
                        </div>
                        {getConfigIncludes().pickup && (
                          <p className="text-xs font-black text-emerald-400 uppercase tracking-wide mt-2.5 flex items-center gap-1">
                            <span>✓</span> Includes Pickup
                          </p>
                        )}
                      </div>
                      
                      {/* Upgraded from plain link text to a clear high-contrast solid 3D action pill button */}
                      <button
                        onClick={() => {
                          setSelectedPdaConfig('');
                          setPdaTestCentres([]);
                          setSelectedTestCentre('');
                        }}
                        className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border-2 border-slate-600 bg-slate-900 text-slate-200 hover:text-white hover:border-slate-400 shadow-[0_3px_0_0_#334155] transition-all duration-100 active:translate-y-[3px] active:shadow-none whitespace-nowrap text-center shrink-0"
                      >
                        Change Package
                      </button>
                    </div>
                  </div>
                )}

                              {/* Test Centre Selection */}
                {selectedPdaConfig && pdaTestCentres.length > 1 && (
                  <div>
                    <label htmlFor="test-centre" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                      Test Centre *
                    </label>
                    {pdaTestCentres.length === 0 ? (
                      <p className="text-sm font-bold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3 shadow-[0_4px_0_0_#7f1d1d]">
                        ❌ No test centres available for this configuration
                      </p>
                    ) : (
                      <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                        <select
                          id="test-centre"
                          value={selectedTestCentre}
                          onChange={(e) => setSelectedTestCentre(e.target.value)}
                          aria-label="Select test centre"
                          aria-required="true"
                          aria-invalid={!selectedTestCentre}
                          className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                        >
                          <option value="" className="bg-slate-950 font-bold text-slate-400">Select a test centre</option>
                          {pdaTestCentres.map((centre: any) => (
                            <option key={centre.id} value={centre.id} className="bg-slate-950 font-bold text-white">
                              {centre.name} — {centre.address}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}


                              {/* Test Date Selection */}
                {selectedPdaConfig && selectedTestCentre && (
                  <div>
                    <label htmlFor="test-date" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                      Select Date *
                    </label>
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
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
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)] [color-scheme:dark]"
                      />
                    </div>
                  </div>
                )}


                              {/* Duration Display (Read-only) */}
                {selectedPdaConfig && (
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                      Duration
                    </label>
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                      <div className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 rounded-xl text-slate-200 font-extrabold text-sm tracking-wide">
                        {formatDurationMinutes(getSelectedPdaConfig()?.durationMinutes || 0)}
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-400 mt-2">Fixed duration based on your selected package</p>
                  </div>
                )}

                             {/* Test Time Selection */}
                {selectedPdaConfig && selectedTestDate && (
                  <div>
                    <label htmlFor="test-time" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                      Select Time *
                    </label>
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                      <select
                        id="test-time"
                        value={selectedTestTime}
                        onChange={(e) => setSelectedTestTime(e.target.value)}
                        aria-label="Select test time"
                        aria-required="true"
                        aria-invalid={!selectedTestTime}
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                      >
                        <option value="" className="bg-slate-950 font-bold text-slate-400">Select a time</option>
                        {Array.from({ length: 17 * 2 - 18 }, (_, i) => {
                          const totalMins = (9 * 60) + (i * 30);
                          const h = Math.floor(totalMins / 60);
                          const m = totalMins % 60;
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        }).map((time: string) => (
                          <option key={time} value={time} className="bg-slate-950 font-bold text-white">
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                               {/* Pickup Location - Conditional based on config */}
                {selectedPdaConfig && selectedTestTime && (
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-2 uppercase tracking-wider">
                      Pickup & Location {getConfigIncludes().pickup ? '' : '*'}
                    </label>

                    {getConfigIncludes().pickup ? (
                      <>
                        {/* Has Pickup */}
                        <div className="space-y-3">
                          {/* Radio Item 1 */}
                          <div className={`p-3.5 rounded-xl border-2 transition-all duration-100 flex items-center gap-3 bg-slate-950 ${
                            pickupOption === 'pickup' 
                              ? 'border-white shadow-[0_3px_0_0_#0284c7]' 
                              : 'border-slate-800 shadow-[0_3px_0_0_#1e293b]'
                          }`}>
                            <input
                              type="radio"
                              id="pickup-yes"
                              name="pickup"
                              value="pickup"
                              checked={pickupOption === 'pickup'}
                              onChange={(e) => setPickupOption(e.target.value as 'pickup' | 'centre' | 'none')}
                              className="w-4 h-4 text-sky-500 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0"
                            />
                            <label htmlFor="pickup-yes" className="text-sm font-bold text-white cursor-pointer select-none">
                              Pick me up at my address
                            </label>
                          </div>
                          
                          {pickupOption === 'pickup' && (
                            <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                              <input
                                type="text"
                                value={pdaPickupLocation}
                                onChange={(e) => setPdaPickupLocation(e.target.value)}
                                placeholder="Enter your pickup address"
                                className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold placeholder-slate-500 transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
                              />
                            </div>
                          )}

                          {/* Radio Item 2 */}
                          <div className={`p-3.5 rounded-xl border-2 transition-all duration-100 flex items-center gap-3 bg-slate-950 ${
                            pickupOption === 'centre' 
                              ? 'border-white shadow-[0_3px_0_0_#0284c7]' 
                              : 'border-slate-800 shadow-[0_3px_0_0_#1e293b]'
                          }`}>
                            <input
                              type="radio"
                              id="pickup-no"
                              name="pickup"
                              value="centre"
                              checked={pickupOption === 'centre'}
                              onChange={(e) => setPickupOption(e.target.value as 'pickup' | 'centre' | 'none')}
                              className="w-4 h-4 text-sky-500 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0"
                            />
                            <label htmlFor="pickup-no" className="text-sm font-bold text-white cursor-pointer select-none">
                              Meet me at test centre
                            </label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* No Pickup - Meet at centre only (Opaque Solid Card) */}
                        <div className="px-4 py-4 bg-slate-950 border-2 border-slate-700 rounded-xl shadow-[0_4px_0_0_#1e293b]">
                          <p className="text-sm font-black text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400 block" /> Meet at test centre
                          </p>
                          {pdaTestCentres.find(c => c.id === selectedTestCentre) && (
                            <p className="text-sm font-extrabold text-sky-400 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 flex items-center gap-2">
                              📍 {pdaTestCentres.find(c => c.id === selectedTestCentre)?.name}
                            </p>
                          )}
                          <p className="text-xs font-semibold text-slate-400 mt-2.5">This package does not include pickup service</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                             {/* Notes - Optional */}
                {selectedPdaConfig && selectedTestTime && (
                  <div>
                    <label htmlFor="pda-notes" className="block text-xs font-black text-slate-300 mb-1.5 uppercase tracking-wider">
                      Notes (Optional)
                    </label>
                    <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
                      <textarea
                        id="pda-notes"
                        value={pdaNotes}
                        onChange={(e) => setPdaNotes(e.target.value)}
                        placeholder="Any special requests or information for the test coordinator"
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold placeholder-slate-500 transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)] resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Inline PDA error (replaces alert()) */}
                {pdaError && <FieldError message={pdaError} />}

                {/* Add PDA Test Button - High Contrast 3D Action Tile */}
                <button
                  onClick={handleAddPdaTest}
                  disabled={!selectedPdaConfig || !selectedTestCentre || !selectedTestDate || !selectedTestTime}
                  className={`w-full px-6 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-center transition-all duration-100 border-2 select-none mb-32 lg:mb-0 ${
                    !selectedPdaConfig || !selectedTestCentre || !selectedTestDate || !selectedTestTime
                      ? 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed shadow-[0_4px_0_0_#0f172a]'
                      : 'border-white bg-blue-600 text-white shadow-[0_5px_0_0_#1d4ed8,0_15px_25px_0_rgba(37,99,235,0.4)] hover:bg-blue-500 hover:translate-y-[-2px] hover:shadow-[0_7px_0_0_#1d4ed8,0_20px_30px_0_rgba(37,99,235,0.5)] active:translate-y-[5px] active:shadow-none'
                  }`}
                >
                  + Add This PDA Test
                </button>
              </>
            )}

                    {/* PDA Test Option - Info (for Lessons Tab) - Solid 3D Information Panel */}
            {activeTab === 'lessons' && showPdaPackage && (
              <div className="bg-slate-950 border-2 border-blue-500 rounded-xl p-4 shadow-[0_4px_0_0_#2563eb] mb-2">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm font-bold text-slate-100">
                    <p className="text-base font-black text-white uppercase tracking-wide mb-1">PDA Test Included</p>
                    <p className="text-slate-300">Use the "Schedule PDA Test" tab to schedule your test on a specific date and centre</p>
                  </div>
                </div>
              </div>
            )}
            
                        {/* Add Lesson Button - High Contrast 3D Action Tile */}

            {activeTab === 'lessons' && remainingHours > 0 && (
              <button
                onClick={handleAddBooking}
                disabled={isSubmitting}
                className={`w-full px-6 py-3.5 rounded-xl border-2 font-black text-sm uppercase tracking-wider text-center transition-all duration-100 mb-32 lg:mb-0 select-none ${
                  isSubmitting
                    ? 'border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed shadow-[0_4px_0_0_#0f172a]'
                    : 'bg-emerald-600 text-white border-white shadow-[0_5px_0_0_#047857,0_15px_25px_0_rgba(16,185,129,0.4)] hover:bg-emerald-500 hover:translate-y-[-2px] hover:shadow-[0_7px_0_0_#047857,0_20px_30px_0_rgba(16,185,129,0.5)] active:translate-y-[5px] active:shadow-none'
                }`}
              >
                {isSubmitting ? '⏳ Reserving...' : '+ Add This Lesson'}
              </button>
            )}

            {/* No remaining hours message - Solid High Visibility Frame */}
            {activeTab === 'lessons' && remainingHours === 0 && (
              <div className="bg-slate-950 rounded-xl p-4 border-2 border-emerald-500 text-center shadow-[0_4px_0_0_#064e3b]">
                <p className="text-emerald-400 font-black text-base uppercase tracking-wide">✓ All lesson hours scheduled</p>
                <p className="text-slate-300 font-bold text-sm mt-1.5">
                  {showPdaPackage ? 'Switch to the PDA Test tab to schedule your test.' : 'You can schedule more hours from your dashboard.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box - Solid 3D Tips Layout Block */}
      <div className="bg-slate-900 rounded-xl p-4 sm:p-5 border-2 border-slate-700 shadow-[0_6px_0_0_#1e293b,0_20px_30px_0_rgba(0,0,0,0.5)]">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm font-bold text-slate-200 w-full">
            <p className="text-base font-black text-white uppercase tracking-wide mb-2">Scheduling Tips</p>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span className="text-sky-400 font-black shrink-0 mt-0.5">•</span>
                <span>You can schedule all hours now or leave some for later</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span className="text-sky-400 font-black shrink-0 mt-0.5">•</span>
                <span>Remaining hours can be scheduled from your dashboard</span>
              </li>
              {showPdaPackage && (
                <li className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-sky-400 font-black shrink-0 mt-0.5">•</span>
                  <span>You can add your PDA test using the Schedule PDA Test tab</span>
                </li>
              )}
              <li className="flex items-start gap-2 bg-slate-950/40 p-2 rounded-lg border border-amber-900/60 text-amber-300 font-extrabold">
                <span className="text-amber-400 font-black shrink-0 mt-0.5">⚠️</span>
                <span>You must schedule at least one lesson{showPdaPackage ? ' or a PDA test' : ''} to continue</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Pickup Location Input with suburb autocomplete + service-area validation ──
//
// Two-step UX:
//   1. Suburb/postcode autocomplete (backed by au-locations static data, no API)
//      → populates "Balga WA 6061" as the suburb portion
//   2. Street address free-text field (house number + street name)
//      → combined result sent to parent: "42 Smith St, Balga WA 6061"
//
// Service-area check runs on the combined address (debounced, non-blocking).

type ServiceAreaResult = 'in' | 'out' | 'unknown' | 'checking' | 'idle';

interface SuburbEntry {
  suburb:    string;
  state:     string;
  postcode:  string;
  lat:       number;
  lng:       number;
  searchKey: string;
}

// Lazily built search index from static data
let _pickupIndex: SuburbEntry[] | null = null;
function getPickupIndex(): SuburbEntry[] {
  if (_pickupIndex) return _pickupIndex;
  const entries: SuburbEntry[] = [];
  for (const st of AU_STATES) {
    for (const sub of st.suburbs) {
      entries.push({
        suburb:    sub.displayName,
        state:     st.code,
        postcode:  sub.postcode,
        lat:       sub.lat,
        lng:       sub.lng,
        searchKey: `${sub.displayName.toLowerCase()} ${sub.postcode} ${st.code.toLowerCase()}`,
      });
    }
  }
  _pickupIndex = entries;
  return entries;
}

function searchSuburbs(query: string, limit = 8): SuburbEntry[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const index = getPickupIndex();
  if (/^\d+$/.test(q)) return index.filter(e => e.postcode.startsWith(q)).slice(0, limit);
  const prefix   = index.filter(e =>  e.suburb.toLowerCase().startsWith(q));
  const contains = index.filter(e => !e.suburb.toLowerCase().startsWith(q) && e.suburb.toLowerCase().includes(q));
  return [...prefix, ...contains].slice(0, limit);
}

interface PickupLocationInputProps {
  value: string;
  onChange: (v: string) => void;
  instructorId: string;
}

function PickupLocationInput({ value, onChange, instructorId }: PickupLocationInputProps) {
  // ── suburb autocomplete state ──
  const [suburbQuery, setSuburbQuery]   = React.useState('');
  const [suburbPicked, setSuburbPicked] = React.useState(''); // "Balga WA 6061"
  const [suggestions, setSuggestions]   = React.useState<SuburbEntry[]>([]);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // ── street address state ──
  const [streetAddress, setStreetAddress] = React.useState('');

  // ── service-area check state ──
  const [checkResult, setCheckResult] = React.useState<ServiceAreaResult>('idle');
  const [distanceKm, setDistanceKm]   = React.useState<number | null>(null);
  const [radiusKm, setRadiusKm]       = React.useState<number | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Rebuild combined value and push to parent whenever either part changes
  React.useEffect(() => {
    if (!suburbPicked) { onChange(''); return; }
    const combined = streetAddress.trim()
      ? `${streetAddress.trim()}, ${suburbPicked}`
      : suburbPicked;
    onChange(combined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suburbPicked, streetAddress]);

  // Pre-populate from an existing value (edit flow) — parse suburb back out
  React.useEffect(() => {
    if (value && !suburbPicked) {
      // e.g. "42 Smith St, Balga WA 6061" → street="42 Smith St", suburb="Balga WA 6061"
      const commaIdx = value.lastIndexOf(',');
      if (commaIdx > 0) {
        const possibleSuburb = value.slice(commaIdx + 1).trim();
        const possibleStreet = value.slice(0, commaIdx).trim();
        // Check it looks like "Suburb STATE postcode"
        if (/[A-Z]{2,3}\s+\d{4}$/.test(possibleSuburb)) {
          setSuburbPicked(possibleSuburb);
          setSuburbQuery(possibleSuburb);
          setStreetAddress(possibleStreet);
          return;
        }
      }
      // Fallback: treat entire value as street
      setStreetAddress(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Service-area check (runs on the combined value from parent)
  React.useEffect(() => {
    if (!value || value.trim().length < 8) {
      setCheckResult('idle'); setDistanceKm(null); return;
    }
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
      } catch { setCheckResult('unknown'); }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, instructorId]);

  const handleSuburbInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSuburbQuery(q);
    setSuburbPicked('');          // clear selection when user edits
    onChange('');                  // clear parent value
    setCheckResult('idle');
    if (q.length >= 2) { setSuggestions(searchSuburbs(q)); setDropdownOpen(true); }
    else { setSuggestions([]); setDropdownOpen(false); }
  };

  const handleSuburbSelect = (entry: SuburbEntry) => {
    const label = `${entry.suburb} ${entry.state} ${entry.postcode}`;
    setSuburbQuery(label);
    setSuburbPicked(label);
    setSuggestions([]);
    setDropdownOpen(false);
  };

  const handleClearSuburb = () => {
    setSuburbQuery(''); setSuburbPicked('');
    setStreetAddress(''); onChange('');
    setCheckResult('idle'); setSuggestions([]); setDropdownOpen(false);
  };

  const isComplete = !!suburbPicked && !!streetAddress.trim();

  return (
    <div className="space-y-3">
      {/* ── Step 1: Suburb / Postcode ── */}
      <div ref={containerRef} className="relative">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
          Step 1 — Suburb or Postcode
        </p>
        <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
          <input
            type="text"
            value={suburbQuery}
            onChange={handleSuburbInput}
            onFocus={() => { if (suggestions.length > 0) setDropdownOpen(true); }}
            placeholder="e.g. Balga or 6061"
            autoComplete="off"
            aria-label="Search suburb or postcode"
            className={`w-full pl-4 pr-10 py-3 bg-slate-950 border-2 rounded-xl text-white font-bold placeholder-slate-500 transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)] ${
              suburbPicked ? 'border-emerald-500' : 'border-slate-400'
            }`}
          />
          {/* Status icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
            {suburbPicked
              ? <button type="button" onClick={handleClearSuburb} className="text-slate-500 hover:text-white transition-colors" title="Clear suburb">✕</button>
              : suburbQuery.length >= 2
              ? <span className="text-slate-500">🔍</span>
              : null
            }
          </div>
        </div>

        {/* Dropdown */}
        {dropdownOpen && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-slate-900 border-2 border-slate-700 rounded-xl shadow-[0_8px_0_0_#1e293b,0_20px_30px_0_rgba(0,0,0,0.7)] overflow-hidden">
            {suggestions.map((entry, i) => (
              <button
                key={`${entry.postcode}-${entry.suburb}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSuburbSelect(entry); }}
                className="w-full text-left px-4 py-2.5 hover:bg-sky-600 transition-colors flex items-center justify-between gap-3 border-b border-slate-800 last:border-0"
              >
                <span className="font-bold text-white text-sm">{entry.suburb}</span>
                <span className="text-xs font-black text-slate-400 shrink-0">
                  {entry.state} {entry.postcode}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* "No results" hint */}
        {dropdownOpen && suburbQuery.length >= 2 && suggestions.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-400 font-medium">
            No suburbs found — try a different spelling or postcode
          </div>
        )}
      </div>

      {/* ── Step 2: Street address (shown once suburb is picked) ── */}
      {suburbPicked && (
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Step 2 — Street Address
          </p>
          <div className="relative shadow-[0_4px_0_0_#1e293b] rounded-xl bg-slate-950">
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="e.g. 42 Smith Street"
              aria-label="Street address"
              autoComplete="street-address"
              className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-400 rounded-xl text-white font-bold placeholder-slate-500 transition-all duration-100 hover:border-white focus:outline-none focus:border-sky-400 focus:shadow-[0_4px_0_0_#0284c7,0_10px_20px_0_rgba(56,189,248,0.3)]"
            />
            {/* Service area spinner / tick */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkResult === 'checking' && (
                <svg className="w-4 h-4 text-sky-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {checkResult === 'in' && <span className="text-emerald-400 font-black text-sm">✓</span>}
            </div>
          </div>

          {/* Preview of full combined address */}
          {isComplete && (
            <p className="mt-2 text-xs font-bold text-sky-300 bg-sky-950/40 border border-sky-900 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-sky-500">📍</span>
              {streetAddress.trim()}, {suburbPicked}
            </p>
          )}
        </div>
      )}

      {/* Service-area feedback */}
      {checkResult === 'out' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/50 border-2 border-amber-800 text-amber-200 text-xs font-bold shadow-[0_3px_0_0_#451a03]">
          <span className="shrink-0">⚠️</span>
          <span>
            This address is{distanceKm != null ? ` ~${distanceKm} km` : ''} from the instructor's base
            {radiusKm != null ? `, outside their ${radiusKm} km service area` : ''}.
            You can still book — confirm with your instructor that they cover this location.
          </span>
        </div>
      )}
      {checkResult === 'unknown' && value.trim().length >= 5 && (
        <p className="text-xs font-semibold text-slate-500 px-1">
          Service area check unavailable — please confirm your address with the instructor.
        </p>
      )}
    </div>
  );
}
