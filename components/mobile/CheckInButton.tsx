'use client';

import { useState } from 'react';
import { getCurrentLocation, hapticFeedback } from '@/lib/capacitor/native-features';

interface CheckInButtonProps {
  bookingId: string;
  pickupLocation: {
    latitude: number;
    longitude: number;
  };
  onSuccess?: () => void;
}

export default function CheckInButton({ 
  bookingId, 
  pickupLocation,
  onSuccess 
}: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    // Haversine formula to calculate distance in meters
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current location
      const currentLocation = await getCurrentLocation();

      // Calculate distance from pickup location
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude
      );

      // Check if within 100 meters
      const MAX_DISTANCE = 100; // meters
      if (distance > MAX_DISTANCE) {
        setError(`You must be within ${MAX_DISTANCE}m of pickup location. Current distance: ${Math.round(distance)}m`);
        await hapticFeedback('heavy');
        setLoading(false);
        return;
      }

      // Submit check-in to backend
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          distance: Math.round(distance),
        }),
      });

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      // Success feedback
      await hapticFeedback('medium');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to check in');
      await hapticFeedback('heavy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="check-in-container">
      <button
        onClick={handleCheckIn}
        disabled={loading}
        className="check-in-button"
      >
        {loading ? 'Checking In...' : 'Check In'}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}
