'use client';

import React from 'react';
import Image from 'next/image';

interface InstructorBioModalProps {
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
    totalBookings: number;
    distance: number;
    bio: string | null;
    languages: string[];
    vehicleTypes: string[];
  };
  onClose: () => void;
  onSelect: () => void;
}

export default function InstructorBioModal({ instructor, onClose, onSelect }: InstructorBioModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Instructor Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Profile Section */}
          <div className="flex gap-6 mb-6">
            {/* Profile Photo */}
            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              {instructor.profileImage ? (
                <Image
                  src={instructor.profileImage}
                  alt={instructor.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                  {instructor.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{instructor.name}</h3>
              
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500 text-lg">★</span>
                  <span className="text-gray-700 font-semibold">
                    {instructor.averageRating?.toFixed(1) || 'New'}
                  </span>
                  <span className="text-gray-500">
                    ({instructor.totalReviews} reviews)
                  </span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{instructor.totalBookings} lessons</span>
              </div>

              <p className="text-gray-600 mb-2">{instructor.distance.toFixed(1)} km away</p>
              
              <p className="text-2xl font-bold text-blue-600">
                ${instructor.hourlyRate}/hr
              </p>
            </div>
          </div>

          {/* Car Section */}
          {instructor.carImage && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Vehicle</h4>
              <div className="flex gap-4">
                <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-gray-200">
                  <Image
                    src={instructor.carImage}
                    alt={`${instructor.carMake} ${instructor.carModel}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {instructor.carYear} {instructor.carMake} {instructor.carModel}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {instructor.vehicleTypes.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Languages */}
          {instructor.languages.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Languages</h4>
              <div className="flex flex-wrap gap-2">
                {instructor.languages.map((language) => (
                  <span
                    key={language}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {instructor.bio && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">About</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{instructor.bio}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
          <button
            onClick={() => {
              onSelect();
              onClose();
            }}
            className="flex-1 px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Select Instructor
          </button>
        </div>
      </div>
    </div>
  );
}
