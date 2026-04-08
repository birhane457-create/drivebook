# Instructor Dashboard

**Route:** `/dashboard`  
**Auth required:** INSTRUCTOR role + active subscription  
**File:** `app/dashboard/page.tsx`

---

## What It Shows

- Today's bookings (time, client name, pickup address)
- Upcoming bookings (next 7 days)
- Earnings summary (this week, this month)
- Subscription status banner:
  - Trial: days remaining + upgrade CTA
  - Active: renewal date + current tier
  - Past due: payment warning
  - Cancelled: reactivation CTA
- Quick actions: Add Booking, View Clients, Check Availability

---

## Subscription Gate

All instructor dashboard routes require an active subscription (`requireActiveSubscription` middleware). If the subscription is expired or cancelled, the instructor is redirected to `/dashboard/subscription` to reactivate.

Trial instructors have full access during the trial period.

---

## Navigation

Desktop: `components/DashboardNav.tsx` — sidebar navigation  
Mobile: `components/instructor/MobileBottomNav.tsx` — bottom tab bar

Tabs:
- Dashboard (home)
- Bookings
- Clients
- Earnings
- Settings

---

## Stats

The dashboard fetches from `GET /api/analytics?period=week|month|year|all` which returns:
- `totalBookings` — all time (includes offline bookings in schedule count)
- `completedBookings` — completed lessons
- `cancelledBookings` — cancelled lessons
- `pendingBookings` — upcoming confirmed + pending
- `grossRevenue` — platform bookings only (Transaction table — offline excluded)
- `commission` — platform fee collected
- `netEarnings` — instructor payout after commission
- `newClients` — clients added in the period
- `averageRating` — from student reviews
- `completionRate` — completed / total bookings

---

## Bookings List

**Route:** `/dashboard/bookings`  
**File:** `app/dashboard/bookings/page.tsx`

Shows all bookings with:
- Time filter tabs: All / Upcoming / Past
- Source filter tabs: All Types / Platform / Offline
- Search by client name
- Two create buttons: "Platform Booking" (`/dashboard/bookings/new`) and "Offline / Cash" (`/dashboard/bookings/new?offline=true`, PRO+)
- Source badge on each card: blue "Platform" or grey "Offline"

---

## Booking Detail Page

**Route:** `/dashboard/bookings/[id]`  
**File:** `app/dashboard/bookings/[id]/page.tsx`

Shows full booking details: client info, date/time, duration, price, pickup address, notes, status badge.

For past/completed lessons, shows the **Lesson Feedback** section:
- If no feedback submitted: "Add Lesson Feedback" button opens `LessonFeedbackForm`
- If feedback submitted: shows performance score and notes, with option to edit
- Feedback stored as PDA codes + performance score + instructor notes on the `Booking` record
- API: `POST /api/instructor/lesson-feedback`

Actions (for upcoming confirmed bookings):
- Reschedule → `/dashboard/bookings/[id]/reschedule`
- Edit → `/dashboard/bookings/[id]/edit`

---

## Offline Booking Form

**Route:** `/dashboard/bookings/new?offline=true`  
**Gate:** PRO+ subscription required

Form for logging cash/bank transfer lessons outside the platform payment flow. Fields: client name, phone, email (optional — used for platform client guard), date, time, duration, payment method, amount paid, pickup address, notes.

**Platform client guard:** If the provided email matches a DriveBook-registered client for this instructor, the booking is blocked — those students must use platform bookings. See [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md).

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management reference
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system (PRO+)
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier features and gates
use platform bookings. See [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md).

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management reference
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier features and gates
- Edit → `/dashboard/bookings/[id]/edit`

---

## Offline Booking Form

**Route:** `/dashboard/bookings/new?offline=true`  
**Gate:** PRO+ subscription required

Form for logging cash/bank transfer lessons. Fields: client name, phone, email (optional — used for platform client guard), date, time, duration, payment method, amount paid, pickup address, notes.

**Platform client guard:** If the provided email matches a DriveBook-registered client for this instructor, the booking is blocked — those students must irmed bookings):
- Reschedule → `/dashboard/bookings/[id]/reschedule`
re + instructor notes on the `Booking` record

Actions available (for upcoming confotes, with option to edit
- Feedback is stored as PDA codes + performance sco- If no feedback submitted: "Add Lesson Feedback" button opens `LessonFeedbackForm`
- If feedback submitted: shows performance score and n

Shows full booking details: client info, date/time, duration, price, pickup address, notes.

For past/completed lessons, shows the **Lesson Feedback** section:
shboard/bookings/[id]`  
**File:** `app/dashboard/bookings/[id]/page.tsx`

**Route:** `/da"

---

## Booking Detail Page: blue "Platform" or grey "Offlineypes / Platform / Offline
- Search by client name
- Two create buttons: "Platform Booking" and "Offline / Cash" (PRO+)
- Source badge on each card---

## Bookings List

**Route:** `/dashboard/bookings`  
**File:** `app/dashboard/bookings/page.tsx`

Shows all bookings with:
- Filter tabs: All / Upcoming / Past
- Source filter: All T