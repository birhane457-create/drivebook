'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Loader2, ChevronDown } from 'lucide-react';
import CompactInstructorCard from './CompactInstructorCard';
import { useBooking } from '@/lib/contexts/BookingContext';
import { useInstructorSearch } from '@/lib/hooks/useInstructorSearch';
import { AU_STATES } from '@/lib/data/au-locations';

// ── Lightweight suburb autocomplete (light background) ────────────────────────

interface SuburbHit { display: string; searchKey: string }

let _flat: SuburbHit[] | null = null;
function getFlat(): SuburbHit[] {
  if (_flat) return _flat;
  _flat = [];
  for (const st of AU_STATES) {
    for (const s of st.suburbs) {
      _flat.push({
        display:   `${s.displayName}, ${st.code} ${s.postcode}`,
        searchKey: `${s.displayName.toLowerCase()} ${s.postcode}`,
      });
    }
  }
  return _flat;
}

function quickSearch(q: string, limit = 8): SuburbHit[] {
  if (!q || q.length < 2) return [];
  const lq = q.toLowerCase().replace(/\s+/g, '');
  const flat = getFlat();
  const prefix: SuburbHit[] = [];
  const contains: SuburbHit[] = [];
  for (const h of flat) {
    const k = h.searchKey.replace(/\s+/g, '');
    if (k.startsWith(lq))      prefix.push(h);
    else if (k.includes(lq))   contains.push(h);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICLE_OPTIONS = [
  { label: 'Any',       value: '' },
  { label: 'Manual',    value: 'MANUAL' },
  { label: 'Automatic', value: 'AUTO' },
];
const LANGUAGE_OPTIONS = ['Any', 'English', 'Arabic', 'Mandarin', 'Hindi', 'Vietnamese', 'Spanish', 'Italian', 'Greek'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocationSearchBooking() {
  const router = useRouter();
  const { setInstructor } = useBooking();

  // Search state
  const [searchQuery, setSearchQuery]       = useState('');
  const [suggestions, setSuggestions]       = useState<SuburbHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searched, setSearched]             = useState(false);
  const [vehicleType, setVehicleType]       = useState({ label: 'Any', value: '' });
  const [language, setLanguage]             = useState('Any');

  const containerRef = useRef<HTMLDivElement>(null);

  const { results: instructors, loading, error, geocodeFailed, search } = useInstructorSearch();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length >= 2) {
      setSuggestions(quickSearch(val));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleSuggestionSelect = useCallback((hit: SuburbHit) => {
    // "Maylands, WA 6051" → "Maylands WA 6051" for the search query
    const query = hit.display.replace(', ', ' ');
    setSearchQuery(query);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (!searchQuery.trim()) { alert('Please enter a location'); return; }
    setSearched(true);
    await search(
      searchQuery,
      'location',
      vehicleType.value || undefined,
      language !== 'Any' ? language : undefined,
    );
  };

  const handleSelectInstructor = (instructor: any) => {
    setInstructor(instructor);
    router.push(`/book/${instructor.id}/package`);
  };

  // Shape results to match CompactInstructorCard's expected props
  const cards = instructors.map(i => ({
    ...i,
    carImage:             (i as any).carImage             ?? null,
    carMake:              (i as any).carMake              ?? null,
    carModel:             (i as any).carModel             ?? null,
    carYear:              (i as any).carYear              ?? null,
    vehicleTypes:         (i as any).vehicleTypes         ?? ['Manual', 'Automatic'],
    languages:            (i as any).languages            ?? ['English'],
    totalBookings:        (i as any).totalBookings        ?? 0,
    offersTestPackage:    (i as any).offersTestPackage    ?? false,
    testPackagePrice:     (i as any).testPackagePrice     ?? null,
    testPackageDuration:  (i as any).testPackageDuration  ?? null,
    testPackageIncludes:  (i as any).testPackageIncludes  ?? [],
    distance:             i.distance ?? 0,
  }));

  return (
    <div>
      {/* Search Bar */}
      <div className="max-w-5xl mx-auto">
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-xl p-4 sm:p-6">

          {/* Location row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative" ref={containerRef}>
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Enter suburb, postcode, or address..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                autoComplete="off"
              />
              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  {suggestions.map((hit, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(hit); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-sm"
                    >
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-800">{hit.display}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin" />Searching...</>
                : <><Search className="h-5 w-5" />Search</>}
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3">
            {/* Transmission */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Transmission</label>
              <div className="relative">
                <select
                  value={vehicleType.value}
                  onChange={e => {
                    const opt = VEHICLE_OPTIONS.find(o => o.value === e.target.value) || VEHICLE_OPTIONS[0];
                    setVehicleType(opt);
                  }}
                  className="appearance-none border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {VEHICLE_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Language */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
              <div className="relative">
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Active filter pills */}
            {(vehicleType.value !== '' || language !== 'Any') && (
              <div className="flex items-end gap-2">
                {vehicleType.value !== '' && (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1.5 rounded-full">
                    {vehicleType.label}
                    <button type="button" onClick={() => setVehicleType({ label: 'Any', value: '' })} className="ml-0.5 hover:text-blue-900 text-base leading-none">×</button>
                  </span>
                )}
                {language !== 'Any' && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1.5 rounded-full">
                    {language}
                    <button type="button" onClick={() => setLanguage('Any')} className="ml-0.5 hover:text-green-900 text-base leading-none">×</button>
                  </span>
                )}
              </div>
            )}
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
              <p className="text-gray-600 mb-4">
                {vehicleType.value !== '' || language !== 'Any'
                  ? 'Try adjusting your filters or a different suburb'
                  : 'Try a different suburb or postcode'}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSearched(false); setVehicleType({ label: 'Any', value: '' }); setLanguage('Any'); }}
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
                  {geocodeFailed
                    ? `Showing approximate matches for: ${searchQuery}`
                    : `Instructors who service: ${searchQuery} · sorted by distance`}
                </p>
              </div>
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map(instructor => (
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
