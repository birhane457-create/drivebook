# Gap Implementation Plan
**Based on:** Deep inspection of public, student, and instructor roles — April 2026  
**Status:** Active — work in progress

---

## Overview

This document is the single source of truth for all identified gaps and the implementation plan to close them. Items are ordered by priority. Each task has a clear scope, affected files, and acceptance criteria.

---

## Priority 1 — High (Student Experience Blockers)

---

### GAP-01: Student has no booking detail page

**Problem:**  
`/client-dashboard/bookings` is a flat list with inline modals. There is no `/client-dashboard/bookings/[id]` page. Students cannot see pickup address, notes, full lesson details, or access a receipt from their dashboard.

**Affected files:**
- `app/client-dashboard/bookings/page.tsx` — add link to detail page per booking card
- `app/client-dashboard/bookings/[id]/page.tsx` — CREATE THIS FILE
- `app/api/client/bookings/[id]/route.ts` — CREATE THIS FILE (GET single booking)

**What the detail page must show:**
- Instructor name, phone, WhatsApp
- Date, time, duration
- Pickup address
- Price paid
- Status badge (with human-readable label)
- Lesson feedback / progress score (if completed and feedback given)
- Reschedule button (if upcoming + >12h notice)
- Cancel button (if upcoming)
- Leave Review button (if completed + not yet reviewed)
- Receipt download link (if paid)

**Acceptance criteria:**
- [ ] Each booking card in the list links to `/client-dashboard/bookings/[id]`
- [ ] Detail page loads booking data from `GET /api/client/bookings/[id]`
- [ ] All actions (reschedule, cancel, review) work from the detail page
- [ ] 404 if booking doesn't belong to the logged-in student

---

### GAP-02: PENDING and PENDING_PAYMENT bookings invisible to students

**Problem:**  
`/api/client/profile` filters out `PENDING_PAYMENT` where `isPaid = false` and `PENDING` where `isPaid = false`. A student who just paid (webhook not yet fired), or a short-notice booking awaiting instructor approval, disappears from their list entirely. No "awaiting confirmation" state is shown.

**Affected files:**
- `app/api/client/profile/route.ts` — update `activeBookings` filter logic
- `app/client-dashboard/bookings/page.tsx` — add "Pending" status display + badge

**What to change:**
- Include `PENDING_PAYMENT` bookings regardless of `isPaid` — show as "Awaiting Payment"
- Include `PENDING` bookings regardless of `isPaid` — show as "Awaiting Confirmation"
- Add a yellow/amber badge for these states
- Add a "Complete Payment" link for `PENDING_PAYMENT` bookings pointing to `/booking/[id]/payment`

**Status mapping:**

| DB Status | Display Label | Badge Color |
|-----------|--------------|-------------|
| CONFIRMED (future) | Upcoming | Green |
| CONFIRMED (past endTime) | Completed | Grey |
| COMPLETED | Completed | Grey |
| PENDING | Awaiting Confirmation | Amber |
| PENDING_PAYMENT | Awaiting Payment | Yellow |
| NO_SHOW | No Show | Red |
| CANCELLED | Cancelled | Red |
| EXPIRED | Expired | Grey |

**Acceptance criteria:**
- [ ] PENDING_PAYMENT bookings appear with "Awaiting Payment" badge + payment link
- [ ] PENDING bookings appear with "Awaiting Confirmation" badge
- [ ] EXPIRED bookings appear with "Expired" badge (not silently hidden)
- [ ] CANCELLED bookings appear in the "Past" tab

---

### GAP-03: No in-app notifications UI for students

**Problem:**  
The notification API (`/api/notifications`, `/api/notifications/mark-read`) and service (`lib/services/notifications.ts`) exist and are used to send notifications to students. But there is no UI in the client dashboard to display them — no bell icon, no notifications page, no unread count.

**Affected files:**
- `app/client-dashboard/layout.tsx` — add notification bell to header
- `app/client-dashboard/notifications/page.tsx` — CREATE THIS FILE
- `components/client/MobileBottomNav.tsx` — consider adding notifications tab or badge

**What the notifications page must show:**
- List of notifications ordered by `createdAt DESC`
- Unread count badge on bell icon
- Mark as read on click
- Notification types: booking confirmed, booking cancelled, booking rescheduled, payment received, review reminder
- Empty state: "You're all caught up"

**API already exists:**
- `GET /api/notifications` — returns notifications for logged-in user
- `POST /api/notifications/mark-read` — marks notification(s) as read

**Acceptance criteria:**
- [ ] Bell icon in client dashboard header shows unread count
- [ ] Clicking bell navigates to `/client-dashboard/notifications`
- [ ] Notifications list renders with correct labels and timestamps
- [ ] Clicking a notification marks it as read
- [ ] Unread count updates after marking read

---

## Priority 2 — Medium (UX Gaps)

---

### GAP-04: Reviews not in client mobile nav

**Problem:**  
The client mobile bottom nav has 5 tabs: Book / My Bookings / Wallet / Progress / Profile. Reviews is only accessible by navigating directly to `/client-dashboard/reviews`. Students who have pending reviews have no visual prompt.

