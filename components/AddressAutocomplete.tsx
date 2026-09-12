'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { AU_STATES, type AuSuburb } from '@/lib/data/au-locations'

interface SuburbAutocompleteProps {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

// Flatten all suburbs from all states for search
const ALL_SUBURBS: Array<AuSuburb & { state: string }> = []
AU_STATES.forEach(state => {
  state.suburbs.forEach(suburb => {
    ALL_SUBURBS.push({ ...suburb, state: state.code })
  })
})

export default function SuburbAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing suburb...',
  required = false,
  className = '',
}: SuburbAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Array<AuSuburb & { state: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update query when value changes externally
  useEffect(() => {
    setQuery(value)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    onChange(newQuery) // Update parent immediately

    if (newQuery.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Search suburbs (case-insensitive, matches start of suburb name or postcode)
    const searchLower = newQuery.toLowerCase()
    const matches = ALL_SUBURBS.filter(suburb =>
      suburb.displayName.toLowerCase().includes(searchLower) ||
      suburb.postcode.startsWith(newQuery)
    ).slice(0, 50) // Limit to 50 results

    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setHighlightedIndex(-1)
  }

  const selectSuburb = (suburb: AuSuburb & { state: string }) => {
    const formattedAddress = `${suburb.displayName} ${suburb.state} ${suburb.postcode}`
    setQuery(formattedAddress)
    onChange(formattedAddress)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      selectSuburb(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          className={
            className ||
            'w-full px-3 py-2 pr-8 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]'
          }
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {showSuggestions ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground/60" />
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          {suggestions.map((suburb, index) => (
            <button
              key={`${suburb.slug}-${suburb.state}`}
              type="button"
              onClick={() => selectSuburb(suburb)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${
                index === highlightedIndex
                  ? 'bg-primary/20 text-foreground'
                  : 'text-foreground hover:bg-secondary'
              } ${index === 0 ? 'rounded-t-lg' : ''} ${
                index === suggestions.length - 1 ? 'rounded-b-lg' : 'border-b border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{suburb.displayName}</span>
                <span className="text-sm text-muted-foreground">
                  {suburb.state} {suburb.postcode}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showSuggestions && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-2xl p-4 text-center text-sm text-muted-foreground">
          No suburbs found matching "{query}"
        </div>
      )}
    </div>
  )
}

