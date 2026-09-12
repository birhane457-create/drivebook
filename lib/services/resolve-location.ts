/**
 * resolveLocation.ts
 *
 * Resolves a user-supplied location string (suburb name, postcode, or free text)
 * to lat/lng coordinates and a canonical display name.
 *
 * Priority:
 *   1. 4-digit postcode → instant lookup in POSTCODE_LOOKUP (no API call)
 *   2. Suburb name match in static data → use stored lat/lng (no API call)
 *   3. Fall back to external geocoding (Nominatim / Google)
 *
 * This eliminates external geocoding API calls for ~95% of Australian searches.
 */

import { POSTCODE_LOOKUP, AU_STATES } from '@/lib/data/au-locations';

export interface ResolvedLocation {
  lat:         number;
  lng:         number;
  displayName: string;   // e.g. "Maylands, WA 6051"
  suburb:      string | null;
  state:       string | null;
  postcode:    string | null;
  source:      'postcode_lookup' | 'suburb_lookup' | 'geocode_api';
}

/** Build a fast suburb name → { lat, lng, postcode, state } map on first use */
let _suburbIndex: Map<string, { lat: number; lng: number; postcode: string; state: string }> | null = null;

function getSuburbIndex() {
  if (_suburbIndex) return _suburbIndex;
  _suburbIndex = new Map();
  for (const state of AU_STATES) {
    for (const suburb of state.suburbs) {
      // Key: lowercase suburb name — allows case-insensitive lookup
      _suburbIndex.set(suburb.displayName.toLowerCase(), {
        lat:      suburb.lat,
        lng:      suburb.lng,
        postcode: suburb.postcode,
        state:    state.code,
      });
    }
  }
  return _suburbIndex;
}

/**
 * Attempt to resolve a location string without any external API call.
 * Returns null if the location cannot be resolved from static data.
 */
export function resolveLocationStatic(input: string): ResolvedLocation | null {
  const trimmed = input.trim();

  // ── 1. Postcode lookup ─────────────────────────────────────────────────────
  // Strip spaces: "6 0 5 1" → "6051" (voice STT artefact)
  const postcodeCandidate = trimmed.replace(/\s+/g, '');
  if (/^\d{4}$/.test(postcodeCandidate)) {
    const info = POSTCODE_LOOKUP[postcodeCandidate];
    if (info) {
      return {
        lat:         info.lat,
        lng:         info.lng,
        displayName: `${info.suburb} ${info.state} ${postcodeCandidate}`,
        suburb:      info.suburb,
        state:       info.state,
        postcode:    postcodeCandidate,
        source:      'postcode_lookup',
      };
    }
  }

  // ── 2. Suburb name lookup ──────────────────────────────────────────────────
  const index = getSuburbIndex();
  const key   = trimmed.toLowerCase();

  // Exact match
  const exact = index.get(key);
  if (exact) {
    return {
      lat:         exact.lat,
      lng:         exact.lng,
      displayName: `${trimmed}, ${exact.state} ${exact.postcode}`,
      suburb:      trimmed,
      state:       exact.state,
      postcode:    exact.postcode,
      source:      'suburb_lookup',
    };
  }

  // Prefix match — e.g. "mayl" matches "Maylands"
  // Only use if unambiguous (one match)
  const prefix = trimmed.toLowerCase();
  if (prefix.length >= 3) {
    const matches: Array<{ name: string; data: { lat: number; lng: number; postcode: string; state: string } }> = [];
    for (const [name, data] of index.entries()) {
      if (name.startsWith(prefix)) {
        matches.push({ name, data });
        if (matches.length > 1) break; // ambiguous — don't auto-resolve
      }
    }
    if (matches.length === 1) {
      const { name, data } = matches[0];
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      return {
        lat:         data.lat,
        lng:         data.lng,
        displayName: `${displayName}, ${data.state} ${data.postcode}`,
        suburb:      displayName,
        state:       data.state,
        postcode:    data.postcode,
        source:      'suburb_lookup',
      };
    }
  }

  return null;
}

/**
 * Full resolution — tries static lookup first, falls back to external geocoding.
 * Import the appropriate geocode function from your geocode service.
 */
export async function resolveLocation(
  input: string,
  geocodeFallback: (query: string) => Promise<{ lat: number; lng: number; displayName?: string } | null>
): Promise<ResolvedLocation | null> {
  // Fast path — no network call
  const staticResult = resolveLocationStatic(input);
  if (staticResult) return staticResult;

  // Slow path — external geocoder
  const geocoded = await geocodeFallback(input);
  if (!geocoded) return null;

  return {
    lat:         geocoded.lat,
    lng:         geocoded.lng,
    displayName: geocoded.displayName ?? input,
    suburb:      null,
    state:       null,
    postcode:    null,
    source:      'geocode_api',
  };
}