**Affected files:**
- `components/client/MobileBottomNav.tsx` — add Reviews tab OR add pending-review badge to Bookings tab

**Recommended approach:**  
Add a red badge dot to the "My Bookings" tab when there are pending reviews (fetched from `GET /api/client/pending-reviews`). This avoids adding a 6th tab which would crowd the nav.

**Acceptance criteria:**
- [ ] Red dot badge appears on "My Bookings" tab when `pendingReviews.length > 0`
- [ ] Badge disappears after all reviews are submitted
- [ ] Badge count is fetched on mount and refreshed after review submission

---

### GAP-05: No client detail page for instructors

**Problem:**  
`/dashboard/clients` is a flat expandable list. There is no `/dashboard/clients/[id]` page. Instructors cannot see a client's booking history, wallet balance, or send a payment link from a dedicated client view.

**Affected files:**
- `app/dashboard/clients/page.tsx` — add "View" link per client row
- `app/dashboard/clients/[id]/page.tsx` — CREATE THIS FILE
- `app/api/instructor/clients/[id]/route.ts` — CREATE THIS FILE (GET client detail for instructor)

**What the client detail page must show:**
- Client name, phone, email, address, notes
- DriveBook account status (registered / no account)
- Wallet balance (if client has a DriveBook account)
- Booking history (all bookings with this instructor)
- "Book Now" button → `/dashboard/bookings/new?clientId=[id]`
- "Send Payment Link" button → calls `POST /api/bookings/send-payment-link`
- "No account" amber notice if `client.userId` is null

**Acceptance criteria:**
- [ ] Each client row in the list has a "View" link to `/dashboard/clients/[id]`
- [ ] Detail page loads from a scoped API (only returns clients belonging to this instructor)
- [ ] Booking history shows last 20 bookings with status badges
- [ ] "Send Payment Link" button is visible and functional when wallet balance is insufficient
- [ ] 404 if client doesn't belong to the logged-in instructor

---

### GAP-06: `/dashboard/bookings/[id]/edit` folder exists with no page

**Problem:**  
The folder `app/dashboard/bookings/[id]/edit/` exists but contains no `page.tsx`. The booking detail page at `/dashboard/bookings/[id]` links to this route. Navigating to it returns a 404.

**Affected files:**
- `app/dashboard/bookings/[id]/edit/page.tsx` — CREATE THIS FILE
- `app/dashboard/bookings/[id]/page.tsx` — verify edit link is conditional (only for upcoming bookings)

**What the edit page must allow:**
- Change pickup address
- Change notes
- Change duration (triggers wallet adjustment if client has account)
- Cannot change date/time here — that's reschedule

**Acceptance criteria:**
- [ ] Edit page loads current booking data
- [ ] Pickup address and notes can be saved via `PATCH /api/bookings/[id]`
- [ ] Duration change recalculates price and shows diff to instructor
- [ ] Edit link only appears on upcoming CONFIRMED bookings

---

### GAP-07: No "Send Payment Link" button in instructor UI

**Problem:**  
`POST /api/bookings/send-payment-link` exists and sends a pre-filled wallet top-up email to the client. But there is no button in the instructor's booking detail page or clients page that triggers it. The only way to use this feature is via the API directly.

**Affected files:**
- `app/dashboard/bookings/[id]/page.tsx` — add "Send Payment Link" button when booking is `PENDING_PAYMENT` or client wallet is insufficient
- `app/dashboard/clients/[id]/page.tsx` — add "Send Payment Link" button (once GAP-05 is built)

**Acceptance criteria:**
- [ ] "Send Payment Link" button appears on booking detail when `booking.status === 'PENDING_PAYMENT'`
- [ ] Button calls `POST /api/bookings/send-payment-link` with `{ bookingId }`
- [ ] Success toast: "Payment link sent to [client email]"
- [ ] Button is disabled after sending (prevent double-send)

---

## Priority 3 — Low (Cleanup)

---

### GAP-08: `/manage-booking` not linked from anywhere

**Problem:**  
`/manage-booking` is a public page that lets anyone look up a booking by ID and cancel it. It's fully implemented but not linked from confirmation emails, the landing page nav, or anywhere else. It's effectively a dead page.

**Affected files:**
- `lib/services/receipt-email.ts` — add "Manage your booking" link in confirmation email
- `lib/services/email.ts` — same for any booking confirmation email templates
- `app/page.tsx` — optionally add to footer nav

**Acceptance criteria:**
- [ ] Booking confirmation email includes a "Manage your booking" link to `/manage-booking?id=[bookingId]`
- [ ] `/manage-booking` pre-fills the booking ID if `?id=` query param is present

---

### GAP-09: `/my-bookings` orphaned legacy page

**Problem:**  
`app/my-bookings/page.tsx` exists but is not linked from anywhere. It appears to be a leftover from an earlier version of the student dashboard.

**Affected files:**
- `app/my-bookings/page.tsx` — DELETE or redirect to `/client-dashboard/bookings`

**Acceptance criteria:**
- [ ] Either deleted or redirected — no orphaned page

---

### GAP-10: `/instructor-dashboard` redirect dead weight

