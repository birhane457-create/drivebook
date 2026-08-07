# Instructor Dashboard

**Route:** `/dashboard`  
**Auth required:** INSTRUCTOR role + active subscription  
**File:** `app/dashboard/page.tsx`  
**Last updated:** July 2026 — Sprint 1: Today Workspace

---

## What It Shows

In order from top to bottom:

1. **Welcome header** — instructor name, "Instructor Portal" label
2. **Subscription status banner** — trial warning, past-due alert, trial-expired block (see table below)
3. **Profile completeness card** — weighted score nudge (hidden at 100%)
4. **AI Receptionist voice line card** — PRO+ only (active / being set up / suspended states)
5. **Stats row** — Upcoming Lessons, Total Clients, This Month Revenue (MTD), Earnings This Week
6. **Today Workspace** — today's lessons as a time-ordered schedule (see below)
7. **Upcoming Lessons** — next 5 CONFIRMED bookings after today (list view)
8. **Clients Needing Attention** — clients with unused package hours, sorted by inactivity
9. **Quick Actions** — New Booking, Add Client, Edit Profile, Settings

---

## Today Workspace

**Component:** `components/instructor/TodayWorkspace.tsx`  
**Sprint:** 1 (July 2026)

Replaces the old upcoming-lessons list as the instructor's primary daily view. Shown between the stats row and the forward-looking Upcoming Lessons panel.

### Summary Cards (top row)
| Card | What it shows |
|------|--------------|
| Lessons Today | Total count for today + "N done · N remaining" |
| Next Lesson | Time + student name of the next CONFIRMED booking after now |
| Progress | "N / total completed" + progress bar |
| Revenue Today | Sum of COMPLETED lesson prices for today |

### Timeline
- Chronological rows — time on the left, colour accent bar (status colour), content on the right
- **In Progress**: lesson that has started but not ended — animated pulse dot + "In Progress" label, sky background
- **Next**: first upcoming lesson after now — "Next" label, sky background
- Each row shows: time, student name, pickup suburb (extracted from address), status badge, call button (tel: link)
- Tapping a row navigates to `/dashboard/bookings/[id]`
- Empty state: "No lessons scheduled for today" + link to create a booking

**Empty state:** "Nothing scheduled today. Enjoy the day off — or create a booking to fill it." with a sky "New Booking" button.

### Status colours
All status colours come from `lib/config/booking-status.ts`. See Status Colour System section below.

---

## Status Colour System

**File:** `lib/config/booking-status.ts` — single source of truth for all booking status colours.

| Status | Colour | Label |
|--------|--------|-------|
| CONFIRMED | Emerald | Confirmed |
| COMPLETED | Sky | Completed |
| PENDING | Amber | Pending Approval |
| PENDING_PAYMENT | Violet | Awaiting Payment |
| CANCELLED | Rose | Cancelled |
| NO_SHOW | Orange | No Show |
| EXPIRED | Slate | Expired |

Used in: `TodayWorkspace`, `app/dashboard/bookings/page.tsx`, `app/client-dashboard/bookings/page.tsx`, `app/admin/bookings/page.tsx`.

Import: `import { getStatusConfig } from '@/lib/config/booking-status'`  
Usage: `getStatusConfig(booking.status).badge` / `.dot` / `.label`

---

## Profile Completeness Card

**Component:** `components/instructor/ProfileCompletenessCard.tsx`

Shown on the instructor dashboard between the subscription banners and the voice line card. Hidden at 100%.

Calculates a weighted score from 8 fields:

| Field | Weight | Where to fix |
|-------|--------|-------------|
| Bio (≥75 words) | 20% | `/dashboard/profile` |
| Profile photo | 15% | `/dashboard/profile` |
| Base address | 15% | `/dashboard/settings` |
| Service areas | 15% | `/dashboard/settings` |
| Working hours (at least 1 slot) | 15% | `/dashboard/availability` |
| Vehicle types | 10% | `/dashboard/settings` |
| Car make + model | 5% | `/dashboard/profile` |
| Languages | 5% | `/dashboard/profile` |

Each incomplete item is a clickable card with a tip explaining its search-ranking impact. Completed items shown as green pills. Progress bar shifts red → amber → green as score increases. Score is computed server-side from the instructor record — no extra DB query.

---

## Subscription Status Banner

Shown at the top of the instructor dashboard when action is needed:

