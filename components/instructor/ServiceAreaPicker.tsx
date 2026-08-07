'use client';

/**
 * ServiceAreaPicker
 *
 * Lets an instructor build their served suburb list from the static AU postcode data.
 * Stores each entry as "SuburbName|STATE|postcode" so we can do exact string matches
 * in the search API without any lat/lng arithmetic.
 *
 * The full list is stored as a JSON array in the Instructor.serviceAreas column.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Search, Plus } from 'lucide-react';
import { AU_STATES } from '@/lib/data/au-locations';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceSuburb {
  suburb:   string;
  state:    string;
  postcode: string;
}

/** Encode to the storage token format */
export function encodeSuburb(s: ServiceSuburb): string {
  return `${s.suburb}|${s.state}|${s.postcode}`;
}

/** Decode from storage token format */
export function decodeSuburb(token: string): ServiceSuburb | null {
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  return { suburb: parts[0], state: parts[1], postcode: parts[2] };
}

/** Parse the JSON serviceAreas string into suburb objects */
export function parseServiceAreas(raw: string | null | undefined): ServiceSuburb[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(decodeSuburb).filter(Boolean) as ServiceSuburb[];
  } catch {
    // Legacy: comma-separated suburb names (old format)
    return [];
  }
}

/** Serialise suburb list to the JSON string for storage */
export function serialiseServiceAreas(suburbs: ServiceSuburb[]): string {
  return JSON.stringify(suburbs.map(encodeSuburb));
}

// ── Search index ──────────────────────────────────────────────────────────────

interface SuburbEntry {
  suburb:    string;
  state:     string;
  postcode:  string;
  searchKey: string;
}

let _idx: SuburbEntry[] | null = null;

function getIdx(): SuburbEntry[] {
  if (_idx) return _idx;
  _idx = [];
  for (const state of AU_STATES) {
    for (const s of state.suburbs) {
      _idx.push({
        suburb:    s.displayName,
        state:     state.code,
        postcode:  s.postcode,
        searchKey: `${s.displayName.toLowerCase()} ${s.postcode}`,
      });
    }
  }
  return _idx;
}

function searchSuburbs(q: string, limit = 8): SuburbEntry[] {
  if (q.length < 2) return [];
  const lq = q.toLowerCase().trim();
  const idx = getIdx();
  if (/^\d+$/.test(lq)) {
    return idx.filter(e => e.postcode.startsWith(lq)).slice(0, limit);
  }
  const prefix   = idx.filter(e => e.suburb.toLowerCase().startsWith(lq));
  const contains = idx.filter(e => !e.suburb.toLowerCase().startsWith(lq) && e.suburb.toLowerCase().includes(lq));
  return [...prefix, ...contains].slice(0, limit);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value:    ServiceSuburb[];
  onChange: (suburbs: ServiceSuburb[]) => void;
  /** Max suburbs allowed (default unlimited) */
  maxSuburbs?: number;
}

export default function ServiceAreaPicker({ value, onChange, maxSuburbs }: Props) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SuburbEntry[]>([]);
  const [open, setOpen]       = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setResults(searchSuburbs(q));
    setOpen(q.length >= 2);
  }, []);

  const addSuburb = useCallback((entry: SuburbEntry) => {
    const already = value.some(v => v.suburb === entry.suburb && v.state === entry.state && v.postcode === entry.postcode);
    if (already) { setQuery(''); setOpen(false); return; }
    if (maxSuburbs && value.length >= maxSuburbs) return;
    onChange([...value, { suburb: entry.suburb, state: entry.state, postcode: entry.postcode }]);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }, [value, onChange, maxSuburbs]);

  const removeSuburb = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange]);

  const atMax = maxSuburbs ? value.length >= maxSuburbs : false;

  return (
    <div className="space-y-3">

      {/* Selected suburbs — tag pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((s, i) => (
            <span
              key={`${s.suburb}-${s.postcode}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-900/40 border border-sky-700/50 text-sky-200 text-xs font-medium"
            >
              <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
              {s.suburb}
              <span className="text-sky-400/60">{s.state} {s.postcode}</span>
              <button
                type="button"
                onClick={() => removeSuburb(i)}
                className="ml-0.5 text-sky-400/60 hover:text-red-400 transition-colors"
                aria-label={`Remove ${s.suburb}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {!atMax && (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInput}
              onFocus={() => { if (query.length >= 2) setOpen(true); }}
              placeholder="Type suburb or postcode to add…"
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {results.map((entry, i) => {
                const alreadyAdded = value.some(v => v.suburb === entry.suburb && v.postcode === entry.postcode);
                return (
                  <button
                    key={`${entry.postcode}-${entry.suburb}-${i}`}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); addSuburb(entry); }}
                    disabled={alreadyAdded}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-800 cursor-pointer',
                    ].join(' ')}
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="flex-1 text-slate-200">{entry.suburb}</span>
                    <span className="text-slate-500 text-xs">{entry.state} {entry.postcode}</span>
                    {alreadyAdded && <span className="text-xs text-sky-500">Added</span>}
                  </button>
                );
              })}
            </div>
          )}

          {open && query.length >= 2 && results.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl px-4 py-3 text-sm text-slate-500">
              No suburbs found for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-slate-500">
          No suburbs added yet — students will be matched by your km radius until you add suburbs.
        </p>
      )}

      {atMax && (
        <p className="text-xs text-amber-400">
          Maximum {maxSuburbs} suburbs reached. Remove one to add another.
        </p>
      )}
    </div>
  );
}
