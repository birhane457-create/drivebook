'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';

export default function TestPackagePage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!instructor) {
        router.push('/book');
      } else {
        router.push(`/book/${params.instructorId}/schedule`);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [instructor, params.instructorId, router]);

  return <div />;
}