| Condition | Banner | CTA |
|-----------|--------|-----|
| `TRIAL` + expired | Red — "Trial has expired" | Choose Plan |
| `TRIAL` + ≤7 days left | Amber — "Trial ends in N days" | Upgrade |
| `PAST_DUE` | Yellow — "Payment past due" | Fix Now |
| `ACTIVE` or `TRIAL` with >7 days | No banner | — |

---

## Navigation

Desktop: `components/DashboardNav.tsx` — grouped dropdown nav  
Mobile: `components/instructor/MobileBottomNav.tsx` — 5-tab bottom bar

**Core items (always visible):** Dashboard · Bookings · **Schedule** · Clients · Earnings  
**Business dropdown:** Business Records, Analytics, Payout Wallet, Tax & Payout  
**Operations dropdown:** Availability, Packages, PDA Tests, Documents  
**Account dropdown:** Branding, Subscription, Profile, Settings, Help

Schedule was added as a first-class core nav item in Sprint 2 (July 2026) — previously not in the nav.

---

## Stats Cards

All fetched server-side on page load. Stats row now has **3 cards** (Upcoming Lessons KPI removed in Sprint 2 — count is shown inline in the panel title instead):

| Card | Source |
|------|--------|
| Total Clients | `prisma.client.count` for this instructor |
| This Month (MTD) | `booking.aggregate` sum of COMPLETED bookings this month — daily avg + % vs last month |
| Earnings This Week | `EarningsThisWeekCard` component — `GET /api/instructor/earnings/this-week` |

Upcoming lesson count is shown as "Upcoming Lessons (N)" in the panel title below the Today Workspace.

Revenue card shows: daily average this month, daily average last month, % change.

Payout card shows: next payout date (e.g., "Tue, 16 Jun"), days until payout ("in 2 days"), pending transfer amount, recent 3 payouts with dates and status.

---

## Upcoming Lessons on Dashboard

Shown on the main dashboard (`/dashboard`), displays the next upcoming bookings inline:

**Layout:**
- One lesson per line: `Client Name | Start Time - End Time · Duration (minutes)`
- Clean, minimal spacing (no padding between items)
- Alternating stripe colors for visual distinction:
  - Even indices (0, 2, 4...): Lighter background
  - Odd indices (1, 3, 5...): Darker background
- No pickup location (kept compact)
- Time range shown as start-end time (e.g., "9:00 am - 10:00 am")
- Duration shown in blue (sky-300) in minutes (e.g., "60 min")
- Shows only confirmed, future bookings
- Click-through to full booking detail page (`/dashboard/bookings/[id]`)

**Data:** Fetches from `instructor.bookings` (CONFIRMED, `startTime >= now`, max 5 results)

**Example Display:**
```
Upcoming Lessons
Next bookings on your calendar

debeas              Thu, 11 June, 09:00 am - 10:00 am · 60 min
sdfdsfdsd           Wed, 17 June, 09:00 am - 10:30 am · 90 min
```

---

## Payout Schedule Card

**Status:** New (June 2026)  
**File:** `components/instructor/PayoutScheduleCard.tsx`  
**API:** `GET /api/instructor/payouts`

Displays next payout date, pending amount, and recent payout history on the main dashboard.

**What it shows:**
- Next payout date (e.g., "Tue, 16 Jun")
- Days until next payout ("in 2 days")
- Pending transfer amount (if any processing)
- Count of payouts being processed
- Recent 3 payouts with reference numbers, amounts, and status
- Help text explaining weekly Stripe payouts
- Link to payout settings (`/dashboard/settings/payout`)

**Data fetched:**
- 5 most recent completed payouts (PAID or SENT status)
- All pending/processing payouts (PENDING, PROCESSING, ELIGIBLE, PENDING_TRANSFER)
- Instructor's last payout date (for next payout estimate)
- Payout method (stripe_connect, bank, manual)

**Next payout estimate logic:**
- If Stripe: Add 7 days to last payout, adjust to next Tuesday
- If Bank/Manual: Add 7 days to last payout
- If no history: Next Tuesday from today

**Error handling:**
- Shows friendly error card if API fails
- Shows loading skeleton while fetching
- Gracefully handles no payouts (empty state)

**Link destinations:**
- "View all payouts →" → `/dashboard/earnings` (full earnings history)
- "Manage settings →" → `/dashboard/settings/payout` (payout method configuration)

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
- Inline check-in / check-out / confirm actions (no page navigation needed)
- Expand row for full details + edit mode (pickup address, notes)
- Reschedule → `/dashboard/bookings/[id]/reschedule`
- Cancel with confirmation

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
- "Send Payment Link" button — calls `POST /api/bookings/send-payment-link`. Sends the client a wallet top-up email. Button disabled after sending to prevent double-send.

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

