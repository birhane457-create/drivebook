# Instructor Dashboard

**Route:** `/dashboard`  
**Auth required:** INSTRUCTOR role + active subscription  
**File:** `app/dashboard/page.tsx`  
**Last updated:** May 2026

---

## What It Shows

- Subscription status banner (trial warning, past-due alert, trial-expired block)
- Today's upcoming bookings (next 5, CONFIRMED only)
- Stats: Upcoming Lessons, Total Clients, This Month Revenue (MTD with daily avg + % vs last month), Hourly Rate
- "Clients Needing Attention" — clients with unused package hours, sorted by inactivity
- Quick Actions: New Booking, Add Client, Edit Profile, Settings

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

**Desktop layout (May 2026 redesign):**
- Core (always visible): Dashboard / Bookings / Clients / Earnings
- Business dropdown: Business Records, Analytics, Payout Wallet, Tax & Payout
- Operations dropdown: Availability, Packages, PDA Tests, Documents
- Account dropdown: Branding, Subscription, Profile, Settings, Help

**Mobile tabs:** Home / Bookings / Clients / Earnings / PDA Tests

---

## Stats Cards

All fetched server-side on page load:

| Card | Source |
|------|--------|
| Upcoming Lessons | `instructor.bookings` (CONFIRMED, future, next 5) |
| Total Clients | `prisma.client.count` for this instructor |
| This Month (MTD) | `booking.aggregate` sum of COMPLETED bookings this month |
| Hourly Rate | `instructor.hourlyRate` |

Revenue card also shows: daily average this month, daily average last month, % change.

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
- **Pricing** — hourly rate
- **Service Area** — radius in km
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
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system (PRO+)
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md) — Tier features and gates
- [PDA_TESTS.md](./PDA_TESTS.md) — PDA test scheduling and result tracking
- [SETTINGS.md](./SETTINGS.md) — Settings and availability configuration
- [INSTRUCTOR_DASH_GAP_ANALYSIS.md](./INSTRUCTOR_DASH_GAP_ANALYSIS.md) — Gap analysis and fix log
