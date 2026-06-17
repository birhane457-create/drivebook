'use client';

import { useState, useCallback, useRef } from 'react';

export interface InstructorResult {
  id: string;
  name: string;
  hourlyRate: number;
  serviceAreas: string | null;
  baseAddress: string | null;
  serviceRadiusKm: number | null;
  distance: number | null; // km from searched point, null if name-only search
  profileImage: string | null;
  averageRating: number | null;
  totalReviews: number;
  bio: string | null;
  offersTestPackage?: boolean;
  testPackagePrice?: number | null;
}

interface Options {
  /** Pass true for admin context — bypasses approved-only filter */
  admin?: boolean;
  /** Debounce ms for name search (default 300) */
  debounceMs?: number;
}

export function useInstructorSearch(options: Options = {}) {
  const { admin = false, debounceMs = 300 } = options;

  const [results, setResults] = useState<InstructorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geocodeFailed, setGeocodeFailed] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (query: string, mode: 'location' | 'name' = 'location') => {
      if (!query.trim()) { setResults([]); return; }

      const run = async () => {
        setLoading(true);
        setError(null);
        setGeocodeFailed(false);
        try {
          const param = mode === 'location' ? 'location' : 'name';
          const adminParam = admin ? '&admin=true' : '';
          const res = await fetch(
            `/api/instructors/search?${param}=${encodeURIComponent(query)}${adminParam}`
          );
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'Search failed'); return; }
          setResults(data.instructors || []);
          setGeocodeFailed(!!data.geocodeFailed);
        } catch {
          setError('Search failed');
        } finally {
          setLoading(false);
        }
      };

      if (mode === 'name') {
        // Debounce name search
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(run, debounceMs);
      } else {
        // Location search is explicit (button press) — run immediately
        await run();
      }
    },
    [admin, debounceMs]
  );

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    setGeocodeFailed(false);
  }, []);

  return { results, loading, error, geocodeFailed, search, clear };
}
