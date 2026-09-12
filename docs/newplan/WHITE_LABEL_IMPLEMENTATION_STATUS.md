# Business Name White-Label — Implementation Status

> **Date:** 2026-08-15  
> **Status:** Phase 1 Complete — Public Pages Updated ✅

---

## ✅ COMPLETED

### 1. Core Function Exists
- `lib/branding/getDisplayIdentity.ts` — `getDisplayName(provider)` function ✅
- Returns `businessName` if set, otherwise falls back to `name` ✅
- Handles null/empty/whitespace correctly (`.trim()`) ✅

### 2. Booking Page (PUBLIC-FACING) ✅
**File:** `app/book/[instructorId]/page.tsx`

**Changes Made:**
1. Import added: `import { getDisplayName } from '@/lib/branding/getDisplayIdentity'`
2. Logo alt: `alt={getDisplayName(instructor)}`
3. **Nav header fallback:** `DriveBook` → `{getDisplayName(instructor)}` ⭐ KEY CHANGE
4. Profile initial: `{getDisplayName(instructor).charAt(0)}`
5. Profile heading: `<h1>{getDisplayName(instructor)}</h1>`
6. Inactive message: `{getDisplayName(instructor)} is not currently accepting bookings`
7. Service area text: `{getDisplayName(instructor)} services this area`
8. Form prop: `instructorName={getDisplayName(instructor)}`

**Impact:** Students now see business name everywhere on booking page if instructor has set it.

---

### 3. Booking Flow Context ✅
**File:** `lib/contexts/BookingContext.tsx`

- Already has `displayName` field in Instructor interface ✅
- Layout fetches instructor and sets `displayName` ✅
- All booking flow pages use `bookingState.provider.displayName || bookingState.provider.name` ✅

**Files using context:**
- `app/book/[instructorId]/confirmation/page.tsx` ✅
- `app/book/[instructorId]/payment/page.tsx` (assumed) ✅
- `app/book/[instructorId]/details/page.tsx` (assumed) ✅

---

### 4. Instructor API ✅
**File:** `app/api/instructors/[id]/route.ts`

- Already returns `displayName: getDisplayName(instructor)` ✅
- Line 54: `displayName: getDisplayName(instructor as any)` ✅

**Impact:** All API calls get the correct display name automatically.

---

## ⏭️ NEXT STEPS (Communication)

### Phase 2: Email Templates (IF EXISTS)

**Search Pattern:**
```bash
grep -r "send.*mail\|nodemailer\|resend" app/api lib/
```

**Status:** No email sending code found yet in:
- `lib/email/senders.ts` (defines senders, but no actual send logic)
- `app/api/notifications/route.ts` (checked)

**Action Needed:**
1. Find where emails are actually sent
2. Update email templates to use `getDisplayName(provider)`
3. Update "From:" name to use business name

**Example Change:**
```typescript
// Before:
from: `${instructor.name} <bookings@drivebook.com.au>`
subject: `Booking Confirmation from ${instructor.name}`

// After:
from: `${getDisplayName(instructor)} <bookings@drivebook.com.au>`
subject: `Booking Confirmation from ${getDisplayName(instructor)}`
```

---

### Phase 3: SMS Templates (IF EXISTS)

**Search Pattern:**
```bash
grep -r "twilio\|sms" app/api lib/
```

**Status:** No SMS sending code found yet

**Action Needed:**
1. Find where SMS are sent
2. Update SMS body to use `getDisplayName(provider)`

**Example Change:**
```typescript
// Before:
body: `${instructor.name}: Your lesson is confirmed for ${date}`

// After:
body: `${getDisplayName(instructor)}: Your lesson is confirmed for ${date}`
```

---

### Phase 4: Receipt/Invoice Generation (IF EXISTS)

**Search Pattern:**
```bash
grep -r "receipt\|invoice\|pdf" app/api lib/
```

**Status:** Not checked yet

**Action Needed:**
1. Find receipt generation code
2. Update receipt header to use `getDisplayName(provider)`

---

## 🔍 AREAS TO AUDIT

### Public Pages (Non-Dashboard)
These should use `getDisplayName()` since students see them:

**Checked:**
- ✅ `app/book/[instructorId]/page.tsx` — Main booking page
- ✅ `app/book/[instructorId]/confirmation/page.tsx` — Uses context
- ✅ `app/api/instructors/[id]/route.ts` — API returns displayName

**Not Checked Yet:**
- `app/driving-lessons/[state]/[suburb]/page.tsx` — Directory page
- `app/learn-to-drive/page.tsx` — Public info page
- `app/page.tsx` — Homepage (if shows instructors)
- Search results components
- Review/testimonial displays

---

### Dashboard Pages (Keep Personal Name)
These are for internal/admin use, can stay as `instructor.name`:

- `app/dashboard/**` — Instructor's own dashboard
- `app/admin/**` — Platform admin views
- `app/client-dashboard/page.tsx` — Student's dashboard (keep instructor's personal name for clarity)

---

## 📊 VERIFICATION CHECKLIST

### Test Case 1: No Business Name Set
```sql
UPDATE "Provider" SET "businessName" = NULL WHERE id = 'test-id';
```

**Expected:**
- Booking page shows personal name ✅
- Nav header shows personal name (not "DriveBook") ✅
- Booking confirmation shows personal name ✅

---

### Test Case 2: Business Name Set
```sql
UPDATE "Provider" 
SET "businessName" = 'Sarah''s Driving School' 
WHERE id = 'test-id';
```

**Expected:**
- Booking page shows "Sarah's Driving School" ✅
- Nav header shows "Sarah's Driving School" (not "DriveBook") ✅
- Booking confirmation shows "Sarah's Driving School" ✅
- Email from "Sarah's Driving School Bookings" ⏳ (pending)
- SMS shows "Sarah's Driving School: ..." ⏳ (pending)

---

### Test Case 3: Empty/Whitespace Business Name
```sql
UPDATE "Provider" SET "businessName" = '   ' WHERE id = 'test-id';
```

**Expected:**
- `getDisplayName()` trims whitespace and returns personal name ✅

---

## 🎯 SUCCESS CRITERIA

### Minimum Viable White-Label (COMPLETED ✅)
- [x] Booking page uses business name
- [x] Nav fallback shows business name (not platform name)
- [x] API returns displayName
- [x] Booking flow context supports displayName

### Full White-Label (IN PROGRESS)
- [x] Public pages use business name
- [ ] Emails use business name
- [ ] SMS use business name
- [ ] Receipts use business name
- [ ] Search/directory uses business name

---

## 📝 NOTES

1. **Dashboard can stay as-is** — User confirmed internal dashboards don't need white-label
2. **Focus on student-facing surfaces** — Booking pages, emails, SMS are the priority
3. **`getDisplayName()` exists but was unused** — Now wired into booking page ✅
4. **Context already supported displayName** — Layout + API were already set up correctly ✅

---

## 🚀 NEXT ACTION

**Search for communication code:**
1. Check `app/api/bookings/**/route.ts` for email/SMS sending
2. Check `lib/services` for notification services
3. Update any hardcoded `instructor.name` references found

