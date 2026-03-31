'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  ShoppingCart,
  X as XIcon,
  Home,
  Calendar as CalendarIcon,
  ArrowLeft,
  Check,
  Star,
  Phone,
  Mail,
} from 'lucide-react';

interface Instructor {
  id: string;
  name: string;
  profileImage?: string;
  bio?: string;
  phone?: string;
  hourlyRate: number;
  averageRating: number;
  totalReviews: number;
  distance: number;
  baseAddress: string;
  serviceRadiusKm: number;
  allowedDurations?: number[]; // minutes
}

interface Service {
  duration: number;
  price: number;
}

interface CartItem {
  id: string;
  instructorId: string;
  instructorName: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  pickupLocation: string;
  service: string;
}

type Step = 'location' | 'instructors' | 'services' | 'details' | 'payment';

export default function BookLessonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('location');
  
  // Booking data
  const [userLocation, setUserLocation] = useState('');
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // UI State
  const [searchLoading, setSearchLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceAreaWarning, setServiceAreaWarning] = useState<{
    show: boolean;
    message: string;
    options: { label: string; action: string }[];
  } | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [clientLocation, setClientLocation] = useState('');
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  // Check auth
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch availability when date or service changes
  useEffect(() => {
    if (selectedDate && selectedService && selectedInstructor) {
      checkAvailability();
    }
  }, [selectedDate, selectedService?.duration]);

  // Load client data on mount
  useEffect(() => {
    if (session?.user?.email) {
      loadClientData();
    }
  }, [session]);

  // Check for pre-selected instructor or new instructor search
  useEffect(() => {
    const instructorId = searchParams?.get('instructorId');
    const newInstructor = searchParams?.get('newInstructor');
    
    if (newInstructor === 'true') {
      // User wants to search for new instructor, start from location with pre-filled address
      if (clientLocation) {
        setUserLocation(clientLocation);
        setPickupLocation(clientLocation);
      }
      setStep('location');
    } else if (instructorId && session?.user?.email) {
      loadPreSelectedInstructor(instructorId);
    } else if (!instructorId && !newInstructor && clientLocation) {
      // No params — auto-detect current instructor and skip to services
      autoLoadCurrentInstructor();
    }
  }, [searchParams, session, clientLocation]);

  const loadPreSelectedInstructor = async (instructorId: string) => {
    try {
      const res = await fetch(`/api/instructors/${instructorId}`);
      if (res.ok) {
        const instructor = await res.json();
        setSelectedInstructor(instructor);
        // If user has location, skip directly to services
        if (clientLocation) {
          setUserLocation(clientLocation);
          setPickupLocation(clientLocation);
        }
        setStep('services');
      }
    } catch (error) {
      console.error('Failed to load instructor:', error);
    }
  };

  const autoLoadCurrentInstructor = async () => {
    try {
      const res = await fetch('/api/client/current-instructor');
      if (res.ok) {
        const data = await res.json();
        if (data.currentInstructor) {
          loadPreSelectedInstructor(data.currentInstructor.id);
        }
        // If no current instructor, stay on step 1 (location)
      }
    } catch (error) {
      console.error('Failed to auto-load current instructor:', error);
    }
  };

  const loadClientData = async () => {
    try {
      // Add cache-busting timestamp to prevent stale data
      const timestamp = Date.now();
      const [profileRes, walletRes] = await Promise.all([
        fetch(`/api/client/profile?t=${timestamp}`),
        fetch(`/api/client/wallet?t=${timestamp}`)
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setClientLocation(profile.address || '');
        setPickupLocation(profile.address || '');
        setUserLocation(profile.address || '');
      }

      if (walletRes.ok) {
        const wallet = await walletRes.json();
        setWalletBalance(wallet.creditsRemaining || 0);
        setWalletTransactions(wallet.transactions || []);
      }
    } catch (error) {
      console.error('Failed to load client data:', error);
    }
  };

  const searchInstructors = async () => {
    if (!userLocation.trim()) {
      setError('Please enter a location');
      return;
    }

    try {
      setSearchLoading(true);
      setError(null);
      const res = await fetch(`/api/instructors/search?location=${encodeURIComponent(userLocation)}`);
      
      if (!res.ok) {
        throw new Error('Location not found');
      }

      const data = await res.json();
      setInstructors(data.instructors || []);
      
      if (data.instructors.length === 0) {
        setError('No instructors available in this area');
      } else {
        setStep('instructors');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const selectInstructor = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setPickupLocation(clientLocation);
    setShowFullProfile(false);
    setStep('services');
  };

  const switchInstructor = () => {
    // If we have instructors list, go to instructors step
    // Otherwise, go to location step to search
    if (instructors.length > 0) {
      setStep('instructors');
    } else {
      setStep('location');
    }
    setSelectedInstructor(null);
  };

  const selectService = (duration: number) => {
    const price = selectedInstructor!.hourlyRate * duration;
    setSelectedService({ duration, price });
    setStep('details');
  };

  const checkAvailability = async () => {
    if (!selectedDate || !selectedInstructor || !selectedService) return;

    try {
      setAvailabilityLoading(true);
      setError(null);
      const durationMins = selectedService.duration * 60;
      const res = await fetch(
        `/api/availability/slots?instructorId=${selectedInstructor.id}&date=${selectedDate}&duration=${durationMins}`
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots?.map((s: any) => s.time || s) || []);
        if ((data.slots || []).length === 0) {
          setError('No times available for this date');
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to load availability');
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Availability check error:', error);
      setError('Failed to load availability. Please try again.');
      setAvailableSlots([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const validatePickupLocation = async (): Promise<boolean> => {
    if (!pickupLocation.trim()) {
      setError('Please enter a pickup location');
      return false;
    }

    if (!selectedInstructor) return true;

    try {
      const res = await fetch(
        `/api/public/check-service-area?instructorId=${encodeURIComponent(selectedInstructor.id)}&address=${encodeURIComponent(pickupLocation)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.result === 'out') {
          setServiceAreaWarning({
            show: true,
            message: `${selectedInstructor.name} operates within a ${data.radiusKm ?? selectedInstructor.serviceRadiusKm}km service radius. Your address is ${data.distanceKm}km away.`,
            options: [
              { label: 'Search for instructors in this area', action: 'search' },
              { label: "Use instructor's base address instead", action: 'useDefault' },
              { label: 'Proceed anyway', action: 'proceed' },
            ],
          });
          return false;
        }
      }
    } catch {
      // If check fails, allow through — don't block booking
    }

    return true;
  };

  const addToCart = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !selectedInstructor) {
      setError('Please fill in all fields');
      return;
    }

    if (!await validatePickupLocation()) {
      return;
    }

    // Check for duplicate booking in cart
    const duplicate = cart.find(item => 
      item.instructorId === selectedInstructor.id &&
      item.date === selectedDate &&
      item.time === selectedTime
    );

    if (duplicate) {
      setError(`You already have a booking with ${selectedInstructor.name} on ${selectedDate} at ${selectedTime} in your cart`);
      return;
    }

    // Check credits
    if (walletBalance < selectedService.price) {
      setError(
        `Insufficient credits. You need $${selectedService.price.toFixed(2)} but only have $${walletBalance.toFixed(2)}`
      );
      return;
    }

    const cartItem: CartItem = {
      id: Math.random().toString(36),
      instructorId: selectedInstructor.id,
      instructorName: selectedInstructor.name,
      date: selectedDate,
      time: selectedTime,
      duration: selectedService.duration,
      price: selectedService.price,
      pickupLocation,
      service: `${selectedService.duration}h Lesson`
    };

    setCart([...cart, cartItem]);
    setError(null);
    
    // Refresh wallet balance to ensure it's current
    await loadClientData();
    
    // Reset form for next booking but keep instructor selected for quick multi-booking
    setSelectedService(null);
    setSelectedDate('');
    setSelectedTime('');
    setPickupLocation(clientLocation);
    setStep('services');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const proceedToPayment = () => {
    if (cart.length === 0) {
      setError('Add at least one lesson to cart');
      return;
    }

    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);
    if (walletBalance < totalPrice) {
      setError(`Need additional $${(totalPrice - walletBalance).toFixed(2)}`);
      return;
    }

    setStep('payment');
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const remainingBalance = walletBalance - cartTotal;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Service Area Warning Dialog */}
        {serviceAreaWarning?.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 mb-8">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Service Area Warning
              </h3>
              <p className="text-gray-600 mb-6">{serviceAreaWarning.message}</p>
              <div className="space-y-3">
                {serviceAreaWarning.options.map((option) => (
                  <button
                    key={option.action}
                    onClick={() => {
                      if (option.action === 'search') {
                        setServiceAreaWarning(null);
                        setStep('location');
                      } else if (option.action === 'useDefault') {
                        setPickupLocation(selectedInstructor?.baseAddress || clientLocation);
                        setServiceAreaWarning(null);
                      } else if (option.action === 'proceed') {
                        setServiceAreaWarning(null);
                      }
                    }}
                    className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/client-dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Book a Lesson</h1>
          <p className="text-gray-600 mt-2">
            {step === 'location' ? 'Step 1 of 5' :
             step === 'instructors' ? 'Step 2 of 5' :
             step === 'services' ? (instructors.length > 0 ? 'Step 3 of 5' : 'Step 1 of 3') :
             step === 'details' ? (instructors.length > 0 ? 'Step 4 of 5' : 'Step 2 of 3') :
             (instructors.length > 0 ? 'Step 5 of 5' : 'Step 3 of 3')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Location Search */}
            {step === 'location' && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
                <h2 className="text-2xl font-bold mb-6">Find Instructors Near You</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="inline w-4 h-4 mr-2" />
                      Location or Suburb
                    </label>
                    <input
                      type="text"
                      value={userLocation}
                      onChange={(e) => setUserLocation(e.target.value)}
                      placeholder="e.g., Maylands WA, 6051"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && searchInstructors()}
                    />
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={searchInstructors}
                    disabled={searchLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {searchLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      'Search Instructors'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Instructor Selection */}
            {step === 'instructors' && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setStep('location')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Select an Instructor</h2>
                </div>
                <div className="space-y-3">
                  {instructors.map((instructor) => (
                    <button
                      key={instructor.id}
                      onClick={() => selectInstructor(instructor)}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        {/* Profile image */}
                        {instructor.profileImage ? (
                          <img
                            src={instructor.profileImage}
                            alt={instructor.name}
                            className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-gray-100"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border-2 border-gray-100">
                            <span className="text-xl font-bold text-blue-600">
                              {instructor.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900">{instructor.name}</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {(instructor.distance || 0).toFixed(1)}km away
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              ⭐ {(instructor.averageRating || 0).toFixed(1)}
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              ${(instructor.hourlyRate || 0).toFixed(2)}/hr
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Service Selection */}
            {step === 'services' && selectedInstructor && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (instructors.length > 0) {
                          setStep('instructors');
                          setSelectedInstructor(null);
                        } else {
                          router.push('/client-dashboard');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold">{selectedInstructor.name}</h2>
                  </div>
                  <button
                    onClick={switchInstructor}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold transition"
                  >
                    Switch Instructor
                  </button>
                </div>
                <p className="text-gray-600 mb-6">Select lesson duration</p>

                <div className="space-y-3 mb-6">
                  {(selectedInstructor.allowedDurations?.length
                    ? selectedInstructor.allowedDurations.map(m => m / 60)
                    : [1, 2, 3]
                  ).map((hours) => {
                    const price = selectedInstructor.hourlyRate * hours;
                    return (
                      <button
                        key={hours}
                        onClick={() => selectService(hours)}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-gray-900">{hours} Hour{hours !== 1 ? 's' : ''} Lesson</h3>
                            <p className="text-sm text-gray-600">Single lesson session</p>
                          </div>
                          <p className="font-bold text-blue-600">${price.toFixed(2)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Booking Details */}
            {step === 'details' && selectedInstructor && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Instructor Profile Card */}
                <div className="border-b pb-6">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedInstructor.name}</h2>
                    <button
                      onClick={switchInstructor}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold transition"
                    >
                      Switch Instructor
                    </button>
                  </div>
                  <div className="flex items-start gap-4">
                    {selectedInstructor.profileImage && (
                      <img 
                        src={selectedInstructor.profileImage} 
                        alt={selectedInstructor.name}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm text-gray-700">
                          {(selectedInstructor.averageRating || 0).toFixed(1)} ({selectedInstructor.totalReviews || 0} reviews)
                        </span>
                      </div>
                      
                      {/* Service Info - Always Visible */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-900 font-semibold">${(selectedInstructor.hourlyRate || 0).toFixed(2)}/hour</p>
                        <p className="text-xs text-blue-800 mt-1">Service radius: {selectedInstructor.serviceRadiusKm || 5}km</p>
                      </div>

                      {/* View Bio Button */}
                      <button
                        onClick={() => setShowFullProfile(!showFullProfile)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-semibold underline"
                      >
                        {showFullProfile ? '− Hide Details' : '+ View Bio'}
                      </button>

                      {/* Bio / Contact Info - Hidden by Default */}
                      {showFullProfile && (
                        <div className="mt-4 space-y-3 pt-3 border-t">
                          {/* Bio */}
                          <p className="text-gray-600 text-sm">{selectedInstructor.bio || 'Experienced instructor'}</p>
                          
                          {/* Contact Info */}
                          <div className="space-y-2 text-sm">
                            <p className="flex items-center gap-2 text-gray-700">
                              <Phone className="w-4 h-4" /> {selectedInstructor.phone || 'Phone available'}
                            </p>
                            <p className="flex items-center gap-2 text-gray-700">
                              <MapPin className="w-4 h-4" /> {selectedInstructor.baseAddress}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Selection (if not yet selected) */}
                {!selectedService && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Select Lesson Duration</label>
                    <div className="space-y-2">
                      {(selectedInstructor.allowedDurations?.length
                        ? selectedInstructor.allowedDurations.map(m => m / 60)
                        : [1, 2, 3]
                      ).map((hours) => {
                        const price = selectedInstructor.hourlyRate * hours;
                        return (
                          <button
                            key={hours}
                            onClick={() => selectService(hours)}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left flex items-center justify-between"
                          >
                            <span className="font-semibold">{hours}h Lesson</span>
                            <span className="text-blue-600 font-bold">${price.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Booking Details Form */}
                {selectedService && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Selected Duration: <span className="text-blue-600">{selectedService.duration}h - ${selectedService.price.toFixed(2)}</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Booking Details Form (when service selected) */}
            {step === 'details' && selectedInstructor && selectedService && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSelectedService(null)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Booking Details</h2>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CalendarIcon className="inline w-4 h-4 mr-2" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime('');
                      setAvailableSlots([]);
                      // checkAvailability runs via useEffect when selectedDate changes
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="inline w-4 h-4 mr-2" />
                    Time
                  </label>
                  {availabilityLoading ? (
                    <div className="w-full px-4 py-3 border border-gray-300 rounded-lg flex items-center gap-2 text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading available times...
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <select
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select a time slot</option>
                      {availableSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  ) : selectedDate ? (
                    <p className="text-gray-600">No times available for this date</p>
                  ) : (
                    <p className="text-gray-600">Select a date to see available times</p>
                  )}
                </div>

                {/* Pickup Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Home className="inline w-4 h-4 mr-2" />
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Enter your pickup address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Instructor serves within {selectedInstructor.serviceRadiusKm}km radius
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('services')}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={addToCart}
                    disabled={!selectedDate || !selectedTime || !pickupLocation}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </button>
                </div>
              </div>
            )}

            {/* Payment */}
            {step === 'payment' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6">Payment Confirmation</h2>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="font-semibold text-gray-900">{item.instructorName}</div>
                      <div className="text-sm text-gray-600">
                        {item.date} at {item.time} • {item.service}
                      </div>
                      <div className="text-right font-bold text-blue-600">${item.price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  onClick={async () => {
                    try {
                      setPaymentLoading(true);
                      setError(null);

                      console.log('Submitting cart with items:', cart.length);
                      const res = await fetch('/api/client/bookings/create-bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cart }),
                      });

                      const data = await res.json();
                      console.log('Booking API response:', data);

                      if (!res.ok) {
                        throw new Error(data.error || 'Booking failed');
                      }

                      console.log('Booking successful, remaining balance:', data.remainingBalance);
                      
                      // Success - update wallet balance immediately from response
                      if (data.remainingBalance !== undefined) {
                        setWalletBalance(data.remainingBalance);
                      }
                      
                      // Clear cart
                      setCart([]);
                      
                      // Also refresh from API to be sure - with longer wait
                      console.log('Refreshing wallet data...');
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      await loadClientData();
                      
                      // Small delay to ensure state updates
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      console.log('Final wallet balance before redirect:', walletBalance);
                      
                      // Now redirect with message
                      router.push('/client-dashboard?bookingSuccess=true');
                    } catch (err) {
                      console.error('Booking error:', err);
                      setError(err instanceof Error ? err.message : 'Booking failed');
                    } finally {
                      setPaymentLoading(false);
                    }
                  }}
                  disabled={paymentLoading}
                  className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm & Book
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Your Cart
              </h3>

              {cart.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No lessons added yet</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="text-sm flex-1">
                            <p className="font-semibold text-gray-900">{item.instructorName}</p>
                            <p className="text-xs text-gray-600">{item.duration}h •${item.price.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{item.date} @ {item.time}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Available:</span>
                      <span className={walletBalance < cartTotal ? 'text-red-600 font-semibold' : 'font-semibold'}>
                        ${walletBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">After:</span>
                      <span className={remainingBalance < 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>
                        ${Math.max(0, remainingBalance).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Transaction History - Collapsible */}
                  {walletTransactions.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <button
                        onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                        className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                      >
                        <span>Transaction History ({walletTransactions.length})</span>
                        <span>{showTransactionHistory ? '−' : '+'}</span>
                      </button>
                      
                      {showTransactionHistory && (
                        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                          {walletTransactions.map((tx, idx) => (
                            <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700 font-medium capitalize">
                                  {tx.type === 'PAYMENT' ? '💳 Payment' : tx.type === 'REFUND' ? '↩️ Refund' : tx.type === 'ADJUSTMENT' ? '⚙️ Adjustment' : '📝 ' + tx.type}
                                </span>
                                <span className={tx.amount > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                  {tx.amount > 0 ? '+' : ''} ${(tx.amount / 100).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-gray-500 mt-1">
                                {tx.description || 'N/A'}
                              </p>
                              <p className="text-gray-400 mt-1">
                                {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {walletBalance < cartTotal && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-700">
                        Need ${(cartTotal - walletBalance).toFixed(2)} more
                      </p>
                      <Link
                        href="/client-dashboard?addCredits=true"
                        className="inline-flex items-center gap-1 mt-2 text-yellow-700 hover:text-yellow-800 font-semibold text-sm"
                      >
                        Add Credits →
                      </Link>
                    </div>
                  )}

                  {cart.length > 0 && walletBalance >= cartTotal && (
                    <button
                      onClick={proceedToPayment}
                      className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Proceed
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
