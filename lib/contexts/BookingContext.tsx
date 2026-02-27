'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { calculatePackagePrice, PackageType, HOUR_PACKAGES } from '@/lib/config/packages';

interface SlotReservation {
  key: string;
  expiresAt: number;
  instructorId: string;
  date: string;
  time: string;
  duration: number;
}

interface Instructor {
  id: string;
  name: string;
  profileImage: string | null;
  hourlyRate: number;
  averageRating: number | null;
  totalReviews: number;
  offersTestPackage: boolean;
  testPackagePrice: number | null;
  testPackageDuration: number | null;
  testPackageIncludes: string[];
}

interface PricingBreakdown {
  subtotal: number;
  discount: number;
  discountPercentage: number;
  testPackage: number;
  platformFee: number;
  total: number;
}

interface ScheduledBooking {
  date: string;
  time: string;
  duration: number; // minutes
  pickupLocation: string;
  notes: string;
}

interface BookingState {
  // Step 1: Instructor
  instructor: Instructor | null;
  
  // Step 2: Package
  packageType: PackageType;
  hours: number;
  includeTestPackage: boolean;
  
  // Step 3: Book Now/Later
  bookingType: 'now' | 'later' | null;
  
  // Step 4: Booking Details (if Book Now)
  scheduledBookings: ScheduledBooking[];
  remainingHours: number;
  
  // Step 5: Registration
  registrationType: 'myself' | 'someone-else';
  
  // Account Holder (always required)
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone: string;
  accountHolderPassword: string;
  accountHolderConfirmPassword: string;
  
  // Learner (only if "someone else")
  learnerName: string;
  learnerPhone: string;
  learnerRelationship: string;
  
  // Slot Reservations (for preventing double booking)
  slotReservations: SlotReservation[];
  
  // Recovery information
  sessionId: string;
  savedAt: number;
  
  // Calculated
  pricing: PricingBreakdown;
}

interface BookingContextType {
  bookingState: BookingState;
  updateBooking: (updates: Partial<BookingState>) => void;
  setInstructor: (instructor: Instructor) => void;
  setPackage: (packageType: PackageType, hours: number) => void;
  toggleTestPackage: () => void;
  setClientDetails: (details: Partial<BookingState>) => void;
  addScheduledBooking: (booking: ScheduledBooking) => void;
  removeScheduledBooking: (index: number) => void;
  resetBooking: () => void;
  
  // Slot management
  reserveSlot: (instructorId: string, date: string, time: string, duration: number) => string;
  releaseSlot: (reservationKey: string) => void;
  isSlotReserved: (reservationKey: string) => boolean;
  getSessionId: () => string;
  
  // Storage management
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  clearStorage: () => void;
  hasRecoverableBooking: () => boolean;
}

const defaultPricing: PricingBreakdown = {
  subtotal: 0,
  discount: 0,
  discountPercentage: 0,
  testPackage: 0,
  platformFee: 0,
  total: 0
};

