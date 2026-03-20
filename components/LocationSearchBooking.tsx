'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Loader2 } from 'lucide-react';
import CompactInstructorCard from './CompactInstructorCard';
import { useBooking } from '@/lib/contexts/BookingContext';
import { useInstructorSearch } from '@/lib/hooks/useInstructorSearch';

export default function LocationSearchBooking() {
  const router = useRouter();
  const { setInstructor } = useBooking();
  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const { results: instructors, loading, error, geocodeFailed, search } = useInstructorSearch();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { alert('Please enter a location'); return; }
    setSearched(true);
    await search(searchQuery, 'location');
  };

  const handleSelectInstructor = (instructor: any) => {
    setInstructor(instructor);
    router.push(`/book/${instructor.id}/package`);
  };

  // Shape results to match CompactInstructorCard's expected props
  const cards = instructors.map(i => ({
    ...i,
    carImage: (i as any).carImage ?? null,
    carMake: (i as any).carMake ?? null,
    carModel: (i as any).carModel ?? null,
    carYear: (i as any).carYear ?? null,
    vehicleTypes: (i as any).vehicleTypes ?? ['Manual', 'Automatic'],
    languages: (i as any).languages ?? ['English'],
    totalBookings: (i as any).totalBookings ?? 0,
    offersTestPackage: (i as any).offersTestPackage ?? false,
    testPackagePrice: (i as any).testPackagePrice ?? null,
    testPackageDuration: (i as any).testPackageDuration ?? null,
    testPackageIncludes: (i as any).testPackageIncludes ?? [],
    distance: i.distance ?? 0,
  }));

  return (
    <div>
      {/* Search Bar */}
      <div className="max-w-5xl mx-auto">
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-xl p-4 sm:p-6">
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
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Searching...</> : <><Search className="h-5 w-5" />Search</>}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Example: "Maylands WA", "6051", "226 Whatley Cr Maylands"
          </p>
        </form>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-12">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Finding instructors near you...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">{error}</div>
          ) : instructors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No instructors found in this area</h3>
              <p className="text-gray-600 mb-4">Try a different suburb or postcode</p>
              <button onClick={() => { setSearchQuery(''); setSearched(false); }}
                className="text-blue-600 hover:text-blue-700 font-medium">Clear search</button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {instructors.length} Instructor{instructors.length !== 1 ? 's' : ''} Found
                </h2>
                <p className="text-gray-600">
                  {geocodeFailed
                    ? `Showing approximate matches for: ${searchQuery}`
                    : `Instructors who service: ${searchQuery} · sorted by distance`}
                </p>
              </div>
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((instructor) => (
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
