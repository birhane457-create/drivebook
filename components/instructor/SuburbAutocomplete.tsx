'use client';

/**
 * SuburbAutocomplete
 *
 * Postcode/suburb search input backed by the static au-locations.ts data.
 * No API calls — all lookups happen client-side in memory.
 *
 * Usage:
 *   <SuburbAutocomplete
 *     value={baseAddress}
 *     onChange={(address, details) => {
 *       setBaseAddress(address);
 *       setLat(details.lat);
 *       setLng(details.lng);
 *     }}
 *     placeholder="e.g. Maylands or 6051"
 *   />
 *
 * When the instructor picks a suburb from the dropdown, onChange fires with:
 *   address  → "Maylands WA 6051"  (ready to save as baseAddress)
 *   details  → { suburb, state, postcode, lat, lng }
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { AU_STATES, POSTCODE_LOOKUP, type AuSuburb } from '@/lib/data/au-locations';

interface SuburbDetails {
  suburb:   string;
  state:    string;
  postcode: string;
  lat:      number;
  lng:      number;
}

interface Props {
  value:       string;
  onChange:    (address: string, details: SuburbDetails) => void;
  placeholder?: string;
  className?:  string;
}

// Build a flat searchable index from the static data
// Each entry: { displayName, state, postcode, lat, lng, searchKey }
interface SuburbEntry extends SuburbDetails {
  searchKey: string; // lowercase for matching
}

let _index: SuburbEntry[] | null = null;

function getIndex(): SuburbEntry[] {
  if (_index) return _index;
  const entries: SuburbEntry[] = [];
  for (const state of AU_STATES) {
    for (const suburb of state.suburbs) {
      entries.push({
        suburb:    suburb.displayName,
        state:     state.code,
        postcode:  suburb.postcode,
        lat:       suburb.lat,
        lng:       suburb.lng,
        searchKey: `${suburb.displayName.toLowerCase()} ${suburb.postcode} ${state.code.toLowerCase()}`,
      });
    }
  }
  _index = entries;
  return entries;
}

function search(query: string, limit = 8): SuburbEntry[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const index = getIndex();

  // Postcode prefix match first
  if (/^\d+$/.test(q)) {
    const postcodeMatches = index.filter(e => e.postcode.startsWith(q));
    return postcodeMatches.slice(0, limit);
  }

  // Suburb name prefix match
  const prefixMatches = index.filter(e =>
    e.suburb.toLowerCase().startsWith(q)
  );

  // Suburb name contains match (for mid-word searches)
  const containsMatches = index.filter(e =>
    !e.suburb.toLowerCase().startsWith(q) &&
    e.suburb.toLowerCase().includes(q)
  );

  return [...prefixMatches, ...containsMatches].slice(0, limit);
}

export default function SuburbAutocomplete({ value, onChange, placeholder, className }: Props) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<SuburbEntry[]>([]);
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    if (q.length >= 2) {
      setResults(search(q));
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
  }, []);

  const handleSelect = useCallback((entry: SuburbEntry) => {
    const address = `${entry.suburb} ${entry.state} ${entry.postcode}`;
    setQuery(address);
    setSelected(true);
    setOpen(false);
    setResults([]);
    onChange(address, {
      suburb:   entry.suburb,
      state:    entry.state,
      postcode: entry.postcode,
      lat:      entry.lat,
      lng:      entry.lng,
    });
  }, [onChange]);

  const handleClear = useCallback(() => {
    setQuery('');
    setSelected(false);
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query || value}
          onChange={handleInput}
          onFocus={() => {
            if (query.length >= 2 && results.length > 0) setOpen(true);
          }}
          placeholder={placeholder ?? 'Search suburb or postcode…'}
          className={`w-full bg-slate-950/60 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors ${className ?? ''}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {(query || value) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map((entry, i) => (
            <button
              key={`${entry.postcode}-${entry.suburb}-${i}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(entry); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800 transition-colors text-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="flex-1 text-slate-200">{entry.suburb}</span>
              <span className="text-slate-500 text-xs">{entry.state} {entry.postcode}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl px-4 py-3 text-sm text-slate-500">
          No suburbs found for "{query}"
        </div>
      )}
    </div>
  );
}