const initialState: BookingState = {
  instructor: null,
  packageType: 'PACKAGE_10',
  hours: 10,
  includeTestPackage: false,
  bookingType: null,
  scheduledBookings: [],
  remainingHours: 0,
  registrationType: 'myself',
  accountHolderName: '',
  accountHolderEmail: '',
  accountHolderPhone: '',
  accountHolderPassword: '',
  accountHolderConfirmPassword: '',
  learnerName: '',
  learnerPhone: '',
  learnerRelationship: '',
  slotReservations: [],
  sessionId: typeof window !== 'undefined' ? localStorage.getItem('bookingSessionId') || generateSessionId() : generateSessionId(),
  savedAt: 0,
  pricing: defaultPricing
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookingState, setBookingState] = useState<BookingState>(initialState);

  // Calculate pricing whenever relevant fields change
  const calculatePricing = useCallback((state: BookingState): PricingBreakdown => {
    if (!state.instructor) {
      return defaultPricing;
    }

    const pricing = calculatePackagePrice(
      state.instructor.hourlyRate,
      state.hours,
      state.packageType,
      false // Don't include default test package
    );

    // If test package is selected and instructor has custom price, use it
    if (state.includeTestPackage && state.instructor.offersTestPackage && state.instructor.testPackagePrice) {
      const customTestPrice = state.instructor.testPackagePrice;
      
      return {
        ...pricing,
        testPackage: customTestPrice,
        total: pricing.total - pricing.testPackage + customTestPrice,
        installments: (pricing.total - pricing.testPackage + customTestPrice) / 4
      };
    }

    // If test package selected but instructor doesn't offer it, don't include it
    if (state.includeTestPackage && !state.instructor.offersTestPackage) {
      return {
        ...pricing,
        testPackage: 0
      };
    }

    return pricing;
  }, []);

  const updateBooking = useCallback((updates: Partial<BookingState>) => {
    setBookingState(prev => {
      const newState = { ...prev, ...updates };
      newState.pricing = calculatePricing(newState);
      return newState;
    });
  }, [calculatePricing]);

  const setInstructor = useCallback((instructor: Instructor) => {
    setBookingState(prev => {
      const newState = { ...prev, instructor };
      newState.pricing = calculatePricing(newState);
      return newState;
    });
  }, [calculatePricing]);

  const setPackage = useCallback((packageType: PackageType, hours: number) => {
    setBookingState(prev => {
      const actualHours = packageType === 'CUSTOM' ? hours : HOUR_PACKAGES[packageType].hours;
      const newState = { 
        ...prev, 
        packageType, 
        hours: actualHours,
        remainingHours: actualHours // Initialize remaining hours when package is set
      };
      newState.pricing = calculatePricing(newState);
      return newState;
    });
  }, [calculatePricing]);

  const toggleTestPackage = useCallback(() => {
    setBookingState(prev => {
      const newState = { ...prev, includeTestPackage: !prev.includeTestPackage };
      newState.pricing = calculatePricing(newState);
      return newState;
    });
  }, [calculatePricing]);

  const setClientDetails = useCallback((details: Partial<BookingState>) => {
    setBookingState(prev => ({ ...prev, ...details }));
  }, []);

  const addScheduledBooking = useCallback((booking: ScheduledBooking) => {
    setBookingState(prev => {
      const newBookings = [...prev.scheduledBookings, booking];
      const bookedHours = newBookings.reduce((sum, b) => sum + (b.duration / 60), 0);
      const remaining = prev.hours - bookedHours;
      
      return {
        ...prev,
        scheduledBookings: newBookings,
        remainingHours: remaining
      };
    });
  }, []);

  const removeScheduledBooking = useCallback((index: number) => {
    setBookingState(prev => {
      const newBookings = prev.scheduledBookings.filter((_, i) => i !== index);
      const bookedHours = newBookings.reduce((sum, b) => sum + (b.duration / 60), 0);
      const remaining = prev.hours - bookedHours;
      
      return {
        ...prev,
        scheduledBookings: newBookings,
        remainingHours: remaining
      };
    });
  }, []);

  const resetBooking = useCallback(() => {
    setBookingState(prev => ({
      ...initialState,
      sessionId: prev.sessionId,
      slotReservations: [] // Clear reservations on reset
    }));
  }, []);

  // Slot Reservation Methods (10-minute timeout)
  const reserveSlot = useCallback((
    instructorId: string,
    date: string,
    time: string,
    duration: number
  ): string => {
    const key = `${instructorId}:${date}:${time}:${duration}`;
    const reservation: SlotReservation = {
      key,
      instructorId,
      date,
      time,
      duration,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    setBookingState(prev => ({
      ...prev,
      slotReservations: [
        ...prev.slotReservations.filter(r => r.expiresAt > Date.now()),
        reservation
      ]
    }));

    return key;
  }, []);

  const releaseSlot = useCallback((reservationKey: string) => {
    setBookingState(prev => ({
      ...prev,
      slotReservations: prev.slotReservations.filter(r => r.key !== reservationKey)
    }));
  }, []);

  const isSlotReserved = useCallback((reservationKey: string): boolean => {
    return bookingState.slotReservations.some(
      r => r.key === reservationKey && r.expiresAt > Date.now()
    );
  }, [bookingState.slotReservations]);

  const getSessionId = useCallback(() => {
    return bookingState.sessionId;
  }, [bookingState.sessionId]);

  // LocalStorage Management
  const saveToLocalStorage = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        const dataToSave = {
          ...bookingState,
          savedAt: Date.now()
        };
        localStorage.setItem('bookingState', JSON.stringify(dataToSave));
        localStorage.setItem('bookingSessionId', bookingState.sessionId);
      }
    } catch (error) {
      console.error('Failed to save booking to localStorage:', error);
    }
  }, [bookingState]);

  const loadFromLocalStorage = useCallback((): boolean => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bookingState');
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // Only restore if this is recent (less than 24 hours old)
          const ageInHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
          if (ageInHours < 24 && parsed.instructor) {
            // Clean up expired slot reservations
            const cleanedReservations = parsed.slotReservations.filter(
              (r: SlotReservation) => r.expiresAt > Date.now()
            );
            
            setBookingState({
              ...parsed,
              slotReservations: cleanedReservations
            });
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load booking from localStorage:', error);
    }
    return false;
  }, []);

  const clearStorage = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bookingState');
      }
    } catch (error) {
      console.error('Failed to clear booking from localStorage:', error);
    }
    resetBooking();
  }, [resetBooking]);

  const hasRecoverableBooking = useCallback((): boolean => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bookingState');
        if (saved) {
          const parsed = JSON.parse(saved);
          const ageInHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
          return ageInHours < 24 && !!parsed.instructor;
        }
      }
    } catch (error) {
      console.error('Failed to check recoverable booking:', error);
    }
    return false;
  }, []);

  // Auto-save to localStorage when booking state changes
  useEffect(() => {
    if (bookingState.instructor) {
      saveToLocalStorage();
    }
  }, [bookingState, saveToLocalStorage]);

  const value: BookingContextType = {
    bookingState,
    updateBooking,
    setInstructor,
    setPackage,
    toggleTestPackage,
    setClientDetails,
    addScheduledBooking,
    removeScheduledBooking,
    resetBooking,
    reserveSlot,
    releaseSlot,
    isSlotReserved,
    getSessionId,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearStorage,
    hasRecoverableBooking
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}

export type { ScheduledBooking, BookingState, PricingBreakdown, SlotReservation };
