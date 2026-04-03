'use client';

import { useState } from 'react';
import SubdomainBookingWizard from './SubdomainBookingWizard';

interface SubdomainBookingEntryProps {
  instructor: {
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
    lessonPackages?: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price: number;
      description: string;
      isActive: boolean;
    }>;
  };
  primary: string;
}

export default function SubdomainBookingEntry({ instructor, primary }: SubdomainBookingEntryProps) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: primary }}
      >
        Book Your Lesson →
      </button>
    );
  }

  return <SubdomainBookingWizard instructor={instructor} primary={primary} />;
}
