# DriveBook Changelog

**Purpose:** Track major feature changes, updates, and deprecations

---

## [2026-09-01] - Instructor Directory & Search Consolidation

### Added
- ✅ **Instructor Directory** (`/instructors`)
  - Dedicated search page for finding instructors
  - Auto-search from homepage with URL parameters
  - 17,396 Australian suburbs with autocomplete
  - Filter by transmission type and language
  - Shareable URLs with search parameters
  - File: `app/instructors/page.tsx`

- ✅ **Suburb Autocomplete Enhancement**
  - Wired existing SuburbAutocomplete to homepage
  - Client-side search (no API calls)
  - Prefix and contains matching
  - Component: `components/instructor/SuburbAutocomplete.tsx`

### Changed
- 🔄 **Homepage Search** (`app/page.tsx`)
  - Now redirects to `/instructors` instead of inline results
  - Simplified LocationSearchBooking component
  - Better UX with dedicated search page

- 🔄 **/book Route** (`app/book/page.tsx`)
  - **Breaking:** Now redirects to `/instructors`
  - No longer shows search results inline
  - Maintains query parameters during redirect
  - Reason: Consolidate search experience

### Deprecated
- ⚠️ `/book` as search destination (still works via redirect)
- ⚠️ Inline search results on homepage

---

## [2026-08] - Decimal Migration

### Changed
- 🔄 **Financial Calculations**
  - Migrated from Float to Decimal.js
  - Updated 13 files across codebase
  - Ensures precision in currency handling
  - Files: earnings calculations, payment processing, wallet operations

### Technical
- Updated `lib/utils/decimal-helpers.ts`
- Changed from `@prisma/client/runtime/library` to `decimal.js`
- Browser-compatible implementation

---

## [2026-07] - White Label System

### Added
- ✅ Subdomain routing for instructors
- ✅ Custom branding (logo, colors)
- ✅ Business tier for driving schools

---

## Format

Each entry should include:
- **Date:** [YYYY-MM-DD]
- **Category:** Added / Changed / Deprecated / Removed / Fixed / Security
- **Description:** What changed and why
- **Impact:** Who is affected
- **Files:** Key files modified
- **Breaking:** Note if breaking change

---

## Guidelines

**When to Add:**
- New features or routes
- Breaking changes
- Deprecations
- Major refactors
- Security updates
- Database schema changes

**When NOT to Add:**
- Bug fixes (unless significant)
- Minor UI tweaks
- Documentation updates
- Code formatting

---

**Maintained By:** Development Team  
**Review:** Monthly or after major releases
