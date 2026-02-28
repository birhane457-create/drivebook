'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Loader2 } from 'lucide-react';
import CompactInstructorCard from './CompactInstructorCard';
import { useBooking } from '@/lib/contexts/BookingContext';

interface Instructor {
  id: string;
  name: string;
  profileImage: string | null;
  carImage: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  hourlyRate: number;
  vehicleTypes: string[];
  languages: string[];
  averageRating: number | null;
  totalReviews: number;
  totalBookings: number;
  bio: string | null;
  distance: number;
  offersTestPackage: boolean;
  testPackagePrice: number | null;
  testPackageDuration: number | null;
  testPackageIncludes: string[];
}

export default function LocationSearchBooking() {
  const router = useRouter();
  const { setInstructor } = useBooking();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      alert('Please enter a location');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(`/api/instructors/search?location=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data = await response.json();
        setInstructors(data.instructors);
      } else {
        alert('Failed to search instructors');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to search instructors');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInstructor = (instructor: Instructor) => {
    // Set instructor in booking context
    setInstructor(instructor);
    // Navigate to package selection page
    router.push(`/book/${instructor.id}/package`);
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter suburb, postcode, or address..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Search
                </>
              )}
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-3">
            Example: "6/226 Whatley Cr Maylands WA 6051", "Maylands WA", "6051"
          </p>
        </form>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-12">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Searching for instructors in your area...</p>
            </div>
          ) : instructors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No instructors found in this area
              </h3>
              <p className="text-gray-600 mb-4">
                Try searching for a different location or nearby suburb
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearched(false);
                  setInstructors([]);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {instructors.length} Instructor{instructors.length !== 1 ? 's' : ''} Found
                </h2>
                <p className="text-gray-600">
                  Showing instructors who service: <span className="font-semibold">{searchQuery}</span>
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {instructors.map((instructor) => (
                  <CompactInstructorCard 
                    key={instructor.id} 
                    instructor={instructor}
                    onSelect={() => handleSelectInstructor(instructor)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
