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

All instructor dashboard routes require an active subscription. If the subscription is expired or cancelled, the instructor is redirected to `/dashboard/subscription` to reactivate.

Trial instructors have full access during the trial period.

---

## Navigation

Desktop: `components/DashboardNav.tsx` — sidebar navigation  
Mobile: `components/instructor/MobileBottomNav.tsx` — bottom tab bar

Tabs: Dashboard / Bookings / Clients / Earnings / Settings

---

## Stats

Fetched from `GET /api/analytics?period=week|month|year|all`:
- `totalBookings` — all time (includes offline bookings in schedule count)
- `completedBookings`, `cancelledBookings`, `pendingBookings`
- `grossRevenue` — platform bookings only (offline excluded)
- `commission`, `netEarnings`
- `newClients`, `averageRating`, `completionRate`

---

## Bookings List

**Route:** `/dashboard/bookings`  
**File:** `app/dashboard/bookings/page.tsx`

Shows all bookings with:
- Filter tabs: All / Upcoming / Past
- Source filter: All Types / Platform / Offline
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

**Actions on upcoming CONFIRMED bookings:**
- Reschedule → `/dashboard/bookings/[id]/reschedule`
- Edit → `/dashboard/bookings/[id]/edit` (change pickup address and notes)

**Action on PENDING_PAYMENT bookings:**
- "Send Payment Link" button — calls `POST /api/bookings/send-payment-link` with the booking price pre-filled. Sends the client a wallet top-up email. Button is disabled after sending to prevent double-send.

---

## Booking Edit Page

**Route:** `/dashboard/bookings/[id]/edit`  
**File:** `app/dashboard/bookings/[id]/edit/page.tsx`

Allows editing pickup address and notes on upcoming CONFIRMED bookings. Uses `PATCH /api/bookings/[id]`.

To change date, time, or duration — use Reschedule instead.

---

## Clients Page

**Route:** `/dashboard/clients`  
**File:** `app/dashboard/clients/page.tsx`

Lists all clients for this instructor. Each row has:
- "View" eye icon → `/dashboard/clients/[id]` (client detail page)
- "Book Now" calendar icon → `/dashboard/bookings/new?clientId=[id]`
- Expand row for inline edit (name, phone, email, address, notes)
- Amber "No account" badge if `client.userId` is null

---

## Client Detail Page

**Route:** `/dashboard/clients/[id]`  
**File:** `app/dashboard/clients/[id]/page.tsx`  
**API:** `GET /api/instructor/clients/[id]`

Shows:
- Client contact info (name, phone, email, address, notes)
- Account status (registered / no account)
- Wallet balance (if client has a DriveBook account)
- Stats: total bookings, total spend
- Booking history (last 20 bookings with status badges, links to booking detail)
- "Book Now" button
- "Send Payment Link" button (only shown if client has a DriveBook account)

The API is scoped — only returns clients belonging to this instructor. Returns 404 otherwise.

---

## Offline Booking Form

**Route:** `/dashboard/bookings/new?offline=true`  
**Gate:** PRO+ subscription required

Form for logging cash/bank transfer lessons. Fields: client name, phone, email (optional), date, time, duration, payment method, amount paid, pickup address, notes.

**Platform client guard:** If the provided email matches a DriveBook-registered client for this instructor, the booking is blocked — those students must use platform bookings. See [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md).

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management reference
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system (PRO+)
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier features and gates
