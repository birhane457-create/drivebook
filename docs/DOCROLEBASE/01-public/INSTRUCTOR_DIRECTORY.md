# Instructor Directory

**Status:** ✅ Current  
**Last Updated:** 2026-09-01  
**Route:** `/instructors`  
**Component:** `app/instructors/page.tsx`

---

## Overview

The Instructor Directory is the central hub for students to search and discover driving instructors. It provides a dedicated page with advanced search capabilities and real-time filtering.

## Features

### 1. Suburb Autocomplete
- **Data Source:** `lib/data/au-locations.ts`
- **Total Suburbs:** 17,396 Australian suburbs
- **Search Component:** `components/instructor/SuburbAutocomplete.tsx`
- **Trigger:** 2+ characters
- **Type:** Client-side search (no API calls)

**How it Works:**
```typescript
// Searches through pre-loaded suburb data
- Postcode prefix match (e.g., "60" → "6051 Maylands")
- Suburb name prefix (e.g., "May" → "Maylands")
- Suburb name contains (e.g., "land" → "Maylands")
```

### 2. Auto-Search from Homepage
- User enters location on homepage
- Clicks "Search Instructors"
- Auto-redirects to `/instructors?location=X&transmission=Y`
- **Search executes automatically** on arrival
- Results appear immediately

**Flow:**
```
Homepage (/) 
  → LocationSearchBooking component
  → Redirect to /instructors?location=Maylands&transmission=Manual
  → Auto-search (useEffect with URL params)
  → Results displayed
```

### 3. Filter System

**Available Filters:**
- **Location:** Suburb/postcode autocomplete
- **Transmission:** Any, Manual, Automatic
- **Language:** Any, English, Mandarin, Arabic, Vietnamese

**URL Parameters:**
```
/instructors
  ?location=Maylands%20WA%206051
  &transmission=Manual
  &language=English
```

### 4. Shareable URLs
- All filters encoded in URL
- Copy/paste link preserves search
- Browser back/forward works correctly
- Bookmarkable search results

### 5. Search Form Behavior
- **On Initial Load with Params:** Form hidden, results shown
- **Edit Search Button:** Re-shows form for refinement
- **Manual Search:** Form collapses, results appear
- **Empty State:** Form visible with helpful message

---

## Technical Implementation

### Route Structure
```
app/instructors/page.tsx
  ├── Uses useSearchParams() to read URL
  ├── Auto-search on mount if params exist
  ├── useInstructorSearch() hook for API calls
  └── CompactInstructorCard for results
```

### Key Hooks
**useInstructorSearch:**
- Location: `lib/hooks/useInstructorSearch.ts`
- Handles search API calls
- Returns: { results, loading, error, search }

### State Management
```typescript
const [location, setLocation] = useState('')
const [transmission, setTransmission] = useState('Any')
const [language, setLanguage] = useState('Any')
const [searched, setSearched] = useState(false)
const [showSearchForm, setShowSearchForm] = useState(true)
const hasAutoSearched = useRef(false) // Prevents double-search
```

### Auto-Search Logic
```typescript
useEffect(() => {
  const locationParam = searchParams.get('location')
  
  // Pre-fill form
  if (locationParam) setLocation(locationParam)
  
  // Auto-search once
  if (locationParam && !hasAutoSearched.current) {
    hasAutoSearched.current = true
    setSearched(true)
    setShowSearchForm(false)
    search(locationParam, ...)
  }
}, [searchParams, search])
```

---

## User Journeys

### Journey 1: From Homepage
1. Land on homepage (/)
2. Enter "Maylands" in search
3. Select transmission: "Manual"
4. Click "Search Instructors"
5. **Redirect** → /instructors?location=Maylands&transmission=Manual
6. **Auto-search executes**
7. Results appear immediately
8. Click "Edit Search" to refine

### Journey 2: Direct URL
1. Open `/instructors` directly
2. See search form with empty state
3. Enter location manually
4. Apply filters
5. Click search
6. Results appear, form collapses

### Journey 3: Shared Link
1. Receive link: `/instructors?location=Perth&transmission=Automatic`
2. Open link
3. Form pre-filled with params
4. Auto-search executes
5. Results for Perth + Automatic shown
6. Can edit search if needed

---

## Related Components

