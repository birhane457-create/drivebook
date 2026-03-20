'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';

interface LessonPackage {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
  isActive: boolean;
}

interface CompactInstructorCardProps {
  instructor: {
    id: string;
    name: string;
    profileImage: string | null;
    carImage: string | null;
    carMake: string | null;
    carModel: string | null;
    carYear: number | null;
    hourlyRate: number;
    averageRating: number | null;
    totalReviews: number;
    distance: number;
    bio: string | null;
    languages: string[];
    vehicleTypes: string[];
    totalBookings: number;
    lessonPackages?: LessonPackage[];
  };
  onSelect: () => void;
}

export default function CompactInstructorCard({ instructor, onSelect }: CompactInstructorCardProps) {
  const packages = instructor.lessonPackages?.filter(p => p.isActive !== false) || [];
  const [bioOpen, setBioOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
      {/* Top: profile + car side by side */}
      <div className="flex gap-0">
        {/* Profile photo */}
        <div className="relative w-1/2 h-36 bg-gray-100 flex-shrink-0">
          {instructor.profileImage ? (
            <Image src={instructor.profileImage} alt={instructor.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
              {instructor.name.charAt(0)}
            </div>
          )}
        </div>
        {/* Car photo */}
        <div className="relative w-1/2 h-36 bg-gray-50 flex-shrink-0">
          {instructor.carImage ? (
            <Image src={instructor.carImage} alt="Training vehicle" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
            </div>
          )}
          {/* Car label overlay */}
          {(instructor.carMake || instructor.carModel) && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 truncate">
              {[instructor.carYear, instructor.carMake, instructor.carModel].filter(Boolean).join(' ')}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{instructor.name}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-gray-700">
              {instructor.averageRating?.toFixed(1) || 'New'}
            </span>
            {instructor.totalReviews > 0 && (
              <span className="text-xs text-gray-400 ml-0.5">({instructor.totalReviews})</span>
            )}
          </div>
        </div>

        {/* Distance */}
        <p className="text-xs text-gray-400 mb-2">{instructor.distance.toFixed(1)} km away</p>

        {/* Bio — toggle */}
        {instructor.bio && (
          <div className="mb-3">
            <button
              onClick={() => setBioOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {bioOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {bioOpen ? 'Hide bio' : 'See bio'}
            </button>
            {bioOpen && (
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{instructor.bio}</p>
            )}
          </div>
        )}

        {/* Pricing tiles */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {/* Standard lesson */}
          <div className="bg-blue-50 rounded-lg px-2.5 py-2">
            <p className="text-xs text-gray-500">Standard</p>
            <p className="text-sm font-bold text-blue-700">${instructor.hourlyRate}/hr</p>
          </div>
          {/* Lesson packages */}
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-indigo-50 rounded-lg px-2.5 py-2">
              <p className="text-xs text-gray-500 truncate">{pkg.name}</p>
              <p className="text-sm font-bold text-indigo-700">${pkg.price.toFixed(0)}</p>
            </div>
          ))}
        </div>

        {/* Select button */}
        <button
          onClick={onSelect}
          className="mt-auto w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Select Instructor
        </button>
      </div>
    </div>
  );
}
