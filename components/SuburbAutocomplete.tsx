"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, X } from "lucide-react";

interface Suburb {
  postcode: string;
  suburb: string;
  state: string;
  label: string;
}

interface SuburbAutocompleteProps {
  value: string;
  onChange: (value: string, suburb?: Suburb) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function SuburbAutocomplete({
  value,
  onChange,
  placeholder = "Enter suburb, postcode, or address...",
  className = "",
  required = false,
}: SuburbAutocompleteProps) {
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);
  const [filteredSuburbs, setFilteredSuburbs] = useState<Suburb[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load suburbs data on mount
  useEffect(() => {
    fetch("/suburbs.json")
      .then((res) => res.json())
      .then((data) => setSuburbs(data))
      .catch((err) => console.error("Failed to load suburbs:", err));
  }, []);

  // Filter suburbs based on input
  useEffect(() => {
    if (!value || value.length < 2) {
      setFilteredSuburbs([]);
      setShowDropdown(false);
      return;
    }

    const searchTerm = value.toLowerCase().trim();
    const matches = suburbs
      .filter((s) => {
        const suburbMatch = s.suburb.toLowerCase().includes(searchTerm);
        const postcodeMatch = s.postcode.includes(searchTerm);
        const stateMatch = s.state.toLowerCase().includes(searchTerm);
        return suburbMatch || postcodeMatch || stateMatch;
      })
      .slice(0, 10); // Limit to 10 results

    setFilteredSuburbs(matches);
    setShowDropdown(matches.length > 0);
    setSelectedIndex(-1);
  }, [value, suburbs]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredSuburbs.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && filteredSuburbs[selectedIndex]) {
          selectSuburb(filteredSuburbs[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a suburb
  const selectSuburb = (suburb: Suburb) => {
    onChange(suburb.label, suburb);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && filteredSuburbs.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          required={required}
          className={`w-full pl-11 pr-10 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all ${className}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && filteredSuburbs.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-xl max-h-80 overflow-y-auto"
        >
          {filteredSuburbs.map((suburb, index) => (
            <button
              key={`${suburb.postcode}-${suburb.suburb}`}
              type="button"
              onClick={() => selectSuburb(suburb)}
              className={`w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3 ${
                index === selectedIndex ? "bg-secondary" : ""
              } ${index === 0 ? "rounded-t-xl" : ""} ${
                index === filteredSuburbs.length - 1 ? "rounded-b-xl" : ""
              }`}
            >
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {suburb.suburb}
                </div>
                <div className="text-sm text-muted-foreground">
                  {suburb.state} {suburb.postcode}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}