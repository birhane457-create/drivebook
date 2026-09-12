'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Loader2, Edit2, ArrowLeft, Menu, X, Filter, Star } from 'lucide-react';
import { useInstructorSearch } from '@/lib/hooks/useInstructorSearch';
import { useBooking } from '@/lib/contexts/BookingContext';
import CompactInstructorCard from '@/components/CompactInstructorCard';
import SuburbAutocomplete from '@/components/instructor/SuburbAutocomplete';
import Logo from '@/components/Logo';

export default function InstructorsDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInstructor } = useBooking();
  const { results: providers, loading, error, search } = useInstructorSearch();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(true);
  
  // Form state
  const [location, setLocation] = useState('');
  const [transmission, setTransmission] = useState('Any');
  const [language, setLanguage] = useState('Any');
  const [searched, setSearched] = useState(false);
  
  // Track if we've done the initial auto-search
  const hasAutoSearched = useRef(false);

  // Load params from URL and auto-search if params exist
  useEffect(() => {
    const locationParam = searchParams.get('location') || searchParams.get('q') || '';
    const transmissionParam = searchParams.get('transmission') || 'Any';
    const languageParam = searchParams.get('language') || 'Any';

    // Update form state
    if (locationParam) {
      setLocation(locationParam);
    }
    if (transmissionParam && transmissionParam !== 'Any') {
      setTransmission(transmissionParam);
    }
    if (languageParam && languageParam !== 'Any') {
      setLanguage(languageParam);
    }

    // Auto-search if location exists and we haven't searched yet
    if (locationParam && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setSearched(true);
      setShowSearchForm(false);
      
      // Execute search automatically
      search(
        locationParam,
        'location',
        transmissionParam !== 'Any' ? (transmissionParam === 'Manual' ? 'MANUAL' : 'AUTO') : undefined,
        languageParam !== 'Any' ? languageParam : undefined,
      );
    }
  }, [searchParams, search]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!location.trim()) {
      alert('Please enter a location');
      return;
    }

    setSearched(true);
    setShowSearchForm(false);

    // Update URL params
    const params = new URLSearchParams();
    params.set('location', location);
    if (transmission !== 'Any') params.set('transmission', transmission);
    if (language !== 'Any') params.set('language', language);
    
    router.push(`/instructors?${params.toString()}`, { scroll: false });

    // Execute search
    await search(
      location,
      'location',
      transmission !== 'Any' ? (transmission === 'Manual' ? 'MANUAL' : 'AUTO') : undefined,
      language !== 'Any' ? language : undefined,
    );
  };

  const handleSelectInstructor = (instructor: any) => {
    setInstructor(instructor);
    router.push(`/book/${instructor.id}/package`);
  };

  const handleEditSearch = () => {
    setShowSearchForm(true);
  };

  const inputCls =
    'w-full px-3 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all';

  // Shape results
  const cards = providers.map((i: any) => ({
    ...i,
    carImage: (i as any).carImage ?? null,
    carMake: (i as any).carMake ?? null,
    carModel: (i as any).carModel ?? null,
    carYear: (i as any).carYear ?? null,
    vehicleTypes: (i as any).vehicleTypes ?? ['Manual', 'Automatic'],
    languages: (i as any).languages ?? ['English'],
    totalBookings: (i as any).totalBookings ?? 0,
    testPackageDuration: (i as any).testPackageDuration ?? null,
    testPackageIncludes: (i as any).testPackageIncludes ?? [],
    distance: i.distance ?? 0,
  }));

  return (
    <div className="light min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="no-underline hover:opacity-80 transition-opacity">
              <Logo size={34} dark />
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex gap-1 items-center">
              <Link 
                href="/learn-to-drive" 
                className="text-foreground/70 hover:text-foreground text-sm px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors no-underline font-medium"
              >
                Learn to Drive
              </Link>
              <Link 
                href="/about" 
                className="text-foreground/70 hover:text-foreground text-sm px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors no-underline font-medium"
              >
                About
              </Link>
              <Link 
                href="/blog" 
                className="text-foreground/70 hover:text-foreground text-sm px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors no-underline font-medium"
              >
                Blog
              </Link>
              <div className="w-px h-5 bg-secondary mx-2" />
              <Link 
                href="/login" 
                className="text-foreground/70 hover:text-foreground text-sm px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors no-underline font-medium"
              >
                Login
              </Link>
              <Link 
                href="/teach-with-drivebook" 
                className="bg-gradient-to-r from-pink-600 to-violet-600 text-white px-5 py-2 rounded-xl hover:from-pink-500 hover:to-violet-500 text-sm font-bold no-underline transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 ml-1"
              >
                For Instructors
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-secondary/80 text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-background/95 border-t border-border py-4 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              <Link 
                href="/learn-to-drive" 
                className="block text-foreground/70 hover:text-foreground text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/80 no-underline font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Learn to Drive
              </Link>
              <Link 
                href="/about" 
                className="block text-foreground/70 hover:text-foreground text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/80 no-underline font-medium"
                onClick={() => setMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                href="/blog" 
                className="block text-foreground/70 hover:text-foreground text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/80 no-underline font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Blog
              </Link>
              <div className="h-px bg-secondary my-2" />
              <Link 
                href="/login" 
                className="block text-foreground/70 hover:text-foreground text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/80 no-underline font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
              <Link 
                href="/teach-with-drivebook" 
                className="block bg-gradient-to-r from-pink-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold text-center no-underline mt-2 shadow-lg shadow-purple-500/25"
                onClick={() => setMenuOpen(false)}
              >
                For Instructors
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm no-underline transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            <span className="text-foreground">Find Driving </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">
              Instructors
            </span>
          </h1>
          <p className="text-muted-foreground">
            Search by location, filter by preferences, and book instantly
          </p>
        </div>

        {/* Search Form */}
        {showSearchForm && (
          <div className="bg-card rounded-2xl border border-border shadow-xl p-4 sm:p-6 mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              {/* Location Search */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Location
                </label>
                <SuburbAutocomplete
                  value={location}
                  onChange={(address, details) => {
                    setLocation(address);
                  }}
                  placeholder="Enter suburb or postcode (e.g. Maylands or 6051)"
                  className=""
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
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
                  <label className="block text-sm font-semibold text-foreground mb-2">
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

              {/* Search Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-purple-500/25 hover:from-violet-500 hover:to-purple-500 hover:shadow-purple-500/40 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
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
        )}

        {/* Search Summary Bar (when results are shown) */}
        {searched && !showSearchForm && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-violet-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">
                  {location}
                  {transmission !== 'Any' && ` · ${transmission}`}
                  {language !== 'Any' && ` · ${language}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {loading ? 'Searching...' : `${providers.length} instructor${providers.length !== 1 ? 's' : ''} found`}
                </p>
              </div>
            </div>
            <button
              onClick={handleEditSearch}
              className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 font-medium text-sm transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit Search
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Finding instructors near you...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={handleEditSearch}
              className="text-violet-600 hover:text-violet-700 font-medium"
            >
              Try a different search
            </button>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && searched && providers.length === 0 && (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No instructors found in this area
            </h3>
            <p className="text-muted-foreground mb-4">
              Try a different suburb or adjust your filters
            </p>
            <button
              onClick={handleEditSearch}
              className="text-violet-600 hover:text-violet-700 font-medium"
            >
              Edit search
            </button>
          </div>
        )}

        {/* Instructor Cards */}
        {!loading && !error && providers.length > 0 && (
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((instructor) => (
              <CompactInstructorCard
                key={instructor.id}
                provider={instructor}
                onSelect={() => handleSelectInstructor(instructor)}
              />
            ))}
          </div>
        )}

        {/* Empty State (no search yet) */}
        {!searched && !loading && (
          <div className="text-center py-16 bg-card/50 border border-border border-dashed rounded-xl">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Start Your Search
            </h3>
            <p className="text-muted-foreground">
              Enter your location above to find qualified driving instructors near you
            </p>
          </div>
        )}
      </div>
    </div>
  );
}