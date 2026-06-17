# Student Dashboard

**Route:** `/client-dashboard`  
**Auth required:** CLIENT role  
**File:** `app/client-dashboard/page.tsx`

---

## What It Shows

- Welcome message with student name
- Wallet balance (quick view)
- Current instructor card (name, rating, contact, package info)
- Three stat cards: Lessons Taken, Package Hours, Performance Score
- **Three booking sections:**
  - Upcoming Lessons (CONFIRMED bookings)
  - **Awaiting Payment** (PENDING_PAYMENT bookings) ⭐ NEW
  - Completed Lessons (COMPLETED, NO_SHOW bookings)
- Quick action buttons: Book a Lesson, Top Up Wallet, View Progress

---

## Booking Sections (3 Categories)

### Upcoming Lessons
- **Filter:** `status === 'upcoming'` (CONFIRMED bookings with future start time)
- **Actions:** Reschedule, Cancel, Contact Instructor
- **Color:** Green indicator

### Awaiting Payment ⭐ NEW
- **Filter:** `status === 'awaiting_payment'` (PENDING_PAYMENT bookings)
- **Context:** Booking created but student hasn't completed payment yet
- **Duration:** 10-minute hold on slot
- **Visual Design:**
  - Amber/orange accent color (different from green & gray)
  - Border-2 border-amber-600/50 with bg-amber-900/20
  - Red badge: "Payment required to confirm this booking"
  - Wallet icon indicator
- **Action Buttons (3 options):**
  1. **Pay Now** (Primary, blue) → Routes to `/booking/{id}/confirmation?tab=payment`
  2. **Reschedule** (Secondary, blue outline) → Opens RescheduleModal
  3. **Cancel** (Red outline) → Opens CancelDialog
- **User Workflow:**
  - Booking created with PENDING_PAYMENT status
  - Email sent with payment link
  - **Dashboard displays booking in "Awaiting Payment" section**
  - Student can pay from dashboard or via email link
  - After payment → booking moves to "Upcoming Lessons"

### Completed Lessons
- **Filter:** `status === 'completed'` (COMPLETED, NO_SHOW bookings)
- **Actions:** Leave Review, Rebook
- **Color:** Gray indicator

---

## Stat Cards (3 Summary Metrics)

1. **Lessons Taken** — Past completed bookings
   - Shows count + "upcoming/pending" count (includes awaiting-payment)
2. **Package Hours** — Remaining hours in current package
3. **Performance** — Average performance score across all lessons

---

## Navigation

The student dashboard uses a bottom navigation bar (`components/client/MobileBottomNav.tsx`) on mobile with tabs:
- Home
- Book
- Bookings
- Wallet
- Progress

---

## Progress Page

**Route:** `/client-dashboard/progress`  
**File:** `app/client-dashboard/progress/page.tsx`

Re-exports from `/dashboard/progress/page`. Calls `GET /api/client/my-performance` to fetch:
- Total lessons completed
- Total hours driven
- Performance scores per lesson
- Instructor feedback codes (PDA categories)
- Strengths and focus areas

---

## Help Page

**Route:** `/client-dashboard/help`  
**File:** `app/client-dashboard/help/page.tsx`

Static FAQ accordion with 6 categories:
1. Booking & Scheduling
2. Payments & Wallet
3. Cancellations & Refunds
4. Instructor & Lessons
5. Account & Profile
6. Technical Issues

Includes a contact section linking to `drivebook.com.au/contact`.

---

## Related

- [WALLET.md](./WALLET.md) — Wallet top-up and balance
- [BOOKINGS.md](./BOOKINGS.md) — Booking management
- [SETTINGS.md](./SETTINGS.md) — Profile settings
