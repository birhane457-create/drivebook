'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import InstructorBioModal from './InstructorBioModal';

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
  };
  onSelect: () => void;
}

export default function CompactInstructorCard({ instructor, onSelect }: CompactInstructorCardProps) {
  const [showBioModal, setShowBioModal] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow flex flex-col h-full">
        {/* Photos Row */}
        <div className="flex gap-3 mb-4">
          {/* Profile Photo */}
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Car Photo */}
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
            {instructor.carImage ? (
              <Image
                src={instructor.carImage}
                alt={`${instructor.carMake} ${instructor.carModel}`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg mb-2">{instructor.name}</h3>
          
          {/* Rating & Distance */}
          <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">★</span>
              <span className="text-gray-700 font-medium">
                {instructor.averageRating?.toFixed(1) || 'New'}
              </span>
              <span className="text-gray-500">
                ({instructor.totalReviews})
              </span>
            </div>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">{instructor.distance.toFixed(1)} km</span>
          </div>

          {/* Car Info */}
          {instructor.carMake && (
            <p className="text-sm text-gray-600 mb-3">
              {instructor.carYear} {instructor.carMake} {instructor.carModel}
            </p>
          )}

          {/* Price */}
          <p className="text-xl font-bold text-blue-600 mb-4">
            ${instructor.hourlyRate}/hr
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={() => setShowBioModal(true)}
            className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            View Bio
          </button>
          <button
            onClick={onSelect}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select
          </button>
        </div>
      </div>

      {/* Bio Modal */}
      {showBioModal && (
        <InstructorBioModal
          instructor={instructor}
          onClose={() => setShowBioModal(false)}
          onSelect={onSelect}
        />
      )}
    </>
  );
}
