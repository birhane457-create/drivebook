'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star, MapPin, DollarSign, Car, X } from 'lucide-react'

interface Instructor {
  id: string
  name: string
  profileImage: string | null
  bio: string | null
  hourlyRate: number
  vehicleTypes: string[]
  distance?: number
  serviceRadiusKm?: number
  averageRating?: number
  totalReviews?: number
}

interface InstructorCardProps {
  instructor: Instructor
  searchLocation?: string
}

export default function InstructorCard({ instructor, searchLocation }: InstructorCardProps) {
  const [showBio, setShowBio] = useState(false)
  
  const bookingUrl = searchLocation 
    ? `/book/${instructor.id}?location=${encodeURIComponent(searchLocation)}`
    : `/book/${instructor.id}`;

  return (
    <>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition p-4">
        {/* Compact Header */}
        <div className="flex items-center gap-3 mb-3">
          {instructor.profileImage ? (
            <Image
              src={instructor.profileImage}
              alt={instructor.name}
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-15 h-15 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-gray-400">
                {instructor.name.charAt(0)}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{instructor.name}</h3>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>
        </div>

        {/* Price and Distance */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xl font-bold text-green-600">${instructor.hourlyRate}</span>
            <span className="text-sm text-gray-500">/hour</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {instructor.distance !== undefined && (
              <div className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                <MapPin className="h-4 w-4" />
                <span>{instructor.distance.toFixed(1)}km away</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Car className="h-3 w-3" />
              <span>{instructor.vehicleTypes.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowBio(true)}
            className="flex-1 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium text-sm"
          >
            See Bio
          </button>
          <Link
            href={bookingUrl}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm text-center"
          >
            Book Now
          </Link>
        </div>
      </div>

      {/* Bio Modal */}
      {showBio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">About {instructor.name}</h2>
              <button
                onClick={() => setShowBio(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
                {instructor.profileImage ? (
                  <Image
                    src={instructor.profileImage}
                    alt={instructor.name}
                    width={100}
                    height={100}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-25 h-25 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-400">
                      {instructor.name.charAt(0)}
                    </span>
                  </div>
                )}
                
                <div>
                  <h3 className="text-2xl font-bold mb-1">{instructor.name}</h3>
                  {instructor.averageRating && instructor.totalReviews ? (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${
                              i < Math.round(instructor.averageRating!) 
                                ? 'fill-yellow-400 text-yellow-400' 
                                : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {instructor.averageRating.toFixed(1)} ({instructor.totalReviews} reviews)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span className="font-bold text-green-600">${instructor.hourlyRate}/hour</span>
                  </div>
                  {instructor.distance !== undefined && (
                    <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
                      <MapPin className="h-4 w-4" />
                      <span>{instructor.distance.toFixed(1)}km from your location</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {instructor.bio ? (
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">About Me</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{instructor.bio}</p>
                </div>
              ) : (
                <div className="mb-6 text-gray-500 italic">
                  No bio available yet.
                </div>
              )}

              {/* Details */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">Vehicle Types:</span>
                  <span>{instructor.vehicleTypes.join(', ')}</span>
                </div>
                {instructor.serviceRadiusKm && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">Service Radius:</span>
                    <span>{instructor.serviceRadiusKm}km coverage area</span>
                  </div>
                )}
              </div>

              {/* Book Button */}
              <Link
                href={bookingUrl}
                className="block w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-center"
              >
                Book Lesson with {instructor.name}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