### SuburbAutocomplete
**File:** `components/instructor/SuburbAutocomplete.tsx`
**Props:**
```typescript
interface Props {
  value: string
  onChange: (address: string, details: SuburbDetails) => void
  placeholder?: string
  className?: string
}

interface SuburbDetails {
  suburb: string
  state: string
  postcode: string
  lat: number
  lng: number
}
```

### LocationSearchBooking
**File:** `components/LocationSearchBooking.tsx`
**Now:** Simplified to form only, redirects to /instructors
**Props:**
```typescript
interface LocationSearchBookingProps {
  showResults?: boolean // Deprecated, always false now
}
```

### CompactInstructorCard
**File:** `components/CompactInstructorCard.tsx`
**Used for:** Displaying instructor results in grid
**Action:** Navigates to `/book/[id]/package` on select

---

## Integration Points

### Homepage Integration
**File:** `app/page.tsx`
- Uses `<LocationSearchBooking />`
- Form redirects to `/instructors`
- No inline results anymore

### Booking Flow
**After Instructor Selection:**
```
/instructors 
  → Select instructor 
  → /book/[instructorId]/package 
  → (existing booking flow continues)
```

### /book Page (Deprecated)
**File:** `app/book/page.tsx`
**Status:** Now redirects to `/instructors`
**Reason:** Consolidate search experience
```typescript
router.replace(`/instructors?${params}`)
```

---

## API Endpoints

### Search API
**Endpoint:** Uses `useInstructorSearch` hook
**Parameters:**
- `location` (string)
- `searchType`: 'location'
- `transmission`: 'MANUAL' | 'AUTO' | undefined
- `language`: string | undefined

**Returns:**
```typescript
{
  results: Instructor[]
  loading: boolean
  error: string | null
}
```

---

## SEO Considerations

### Meta Tags
```typescript
export const metadata = {
  title: "Find Driving Instructors Near You | DriveBook",
  description: "Search 17,396+ Australian suburbs to find qualified driving instructors. Filter by location, transmission type, and language."
}
```

### URL Structure
- Clean, descriptive URLs
- Filters in query params (crawlable)
- Canonical URL handling

---

## Future Enhancements

### Planned (Not Yet Implemented)
- [ ] Map view toggle
- [ ] Advanced filters (price range, rating)
- [ ] Sort options (distance, price, rating)
- [ ] Pagination/infinite scroll
- [ ] Save favorite instructors
- [ ] Filter sidebar (mobile-friendly)

---

## Migration Notes

### Changed from Previous Implementation
**Before:**
- Homepage showed results inline
- `/book` page showed results inline
- Two search locations, inconsistent UX

**After (Current):**
- Single search destination: `/instructors`
- Homepage redirects to `/instructors`
- `/book` redirects to `/instructors`
- Consistent, bookmarkable search experience

**Migration Date:** 2026-09-01

---

## Troubleshooting

### Suburb Autocomplete Not Showing
**Causes:**
- Less than 2 characters entered
- `au-locations.ts` not imported correctly
- JavaScript error in console

**Fix:**
- Check browser console
- Verify import: `import { AU_STATES } from '@/lib/data/au-locations'`
- Ensure 2+ characters entered

### Auto-Search Not Working
**Causes:**
- URL params missing
- `hasAutoSearched.current` already true
- Search hook not initialized

**Fix:**
- Check URL has `?location=` param
- Verify `useEffect` dependencies
- Check `useInstructorSearch` hook

### Results Not Appearing
**Causes:**
- API error
- No instructors in area
- Filters too restrictive

**Fix:**
- Check network tab
- Try broader location (e.g., state only)
- Remove filters and retry

---

## Code References

**Key Files:**
- `app/instructors/page.tsx` - Main route
- `components/LocationSearchBooking.tsx` - Search form
- `components/instructor/SuburbAutocomplete.tsx` - Autocomplete
- `lib/data/au-locations.ts` - Suburb data
- `lib/hooks/useInstructorSearch.ts` - Search logic
- `components/CompactInstructorCard.tsx` - Result cards

**Related Documentation:**
- [DOCROLEBASE/INDEX.md](../INDEX.md) - Main index
- [pr/INSTRUCTORS_DIRECTORY_IMPLEMENTATION.md](../../pr/) - Feature release doc
- [TEST_USERS.md](../../TEST_USERS.md) - Test accounts

---

**Document Status:** ✅ Current as of 2026-09-01  
**Maintained By:** Development Team  
**Next Review:** When feature changes
