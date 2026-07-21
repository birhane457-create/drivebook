# Location System

**Status:** ✅ COMPLETE (July 2026)  
**Source data:** `POSTCODE.CVS` — Australia Post + ABS dataset

---

## Overview

DriveBook resolves suburb/postcode inputs to lat/lng coordinates for instructor search, booking pickup validation, and SEO page generation. The system uses a **static lookup file** as the primary source — no external geocoding API needed for ~95% of Australian location inputs.

---

## Architecture

```
POSTCODE.CVS  (source, not deployed)
    ↓  node scripts/generate-au-locations.js  (run once, or on new dataset)
lib/data/au-locations.ts  (static, committed, ~2MB)
    ↓  imported by
lib/services/resolve-location.ts       ← shared resolver used by all API routes
app/driving-lessons/[state]/page.tsx   ← SEO page generation (generateStaticParams)
app/driving-lessons/[state]/[suburb]/page.tsx
app/sitemap.ts
components/instructor/SuburbAutocomplete.tsx  ← instructor settings page
components/LocationSearchBooking.tsx          ← /book public search
```

---

## lib/data/au-locations.ts (auto-generated)

**Do not edit manually.** Regenerate with: `node scripts/generate-au-locations.js`

Exports:
- `AU_STATES: AuState[]` — all 8 states, 19,396 unique suburbs, each with `{ slug, displayName, postcode, lat, lng }`
- `POSTCODE_LOOKUP: Record<string, { suburb, state, lat, lng }>` — 2,634 postcodes for O(1) lookup
- `parseAuAddress(address)` — extracts suburb/state/postcode/lat/lng from a free-text AU address string using `POSTCODE_LOOKUP` first, then regex fallback. Returns `null` fields when unparseable.
- `getStateBySlug(slug)`, `getSuburbBySlug(state, suburbSlug)`, `toSuburbSlug(name)`

**Suburb counts by state:**

| State | Suburbs |
|-------|---------|
| WA | 1,799 |
| NSW | 5,084 |
| VIC | 3,327 |
| QLD | 3,821 |
| SA | 2,026 |
| TAS | 804 |
| NT | 373 |
| ACT | 162 |
| **Total** | **19,396** |

---

## lib/services/resolve-location.ts

Shared helper used by all location-dependent API routes.

```typescript
resolveLocationStatic(input: string): ResolvedLocation | null
```
- Input: suburb name, postcode, or free text (e.g. "6051", "Maylands", "Perth WA 6000")
- Process: strips spaces from postcode candidates → `POSTCODE_LOOKUP` → suburb prefix match
- Returns: `{ lat, lng, displayName, suburb, state, postcode, source }` or `null`
- Zero API calls. Instant.

```typescript
resolveLocation(input, geocodeFallback): Promise<ResolvedLocation | null>
```
- Tries `resolveLocationStatic` first
- Falls back to external geocoder (Nominatim) if static lookup returns null

**API routes using this:**

| Route | Behaviour |
|-------|-----------|
| `GET /api/instructors/search` | Fast path before `geocode()` |
| `GET /api/instructors/recommendations` | Fast path before `geocodeAddress()` |
| `POST /api/locations/validate` | Fast path before `geocodeAddress()`, enriches response components |
| `GET /api/public/check-service-area` | Fast path before `geocodeAddress()` |

---

## Instructor address → DB

When an instructor saves `baseAddress` in settings or profile:

```
PUT /api/instructor/settings  or  PUT /api/instructor/profile
    ↓
parseAuAddress(baseAddress)
    ↓ if postcode found in POSTCODE_LOOKUP
writes to DB:
  suburb, state, postcode
  baseLatitude, baseLongitude
  baseAddressLat, baseAddressLng  (aliases)
```

No Nominatim call needed. Both `settings` and `profile` routes do this.

---

## Autocomplete components

### SuburbAutocomplete (dark bg — instructor dashboard)
`components/instructor/SuburbAutocomplete.tsx`
- Used in `app/dashboard/settings/page.tsx` → Base Address field
- Props: `value`, `onChange(address, { suburb, state, postcode, lat, lng })`
- Searches all 19,396 suburbs client-side. No API calls.

### LocationSearchBooking (light bg — public /book page)
`components/LocationSearchBooking.tsx`
- Inline `quickSearch()` function (lightweight, avoids importing the full component)
- Shows suburb dropdown as student types on `/book`
- On selection → sets query → triggers `useInstructorSearch.search()` → `GET /api/instructors/search`

---

## SEO location pages

`/driving-lessons`, `/driving-lessons/[state]`, `/driving-lessons/[state]/[suburb]`

- `generateStaticParams` uses `AU_STATES` from the static file — all 19,396 suburbs get a page
- Pages show live instructors (DB query) with suburb coordinates from the static file
- WA pages fully operational. Other states show "coming soon" until instructors register.
- All location pages in sitemap.

See `docs/DOCROLEBASE/08-technical/SEO.md` for full SEO architecture.

---

## Regenerating the data

When Australia Post releases a new postcode dataset:

1. Replace `POSTCODE.CVS` in the project root
2. Run: `node scripts/generate-au-locations.js`
3. Commit the updated `lib/data/au-locations.ts`
4. The SEO pages will pick up new suburbs on next build/deploy (ISR handles it)

---

## Related

- `lib/data/au-locations.ts` — generated static file
- `lib/services/resolve-location.ts` — shared resolver
- `scripts/generate-au-locations.js` — generation script
- `scripts/backfill-instructor-locations.js` — one-time backfill for existing instructors
- `08-technical/SEO.md` — location page SEO architecture
- `03-instructor/SETTINGS.md` — base address field documentation