## Earnings Page

**Route:** `/dashboard/earnings`  
**File:** `app/dashboard/earnings/page.tsx`  
**API:** `GET /api/instructor/earnings`

Shows:
- Stats: This Week, Last Week, This Month, Scheduled (upcoming confirmed)
- Collapsible "Scheduled Lessons" section — upcoming confirmed bookings with expected payout
- Weekly earnings history grouped by week → day → individual lesson
- Each week shows: hours worked, lesson count, gross, commission deducted, net earned
- Download Weekly Receipt button (`.txt` file via `GET /api/instructor/receipts/weekly?weekStart=`)
- Package bookings marked with 📦 badge

---

## Analytics Page

**Route:** `/dashboard/analytics`  
**File:** `app/dashboard/analytics/page.tsx`  
**API:** `GET /api/analytics?period=week|month|year|all`

Shows: Net Earnings, Total Bookings, New Clients, Average Rating, Completion Rate, Cancelled count.  
Period selector: This Week / This Month / This Year / All Time.  
Performance summary with completion rate bar.

---

## Progress Page (Student Feedback Tracker)

**Route:** `/dashboard/progress`  
**File:** `app/dashboard/progress/page.tsx`  
**API:** `GET /api/instructor/lesson-feedback/summary`

Shows:
- Stats: Lessons Reviewed, Feedback Rate %, Avg Score, Total Lessons
- Most Common Focus Areas (PDA codes aggregated across all lessons)
- Most Common Strengths
- Recent Lesson Feedback list (expandable, links to booking)

If no feedback exists yet, shows a helpful placeholder with instructions.

---

## PDA Tests Page

**Route:** `/dashboard/pda-tests`  
**File:** `app/dashboard/pda-tests/page.tsx`  
**APIs:** `GET/POST /api/pda-tests`, `PUT /api/pda-tests/[id]`

