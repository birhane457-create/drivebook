'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import SuburbAutocomplete from './instructor/SuburbAutocomplete';

interface LocationSearchBookingProps {
  /** @deprecated - Now always redirects to /instructors */
  showResults?: boolean;
}

/**
 * LocationSearchBooking - Homepage search form
 * 
 * This component now redirects all searches to /instructors page
 * instead of showing results inline. This creates a consistent
 * search experience across the platform.
 */
export default function LocationSearchBooking({ showResults }: LocationSearchBookingProps) {
  const [location, setLocation] = useState('');
  const [transmission, setTransmission] = useState('Any');
  const [language, setLanguage] = useState('Any');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location.trim()) {
      alert('Please enter a location');
      return;
    }

    setIsSubmitting(true);
    
    // Build URL params for /instructors page
    const params = new URLSearchParams();
    params.set('location', location);
    if (transmission !== 'Any') params.set('transmission', transmission);
    if (language !== 'Any') params.set('language', language);
    
    // Redirect to instructors directory
    router.push(`/instructors?${params.toString()}`);
  };

  const inputCls =
    'w-full px-3 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all';

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Suburb Autocomplete with 17k+ suburbs */}
        <div>
          <SuburbAutocomplete
            value={location}
            onChange={(address, details) => {
              setLocation(address);
            }}
            placeholder="Enter suburb or postcode (e.g. Maylands or 6051)"
            className=""
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Transmission
            </label>
            <select
              value={transmission}
              onChange={(e) => setTransmission(e.target.value)}
              className={inputCls}
            >
              <option>Any</option>
              <option>Manual</option>
              <option>Automatic</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={inputCls}
            >
              <option>Any</option>
              <option>English</option>
              <option>Mandarin</option>
              <option>Arabic</option>
              <option>Vietnamese</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-purple-500/25 hover:from-violet-500 hover:to-purple-500 hover:shadow-purple-500/40 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search Instructors
            </>
          )}
        </button>
      </form>
    </div>
  );
}