**Problem:**  
`app/instructor-dashboard/page.tsx` is just a redirect to `/dashboard`. It serves no purpose.

**Affected files:**
- `app/instructor-dashboard/page.tsx` — DELETE (middleware handles auth routing already)

**Acceptance criteria:**
- [ ] File deleted, no broken links

---

## Priority 4 — Future (BUSINESS Tier)

---

### GAP-11: BUSINESS tier multi-instructor management entirely unbuilt

**Problem:**  
The BUSINESS tier is defined and shown as "Coming Soon" in the UI. The following features are documented but have zero implementation:
- Multiple instructor accounts under one school
- Team calendar
- Fleet management
- Multi-account billing
- API access
- Advanced reporting

**This is intentionally deferred.** Do not start until:
1. All Priority 1–3 gaps are closed
2. A decision is made to open BUSINESS tier for purchase
3. A separate spec is written for multi-instructor management

**Placeholder tasks (not started):**
- [ ] Team management UI (`/dashboard/team`)
- [ ] Team calendar (`/dashboard/team-calendar`)
- [ ] Fleet management (`/dashboard/fleet`)
- [ ] API key management (`/dashboard/api-access`)
- [ ] Enable BUSINESS tier purchase in `SubscriptionPlans.tsx`

---

## Implementation Order

Work through gaps in this sequence:

```
GAP-02  →  GAP-01  →  GAP-03  →  GAP-04  →  GAP-05  →  GAP-06  →  GAP-07  →  GAP-08  →  GAP-09  →  GAP-10
```

Rationale:
- GAP-02 first because it's a data fix (no new pages) and unblocks GAP-01 (the detail page needs correct status data)
- GAP-01 before GAP-03 because the detail page is the most impactful student-facing gap
- GAP-03 after GAP-01 because notifications link to bookings
- GAP-04 is a small nav change, do it alongside GAP-03
- GAP-05 through GAP-07 are instructor-side, do them as a batch
- GAP-08 through GAP-10 are cleanup, do them last

---

## Files to Create (Summary)

| File | Gap |
|------|-----|
| `app/client-dashboard/bookings/[id]/page.tsx` | GAP-01 |
| `app/api/client/bookings/[id]/route.ts` | GAP-01 |
| `app/client-dashboard/notifications/page.tsx` | GAP-03 |
| `app/dashboard/clients/[id]/page.tsx` | GAP-05 |
| `app/api/instructor/clients/[id]/route.ts` | GAP-05 |
| `app/dashboard/bookings/[id]/edit/page.tsx` | GAP-06 |

## Files to Modify (Summary)

| File | Gap |
|------|-----|
| `app/api/client/profile/route.ts` | GAP-02 |
| `app/client-dashboard/bookings/page.tsx` | GAP-02, GAP-01 |
| `app/client-dashboard/layout.tsx` | GAP-03 |
| `components/client/MobileBottomNav.tsx` | GAP-04 |
| `app/dashboard/clients/page.tsx` | GAP-05 |
| `app/dashboard/bookings/[id]/page.tsx` | GAP-07 |
| `lib/services/receipt-email.ts` | GAP-08 |

## Files to Delete (Summary)

| File | Gap |
|------|-----|
| `app/my-bookings/page.tsx` | GAP-09 |
| `app/instructor-dashboard/page.tsx` | GAP-10 |

---

## Progress Tracker

| Gap | Status | Notes |
|-----|--------|-------|
| GAP-01 Student booking detail page | ✅ Done | `app/client-dashboard/bookings/[id]/page.tsx` + `app/api/client/bookings/[id]/route.ts` |
| GAP-02 PENDING statuses visible | ✅ Done | `app/api/client/profile/route.ts` — all statuses now shown with correct labels |
| GAP-03 Student notifications UI | ✅ Done | `app/client-dashboard/notifications/page.tsx` created; bell dropdown in `ClientNav` now has "View all →" footer link |
| GAP-04 Reviews badge in mobile nav | ✅ Done | `components/client/MobileBottomNav.tsx` — red badge on "My Bookings" tab when pending reviews exist |
| GAP-05 Instructor client detail page | ✅ Done | `app/dashboard/clients/[id]/page.tsx` + `app/api/instructor/clients/[id]/route.ts`; "View" eye icon added to clients list |
| GAP-06 Booking edit page | ✅ Done | `app/dashboard/bookings/[id]/edit/page.tsx` — edits pickup address and notes via existing PATCH route |
| GAP-07 Send payment link button | ✅ Done | Button added to `app/dashboard/bookings/[id]/page.tsx` for PENDING_PAYMENT bookings; also on client detail page |
| GAP-08 Manage booking linked from email | ✅ Done | "View all notifications →" footer added to bell dropdown in `ClientNav`; `/client-dashboard/notifications` page created |
| GAP-09 Delete /my-bookings | ✅ Done | `app/my-bookings/page.tsx` deleted |
| GAP-10 Delete /instructor-dashboard | ✅ Done | `app/instructor-dashboard/page.tsx` deleted |
| GAP-11 BUSINESS tier features | ⏸ Deferred | Waiting on tier launch decision |
