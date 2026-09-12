# Student Dashboard

**Route:** `/client-dashboard`  
**Auth required:** CLIENT role (INSTRUCTOR/ADMIN redirected to their own dashboards)  
**File:** `app/client-dashboard/page.tsx`  
**Last updated:** July 2026 (production-readiness audit)

---

## What It Shows

In order from top to bottom:

1. **Welcome header** — student name
2. **Success banner** — shown briefly after `?bookingSuccess` param (auto-dismisses 5s)
3. **Pickup location** — shown if set on profile
4. **Current instructor card** — name, rating, bio, car photo, services, contact buttons, Book/Switch actions
5. **Package & Credits card** — total/used/remaining hours, wallet balance, expiry date
6. **Three stat cards** — Lessons Taken, Package Hours, Performance Score
7. **Credit exhaustion warning** — only when balance is zero and no upcoming bookings
8. **Tabbed content** — My Bookings / Wallet & Credits / Payment History

---

## Booking Sections (3 Categories in My Bookings tab)

### Upcoming Lessons
- Filter: `status === 'upcoming'` (CONFIRMED bookings with future start time)
- Actions: Reschedule (opens `RescheduleModal`), Cancel (opens `CancelDialog`), contact expand
- Indicator: green dot

### Awaiting Payment
- Filter: `status === 'awaiting_payment'` (PENDING_PAYMENT bookings)
- Amber/orange visual treatment — slot held for 10 minutes
- Actions: Pay Now → `/booking/{id}/confirmation?tab=payment`, Reschedule, Cancel
- After payment: moves to Upcoming

### Completed Lessons
- Filter: `status === 'completed'`
- Actions: Leave Review (opens `ReviewModal`), Rebook

---

## Navigation

Desktop: `ClientDashboardNav` (top bar)  
Mobile: `components/client/MobileBottomNav.tsx` — 5-tab bottom bar:

```
Book · Bookings · Wallet · Progress · Profile
```

- **Book** — dynamic href from `useBookLessonHref` (routes to existing instructor or new search)
- **Bookings** — badge shows pending-reviews count (fetched from `/api/client/pending-reviews`)
- **Profile** — links to `/client-dashboard/profile` (fixed July 2026; was incorrectly linking to main dashboard)

---

## Data Fetching

`loadData()` runs 4 parallel fetches on mount and after booking success:

```
Promise.all([
  GET /api/client/profile,
  GET /api/client/wallet,
  GET /api/client/current-instructor,
  GET /api/client/my-performance
])
```

All four run concurrently (parallelised July 2026; previously awaited sequentially).

---

## Switch Instructor Flow

The "Switch" button on the current instructor card shows an **inline confirm panel** if the student has wallet credits remaining (replaced `window.confirm()` July 2026). The panel shows the wallet balance and two buttons: "Switch anyway" / "Keep instructor". Credits are not locked to any instructor — they work platform-wide.

---

## Sub-pages

| Route | File | Purpose |
|-------|------|---------|
| `/client-dashboard/bookings` | `bookings/page.tsx` | Full bookings list with filter tabs + pagination |
| `/client-dashboard/bookings/[id]` | `bookings/[id]/page.tsx` | Booking detail, lesson feedback, cancel, reschedule, review |
| `/client-dashboard/wallet` | `wallet/page.tsx` | Balance, top-up modal, usage breakdown |
| `/client-dashboard/packages` | `packages/page.tsx` | Package hours, expiry warnings, schedule-more CTA |
| `/client-dashboard/profile` | `profile/page.tsx` | Edit name, phone, pickup address (email read-only) |
| `/client-dashboard/progress` | `progress/page.tsx` | Performance scores, PDA codes, strengths/focus areas |
| `/client-dashboard/reviews` | `reviews/page.tsx` | Reviews submitted by student |
| `/client-dashboard/pda-tests` | `pda-tests/page.tsx` | PDA test bookings |
| `/client-dashboard/notifications` | `notifications/page.tsx` | Notification centre |
| `/client-dashboard/help` | `help/page.tsx` | Static FAQ accordion |
| `/client-dashboard/book-lesson` | `book-lesson/page.tsx` | Entry point to booking wizard |

---

## Booking Detail Page

**Route:** `/client-dashboard/bookings/[id]`

Key features:
- Status badge with clear label (Upcoming / Completed / Awaiting Payment / Awaiting Confirmation / Cancelled / Expired)
- Lesson feedback section (performance score, strengths, focus areas, instructor notes, whiteboard sketch)
- Reschedule: available if CONFIRMED + >12 hours until start
- Cancel: two-step inline confirm panel — "Yes, cancel / Keep booking" (replaced `window.confirm()` July 2026). Errors shown inline below the panel (replaced `alert()` July 2026).
- Review: shown for completed lessons not yet reviewed

---

## Profile Page

Editable fields: name, phone, default pickup address.  
Email is read-only.  
Save feedback uses an inline toast component (replaced 3× `alert()` calls July 2026) — auto-dismisses after 4s, positioned bottom-center to avoid mobile nav overlap.

---

## Post-Payment Confirmation

**Route:** `/booking/[id]/confirmation`

Two flows:
1. **SMS-link flow** (has `?token=`): fetches `/api/public/bookings/{id}/payment-summary?token=...`, polls up to 5× for webhook confirmation, shows full booking summary card.
2. **Wizard flow** (no token, has `?instructor=&hours=&total=`): skips API call, shows summary from URL params.

Both flows: shows "What's Next" steps, "Go to My Dashboard" (if session) or "Log in to View Booking" (if no session).

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking management detail
- [WALLET.md](./WALLET.md) — Wallet top-up and balance
- [SETTINGS.md](./SETTINGS.md) — Profile settings
