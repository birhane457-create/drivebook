# Business Name White-Label — Implementation Plan

> **Date:** 2026-08-15  
> **Goal:** Wire `getDisplayName()` everywhere to enable business name white-label  
> **Effort:** 1 day (systematic find-and-replace + testing)

---

## The Change

**Replace this pattern:**
```typescript
{instructor.name}
{provider.name}
{booking.providerName}
```

**With this:**
```typescript
import { getDisplayName } from '@/lib/branding/getDisplayIdentity'

{getDisplayName(instructor)}
{getDisplayName(provider)}
{getDisplayName(booking.provider)} // If provider object available
```

---

## Files That Need Changes

Based on code search, these files use `.name` and likely need updates:

### Public Booking Pages (HIGH PRIORITY)
- `app/book/[instructorId]/page.tsx` — Booking page (instructor.name in multiple places)
- `app/subdomain/[slug]/page.tsx` — Subdomain routing (if exists)

### Admin Pages (MEDIUM PRIORITY)
- `app/admin/bookings/page.tsx` — Booking list
- `app/admin/bookings/[id]/edit/page.tsx` — Edit booking
- `app/admin/clients/page.tsx` — Client list
- `app/admin/clients/[id]/page.tsx` — Client detail
- `app/admin/instructors/[id]/page.tsx` — Instructor detail
- `app/admin/revenue/page.tsx` — Revenue report
- `app/admin/documents/page.tsx` — Documents list
- `app/admin/reviews/page.tsx` — Reviews list

### Dashboard Pages (LOW PRIORITY - Internal)
- Dashboard pages show instructor names for admin purposes (can stay personal)

---

## Implementation Strategy

### Phase 1: Public-Facing Pages (4 hours)

**Target:** Student-facing surfaces where white-label matters

1. **Booking Page (`app/book/[instructorId]/page.tsx`)**
   - Line 64: `alt={instructor.name}` → `alt={getDisplayName(instructor)}`
   - Line 69: `{instructor.name.charAt(0)}` → `{getDisplayName(instructor).charAt(0)}`
   - Line 85: `<h1>{instructor.name}</h1>` → `<h1>{getDisplayName(instructor)}</h1>`
   - Add import at top: `import { getDisplayName } from '@/lib/branding/getDisplayIdentity'`

2. **Nav Logo Fallback (same file, line 71)**
   ```typescript
   // Current:
   <span>DriveBook</span>
   
   // Change to:
   <span>{getDisplayName(instructor)}</span>
   ```

3. **Search for other booking/confirmation pages**
   - `app/booking/[id]/confirmation/page.tsx`
   - `app/booking/[id]/payment/page.tsx`

**Test:** Book a lesson, verify business name shows (if set) or personal name (if not)

---

### Phase 2: Email Templates (2 hours - IF EXISTS)

**Search for email sending code:**
```bash
grep -r "sendEmail\|mail\|email" app/api lib/
```

**Update email sender/subject/body to use `getDisplayName()`**

Example:
```typescript
// Before:
from: `${instructor.name} <bookings@drivebook.com.au>`

// After:
from: `${getDisplayName(instructor)} Bookings <bookings@drivebook.com.au>`
```

---

### Phase 3: SMS Templates (1 hour - IF EXISTS)

**Search for SMS sending code:**
```bash
grep -r "sms\|twilio" app/api lib/
```

**Update SMS body to use `getDisplayName()`**

Example:
```typescript
// Before:
`${instructor.name}: Your lesson is confirmed...`

// After:
`${getDisplayName(instructor)}: Your lesson is confirmed...`
```

---

### Phase 4: Receipt Generation (1 hour - IF EXISTS)

**Search for receipt/invoice code:**
```bash
grep -r "receipt\|invoice" app/api lib/
```

**Update receipt header:**
```typescript
// Before:
<h1>{instructor.name}</h1>

// After:
<h1>{getDisplayName(instructor)}</h1>
```

---

## Testing Checklist

### Test Case 1: Solo Instructor (No Business Name)

**Setup:**
```sql
UPDATE "Provider" SET "businessName" = NULL WHERE id = 'test-id';
```

**Expected:**
- Booking page shows personal name ✅
- Email shows personal name ✅
- SMS shows personal name ✅

---

### Test Case 2: Instructor with Business Name

**Setup:**
```sql
UPDATE "Provider" 
SET "businessName" = 'Sarah''s Driving School' 
WHERE id = 'test-id';
```

**Expected:**
- Booking page shows "Sarah's Driving School" ✅
- Nav logo fallback shows "Sarah's Driving School" (not "DriveBook") ✅
- Email from "Sarah's Driving School Bookings" ✅
- SMS prefix "[Sarah's Driving School]:" ✅
- Receipt header "Sarah's Driving School" ✅

---

### Test Case 3: Empty Business Name

**Setup:**
```sql
UPDATE "Provider" SET "businessName" = '   ' WHERE id = 'test-id';
```

**Expected:**
- `getDisplayName()` returns personal name (`.trim()` removes whitespace) ✅

---

## Quick Start: Single File Demo

**Start with just the booking page to prove it works:**

<parameter>
<invoke name="path">e:/DOC/flowstate-wms/AI voice assistance - Copy - Copy - Copy/drivebook/app/book/[instructorId]/page.tsx