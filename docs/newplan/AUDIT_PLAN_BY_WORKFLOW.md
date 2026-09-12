# White-Label Audit Plan — By Workflow

> **Strategy:** Audit one user journey at a time to avoid missing anything  
> **Date:** 2026-08-15

---

## 🎯 AUDIT WORKFLOWS

### Workflow 1: PUBLIC BOOKING (Student Journey) — HIGHEST PRIORITY
**User:** Student discovering and booking lessons  
**Should show:** Business name (white-label)

**Pages to audit:**
1. ✅ `app/book/[instructorId]/page.tsx` — Main booking page (DONE)
2. ⏳ `app/book/[instructorId]/package/page.tsx` — Package selection
3. ⏳ `app/book/[instructorId]/details/page.tsx` — Booking details
4. ⏳ `app/book/[instructorId]/confirmation/page.tsx` — Review booking
5. ⏳ `app/book/[instructorId]/payment/page.tsx` — Payment page
6. ⏳ `app/booking/[id]/confirmation/page.tsx` — Post-payment confirmation
7. ⏳ `app/book/page.tsx` — Search/directory page
8. ⏳ `app/driving-lessons/[state]/[suburb]/page.tsx` — Local directory

**Components to audit:**
- ⏳ `components/BulkBookingForm.tsx`
- ⏳ `components/LocationSearchBooking.tsx`
- ⏳ Any instructor card components

---

### Workflow 2: COMMUNICATION (Student Receives) — HIGH PRIORITY
**User:** Student receiving notifications  
**Should show:** Business name (white-label)

**Already audited:**
- ✅ Email: `lib/services/email.ts` — Confirmation, PDA reminder, claim account (DONE)
- ✅ SMS: `lib/services/sms.ts` — All messages (ALREADY PERFECT)

**Still to audit:**
- ⏳ Push notifications (if exist): `lib/services/pushNotification.ts`
- ⏳ In-app notifications: `app/api/notifications/route.ts`
- ⏳ Receipt emails: `lib/services/receipt-email.ts`

---

### Workflow 3: CLIENT DASHBOARD (Student's View) — MEDIUM PRIORITY
**User:** Student managing their bookings  
**Should show:** Business name OR personal name (decide which)

**Pages to audit:**
- ⏳ `app/client-dashboard/page.tsx` — Main dashboard
- ⏳ Booking history displays
- ⏳ Upcoming lessons displays
- ⏳ Instructor contact info displays

**Decision needed:** Should client dashboard show business name or personal name?
- **Option A (white-label):** Show business name — maintains brand consistency
- **Option B (personal):** Show personal name — students know who their actual instructor is
- **Recommendation:** Business name (matches booking experience)

---

### Workflow 4: INSTRUCTOR DASHBOARD (Provider's View) — LOW PRIORITY
**User:** Instructor managing their business  
**Should show:** Personal name (internal use)

**Pages to audit:**
- ✅ `app/dashboard/**` — Keep personal names (CORRECT AS-IS)
- ✅ Their own profile/settings — Shows personal name (CORRECT)

**Note:** No changes needed here — internal tools should show personal names.

---

### Workflow 5: ADMIN DASHBOARD (Platform Admin) — LOW PRIORITY
**User:** Platform admin managing all providers  
**Should show:** Personal name + business name (both)

**Pages to audit:**
- ⏳ `app/admin/instructors/page.tsx` — Instructor list
- ⏳ `app/admin/instructors/[id]/page.tsx` — Instructor detail
- ⏳ `app/admin/bookings/page.tsx` — Booking list
- ⏳ Other admin views

**Decision:** Should show BOTH names like: "Sarah Johnson (Sarah's Driving School)"

---

### Workflow 6: DISCOVERY/MARKETING PAGES — MEDIUM PRIORITY
**User:** Student discovering instructors  
**Should show:** Business name (white-label)

**Pages to audit:**
- ⏳ `app/page.tsx` — Homepage (if shows instructors)
- ⏳ `app/book/page.tsx` — Instructor search
- ⏳ Search results displays
- ⏳ Featured instructor cards
- ⏳ Testimonials/reviews display

---

## 📋 DETAILED AUDIT CHECKLIST

### Workflow 1: PUBLIC BOOKING (START HERE)

#### Step 1.1: Main Booking Page
**File:** `app/book/[instructorId]/page.tsx`
- [x] Nav header
- [x] Profile heading
- [x] Profile avatar alt text
- [x] Profile initial letter
- [x] Service area text
- [x] Inactive message
- [x] Form prop

**Status:** ✅ COMPLETE

---

#### Step 1.2: Package Selection Page
**File:** `app/book/[instructorId]/package/page.tsx`

**What to check:**
- [ ] Does it display instructor name?
- [ ] Where is instructor data coming from? (BookingContext?)
- [ ] Any hardcoded `.name` references?

**Action:** Read file and search for `.name` or `instructor` references

---

#### Step 1.3: Booking Details Page
**File:** `app/book/[instructorId]/details/page.tsx`