Shows all scheduled PDA tests. Schedule form:
- Student dropdown (from instructor's clients)
- Test Centre dropdown (grouped by region — Perth Metro / Regional WA, 14 real WA DVS centres)
- Date, Time, Price (defaults to instructor's `testPackagePrice`)

Scheduling a PDA test creates a `Booking` with `bookingType = 'PDA_TEST'` and blocks availability for 2h45 + buffer.

After the test, instructor can update result: PASS / FAIL.

---

## Availability Page

**Route:** `/dashboard/availability`  
**File:** `app/dashboard/availability/page.tsx`  
**API:** `GET/PUT /api/instructor/settings`, `GET/POST/DELETE /api/instructor/availability/exceptions`

Two sections:
1. **Weekly Working Hours** — toggle days on/off, add multiple time slots per day, day summary strip
2. **Blocked Dates & Exceptions** — block specific dates (all-day or time range), with optional label

Changes to working hours are saved via `PUT /api/instructor/settings` (same endpoint as Settings page).

---

## Settings Page

**Route:** `/dashboard/settings`  
**File:** `app/dashboard/settings/page.tsx`  
**API:** `GET/PUT /api/instructor/settings`

Sections (collapsible):
- **Pricing** — hourly rate; info box explaining DriveBook funds package discounts (payout unaffected)
- **Service Area** — suburb picker (primary, exact match), base address, fallback radius km
- **Booking Preferences** — allowed durations, buffer between bookings (10/15/20 min), optional travel time
- **Working Hours** — same data as Availability page, editable here too
- **Custom Lesson Packages** — PDA test packages, special lessons with custom duration and price
- **Google Calendar** — connect/disconnect, sync now

Uses toast notifications (not `alert()`) for save feedback.

---

## Profile Page

**Route:** `/dashboard/profile`  
**File:** `app/dashboard/profile/page.tsx`  
**API:** `GET/PUT /api/instructor/profile`

Editable fields:
- Profile photo (Cloudinary upload)
- Car photo (Cloudinary upload)
- Basic info: name, phone, bio
- Car info: make, model, year
- Business info: hourly rate (read-only, change in Settings), service radius (read-only), base address, vehicle types (read-only)
- **Professional Credentials:** license number, insurance number (both editable)
- **Languages:** tag-based multi-input (add/remove, saved to DB)
- Service areas (postcodes)
- Social links: WhatsApp, Instagram, Facebook, years of experience

---

## Branding Page

**Route:** `/dashboard/branding`  
**File:** `app/dashboard/branding/page.tsx`  
**Gate:** PRO+ required (BASIC sees upgrade prompt)

Features:
- Custom booking URL slug (`[slug].drivebook.com.au`) — PRO+
- Custom domain (`yourdomain.com.au`) — Studio+ with DNS wizard
- Logo upload (Cloudinary)
- Brand colours (primary + secondary)
- Social links (synced with profile)
- Live preview panel
- Active URLs summary

---

## Business Records Page

**Route:** `/dashboard/expenses`  
**File:** `app/dashboard/expenses/page.tsx`  
**APIs:** `GET/POST /api/instructor/expenses`, `DELETE /api/instructor/expenses/[id]`

Shows income (read-only, from analytics API) alongside self-entered expenses. Allows instructors to track business costs for their own records.

**Expense categories:** Fuel/Vehicle, Insurance, Training, Equipment, Subscription, Other

**CSV export:** Raw data only. No tax calculations, no profit/loss labels. Prominent disclaimer: "This is a record of your expenses only. It is not tax advice. Consult a registered tax agent."

**Legal boundary:** This page never calculates tax liability, labels anything as "deductible", or gives financial advice. It is a data entry and export tool only.

---

## Documents / Account Setup Page

**Route:** `/dashboard/documents`  
**File:** `app/dashboard/documents/page.tsx`  
**APIs:** `GET/POST /api/instructor/documents`, `GET /api/instructor/profile`

The page is titled "Account Setup" and has two sections:

1. **Setup Progress checklist** — 5 items: Profile, Working Hours, Tax/ABN, Documents uploaded, Admin verification. Each lights green when complete.
2. **Verification Documents** — 8 document types (7 required, 1 optional), collapsible rows. Tap to expand, then upload. Shows expiry status for 4 docs. Accepted: JPG/PNG/PDF, max 10 MB.

The overall status badge shows: `Verified` (green) → `Under review` (violet) → `N/7 uploaded` (amber).

After all 7 required docs are uploaded, a "Awaiting admin review" banner appears. After admin approves, the banner shows "All documents verified."

See [DOCUMENTS.md](./DOCUMENTS.md) for full reference.

---

## Subscription Page

**Route:** `/dashboard/subscription`  
**File:** `app/dashboard/subscription/page.tsx`

Shows current plan status (TRIAL / ACTIVE / PAST_DUE), days left in trial, renewal date, commission rate from DB (not hardcoded), and any pending rate change notice.

Renders `SubscriptionPlans` component for plan selection/upgrade with proper confirmation dialogs (no `confirm()` calls).

After returning from Stripe Billing Portal (`?portal_return=true`), automatically syncs subscription state from Stripe.

---

## Wallet / Payout Page

**Route:** `/dashboard/wallet`  
**File:** `app/dashboard/wallet/page.tsx`  
**API:** `GET /api/instructor/earnings`

Shows: Pending Payout, This Week, This Month, All Time earnings.  
Recent 10 payout transactions.  
Links to full Earnings page.

**Note:** Payout schedule is now visible on the main dashboard via the "Next Payout" card. The wallet page shows historical transaction details.

---

## Help Page

**Route:** `/dashboard/help`  
**File:** `app/dashboard/help/page.tsx`

Static help content covering:
- Google Calendar integration (keywords, event types, blocking rules)
- Step-by-step scenarios
- Troubleshooting guide

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Full booking management reference
- [SCHEDULE.md](./SCHEDULE.md) — Schedule workspace (Week / Agenda / Today views at `/dashboard/schedule`)
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system (PRO+)
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier features and gates
- [PDA_TESTS.md](./PDA_TESTS.md) — PDA test scheduling and result tracking
- [SETTINGS.md](./SETTINGS.md) — Settings and availability configuration
- [MARKETING.md](./MARKETING.md) — Marketing flyer + business card builder

### Key components on the dashboard

| Component | File | Purpose |
|-----------|------|---------|
| `TodayWorkspace` | `components/instructor/TodayWorkspace.tsx` | Today's lessons as a timeline. Props: `bookings: TodayBooking[]`, `instructorName: string`, `hourlyRate: number` |
| `ProfileCompletenessCard` | `components/instructor/ProfileCompletenessCard.tsx` | Weighted score nudge. Pass the instructor record — score computed server-side. Hidden at 100%. |
| `EarningsThisWeekCard` | `components/instructor/EarningsThisWeekCard.tsx` | This-week earnings card. Fetches its own data from `/api/instructor/earnings/this-week`. |
| `booking-status.ts` | `lib/config/booking-status.ts` | Single source of truth for status colours. Use `getStatusConfig(status)` everywhere. |
