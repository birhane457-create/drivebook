'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookingProvider, useBooking } from '@/lib/contexts/BookingContext';

interface InstructorData {
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
  allowedDurations: number[];
}

function InstructorLoaderContent({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const instructorId = params.instructorId as string;
  const { bookingState, setInstructor } = useBooking();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instructorId) return;

    // If instructor is already loaded in context and matches this ID, we're good
    if (bookingState.instructor?.id === instructorId) {
      setLoading(false);
      return;
    }

    // Need to fetch instructor from API
    const fetchInstructor = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/instructors/${instructorId}`);
        if (!res.ok) throw new Error('Failed to fetch instructor');

        const data: InstructorData = await res.json();
        
        setInstructor({
          id: data.id,
          name: data.name,
          profileImage: data.profileImage,
          hourlyRate: data.hourlyRate,
          averageRating: data.averageRating,
          totalReviews: data.totalReviews,
          offersTestPackage: data.offersTestPackage,
          testPackagePrice: data.testPackagePrice,
          testPackageDuration: data.testPackageDuration,
          testPackageIncludes: data.testPackageIncludes || [],
          allowedDurations: data.allowedDurations || [60],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchInstructor();
  }, [instructorId, bookingState.instructor?.id, setInstructor]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-900 mb-2">Error</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <InstructorLoaderContent>
        {children}
      </InstructorLoaderContent>
    </BookingProvider>
  );
}