**What to check:**
- [ ] Instructor name in header?
- [ ] Summary displays?
- [ ] Any `.name` references?

---

#### Step 1.4: Confirmation Page
**File:** `app/book/[instructorId]/confirmation/page.tsx`

**What to check:**
- [x] Uses `bookingState.provider.displayName || bookingState.provider.name` ✅
- [x] BookingContext provides displayName ✅

**Status:** ✅ COMPLETE (uses context which has displayName)

---

#### Step 1.5: Payment Page
**File:** `app/book/[instructorId]/payment/page.tsx`

**What to check:**
- [ ] Instructor name in summary?
- [ ] Receipt preview?
- [ ] Any `.name` references?

---

#### Step 1.6: Post-Payment Confirmation
**File:** `app/booking/[id]/confirmation/page.tsx`

**What to check:**
- [ ] Success message with instructor name?
- [ ] Email sent notification?
- [ ] Any `.name` references?

---

#### Step 1.7: Search/Directory
**File:** `app/book/page.tsx`

**What to check:**
- [ ] Instructor cards?
- [ ] Search results?
- [ ] Any instructor name displays?

---

#### Step 1.8: Components Used in Booking
**Files:**
- `components/BulkBookingForm.tsx`
- `components/LocationSearchBooking.tsx`

**What to check:**
- [ ] Props received: `instructorName` or `instructor` object?
- [ ] Any direct `.name` access?
- [ ] Should props be updated to pass `displayName`?

---

### Workflow 2: COMMUNICATION

#### Step 2.1: Receipt Emails
**File:** `lib/services/receipt-email.ts`

**What to check:**
- [ ] Does it display instructor name?
- [ ] Should use `getDisplayName()`?

---

#### Step 2.2: Push Notifications
**File:** `lib/services/pushNotification.ts`

**What to check:**
- [ ] Notification body with instructor name?
- [ ] Should use `getDisplayName()`?

---

#### Step 2.3: In-App Notifications
**File:** `app/api/notifications/route.ts` or notification service

**What to check:**
- [ ] Notification messages?
- [ ] Any instructor name references?

---

### Workflow 3: CLIENT DASHBOARD

#### Step 3.1: Main Dashboard
**File:** `app/client-dashboard/page.tsx`

**What to check:**
- [ ] Booking history instructor names?
- [ ] Upcoming lessons instructor display?
- [ ] Contact info display?

**Decision:** Should show business name for consistency with booking experience.

---

## 🎯 AUDIT EXECUTION ORDER

### Phase 1: PUBLIC BOOKING FLOW (TODAY)
1. ✅ Main booking page (DONE)
2. Package selection page
3. Booking details page
4. ✅ Confirmation page (DONE via context)
5. Payment page
6. Post-payment confirmation
7. BulkBookingForm component
8. Search/directory page

### Phase 2: COMMUNICATION (TODAY)
1. ✅ Email service (DONE)
2. ✅ SMS service (ALREADY PERFECT)
3. Receipt emails
4. Push notifications (if exist)
5. In-app notifications

### Phase 3: CLIENT DASHBOARD (LATER)
1. Main dashboard
2. Booking history
3. Instructor contact displays

### Phase 4: DISCOVERY PAGES (OPTIONAL)
1. Homepage
2. Search page
3. Testimonials

### Phase 5: ADMIN (OPTIONAL)
1. Instructor list
2. Booking list
3. Show both personal + business name

---

## 🔍 AUDIT METHODOLOGY

For each file:

1. **Read the file** (first 100 lines to understand structure)
2. **Search for patterns:**
   - `instructor.name`
   - `provider.name`
   - `.name`
   - `instructorName`
   - `providerName`
3. **Check data source:**
   - API call? Check if API returns `displayName`
   - Context? Check if context has `displayName`
   - Props? Check if parent passes `displayName`
4. **Determine action:**
   - ✅ Already uses `displayName` or `getDisplayName()` — mark complete
   - 🔧 Uses `.name` but can use context's `displayName` — no code change, mark complete
   - ⚠️ Uses `.name` directly — needs update
5. **Apply fix if needed:**
   - Import `getDisplayName` if needed
   - Replace `.name` with `getDisplayName(object)` or use context's `displayName`
6. **Verify:**
   - Search again to ensure no occurrences missed
   - Mark as ✅

---

## 📊 TRACKING PROGRESS

**Current Status:**
- ✅ Main booking page (8 changes)
- ✅ Email service (9 changes)
- ✅ SMS service (already perfect)
- ✅ Booking confirmation (uses context)
- ✅ API (returns displayName)

**Next Up:**
1. Package selection page
2. Booking details page
3. Payment page
4. BulkBookingForm component

**Total Estimated Files:** ~15-20
**Time per File:** 5-10 minutes
**Total Time:** 2-3 hours

---

## 🚦 START SIGNAL

Ready to begin Phase 1: PUBLIC BOOKING FLOW?

Say "start workflow 1" and I'll audit files 1.2 through 1.8 systematically!

