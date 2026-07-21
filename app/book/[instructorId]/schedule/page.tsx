'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';

export default function ScheduleRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (params?.instructorId) {
        router.replace(`/book/${params.instructorId}/booking-details`);
      } else {
        router.replace('/book');
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <MultiStepBookingLayout currentStep={3}>
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center text-white/80">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p>Redirecting to schedule…</p>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
