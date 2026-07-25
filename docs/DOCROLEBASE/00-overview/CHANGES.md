# DriveBook — Change Log

---

## Session: 2026-07-25 — Session 3 Audit Fixes (Student Dashboard + Instructor Bookings)

### Summary
Third audit pass covering student/client dashboard, instructor bookings page, admin payouts BSB masking, and wallet API. 6 confirmed issues fixed; C-01 confirmed already done.

### Fixes

**NF-01 — 6 `window.confirm()` on instructor bookings page**
`app/dashboard/bookings/page.tsx`
- Check-in, check-out, cancel, delete, confirm, save edit all used `window.confirm()` — blocked on mobile WebView
- Fix: `PendingAction` type + `requestConfirm()` pattern; single inline modal overlay handles all 6 actions

**NF-02 — `en-US` locale on instructor bookings page**
`app/dashboard/bookings/page.tsx`
- 3 date/time formats used `en-US` — `Jul 25` instead of `25 Jul`, 12-hour AM/PM instead of 24-hour
- Fix: changed to `en-AU` throughout

**NF-03 — Full BSB visible in admin payouts list table (resolves P-02)**
`app/admin/payouts/page.tsx`
- BSB shown unmasked in list table alongside masked account number
- Fix: list table now shows `•••-XXX` (last 3 digits); `MarkSentModal` retains full BSB since admin needs it for the transfer

**NF-04 — Student bookings tab counts from page slice**
`app/client-dashboard/bookings/page.tsx`
- Tab badge "Upcoming (3)" was computed from current page only, not full dataset
- Fix: uses `profile.upcomingCount` and `profile.pastCount` from API

**NF-05 + NF-06 — Wallet API: unbounded query + dead `totalBookedHours`**
`app/api/client/wallet/route.ts`
- Loading ALL confirmed transactions on every wallet page visit (no `take` limit)
- `totalBookedHours` computed via a separate booking query but never rendered in the wallet UI
- Fix: balance via two `aggregate()` calls; recent transactions with `take: 20`; removed dead booking query

**C-01 — Confirmed already fixed (not a change this session)**
`app/book/[instructorId]/book-type/page.tsx`
- Inline `validationError` state with `role="alert"` was already in place; audit doc updated

### Files changed
- `app/dashboard/bookings/page.tsx`
- `app/admin/payouts/page.tsx`
- `app/client-dashboard/bookings/page.tsx`
- `app/api/client/wallet/route.ts`

---

## Session: 2026-07-25 — Full Audit Fixes (Reliability, Data Integrity, Type Safety)

### Summary
Full re-audit of the codebase against the COMBINED_AUDIT_REPORT.md. 10 confirmed issues fixed. 7 architectural items deferred (documented in TODO.md under "Post-audit deferred").

### Data Integrity Fixes

**P1-A — Reschedule route: wallet + booking now atomic**
`app/api/client/bookings/[id]/reschedule/route.ts`
- `walletTransaction.create` and `booking.update` were separate writes
- Mid-flight failure left wallet adjusted but booking unchanged
- Fix: both writes now inside a single `$transaction` with TOCTOU balance re-check inside the transaction

**P1-B — `confirm-package-booking`: wallet drift + phantom fields**
`app/api/client/confirm-package-booking/route.ts`
- Was writing to `ClientWallet.totalSpent` and `creditsRemaining` — fields that don't exist in schema
- No `WalletTransaction` record was created, so `getWalletBalance()` (ledger-derived) was never updated
- Three separate writes (booking confirm, package hours update, wallet) were not atomic
- Fix: all three writes in one `$transaction`; phantom field writes replaced with `WalletTransaction` DEBIT + `balance.decrement`

**P3-A — `payments/verify`: wallet pairs now atomic**
`app/api/payments/verify/route.ts`
- CREDIT + DEBIT `walletTransaction.create` calls were sequential separate writes in both POST and GET
- A failure between them left a dangling CREDIT with no DEBIT
- Fix: both creates inside a single `$transaction` in both handlers

### Reliability Fixes

**P2-A — Dashboard layout: misleading PENDING banner on DB failure**
`app/dashboard/layout.tsx`
- `approvalStatus ?? 'PENDING'` fallback showed "account is pending" even if the DB was simply unreachable
- Fix: fallback changed to `null`; banner only renders when a real non-approved status is returned

**P2-B — Instructor dashboard: `instructor` query separated from supplementary batch**
`app/dashboard/page.tsx`
- Single `Promise.all` with 8 queries — `instructor` had no `.catch()`, so any query failure crashed the entire page
- Fix: `instructor` runs first in isolation with `.catch(() => null)` → redirect on failure; the 7 supplementary queries run in a second `Promise.all` each individually guarded with `.catch()` fallbacks

**P2-C — Admin dashboard: zeros indistinguishable from real data on query failure**
`app/admin/page.tsx` + `components/admin/AdminDashboardTabs.tsx`
- Outer `try/catch` only logged to console; page rendered zeros silently
- Fix: `dataUnavailable = true` set in catch; `AdminDashboardTabs` shows a red "data temporarily unavailable" banner when set

### Security / Defence-in-Depth

**P3-B — Rate limiting on payout resolve route**
`app/api/admin/payouts/resolve/route.ts`
- No rate limiting on financial mutations; only auth check
- Fix: wired `payoutRateLimit` (5/min per admin, existing in `lib/ratelimit.ts`); added after auth check

**P3-C — Critical env variable validation at startup**
`instrumentation.ts` (new file) + `next.config.js`
- No startup validation; a misconfigured env var silently broke deep in a request handler
- Fix: Next.js instrumentation hook validates `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` on server start. Format-checks each value. Hard-fails in production, warns in development.

### Type Safety

**P3-D — `prisma as any` cleanup**
- `npx prisma generate` run to refresh generated client types
- Removed `(prisma as any)` casts from 41 files where the model IS in `schema.prisma`: `auditLog`, `transaction`, `walletTransaction`, `stripeDispute`, `payout`, `ledgerEntry`, `cronHealth`, `instructor`, `webhookEvent`, `subscription`, `clientWallet`
- One silent bug fixed in the process: `confirm-package-booking` was calling `(prisma as any).wallet.update` — no such model; corrected to `prisma.clientWallet.update` via correct relation path
- Remaining `(prisma as any)` casts are documented custom tables not in schema.prisma: `notificationRetry`, `waitingList`, `bookingIdempotencyKey`, `testCentre`, `instructorExpense`, `availabilityException`, `reconciliationReport`, `financialLedger`, `adminBrief`

### Files changed (primary)
- `app/api/client/bookings/[id]/reschedule/route.ts`
- `app/api/client/confirm-package-booking/route.ts`
- `app/api/payments/verify/route.ts`
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/admin/page.tsx`
- `components/admin/AdminDashboardTabs.tsx`
- `app/api/admin/payouts/resolve/route.ts`
- `instrumentation.ts` (new)
- `next.config.js`
- 41 service/route files — `prisma as any` casts removed

---



### Summary
Fixed all 7 bugs from the DASH_GAPS.md priority list. All files pass diagnostics with zero errors.

### Bugs Fixed

| # | ID | File(s) |
|---|---|---|
| 1 | BUG-1 | Earnings "This Week" card showed gross lesson price, not net instructor payout. API now sums `instructorPayout` (falls back to `price × (1 - commissionRate)`, then `× 0.85` for very old bookings). |
| 2 | BUG-2 | `weekStartDisplay`/`weekEndDisplay` were `MM/DD` (US). Now `DD/MM` (AU). |
| 3 | DATA-3/4 | Per-booking breakdown in `EarningsThisWeekCard` showed gross price and a wrong `N × $rate = total` formula label. Card now shows net payout per booking and a plain lesson count label. |
| 4 | BUG-3 | Profile page had 5 `alert()` calls for upload/save/service-area errors. Replaced with a toast notification (same pattern as settings page). Added `CheckCircle`/`AlertCircle` icons and `showToast()` helper. |
| 5 | BUG-4 | PDA config deletion in settings used `window.confirm()`. Replaced with an inline amber confirm row (`pdaDeleteConfirmId` state) — accessible, mobile-safe, consistent with the rest of the app. |
| 6 | BUG-5/DATA-2 | Dashboard "Upcoming Lessons" panel included today's lessons (already shown in TodayWorkspace). Changed `startTime: { gte: now }` → `startTime: { gt: endOfToday }`. Panel description "Next bookings after today" now accurate. |
| 7 | BUG-6 | `ProfileCompletenessCard` bio check was `bio.trim().length > 30` chars. Profile page enforces 75 words. Now consistent: `bio.split(/\s+/).length >= 75`. Tip text updated to mention the 75-word requirement. |
| 8 | UX-4 | `PendingApprovalBanner` defaulted all non-APPROVED statuses to the "pending approval" blue banner — including SUSPENDED accounts which got a misleading message. Added explicit `SUSPENDED` case with amber styling and "Contact Support" CTA. Also added `mb-4` spacing to all banner variants. |
| 9 | BUG-7 | Client search on `/dashboard/clients` was client-side filtering only — couldn't find clients on page 2+. Added `search` query param to `GET /api/clients` (Prisma `contains insensitive` on name/email/phone). Page now debounces 300ms and resets to page 1 on each search. Removed redundant `filteredClients` local filter. |
| 10 | DATA-1 | `FindNextSlot` made up to 21 sequential API calls (7 days × 3 durations, each awaited). Rewritten to fire all 21 fetches in one `Promise.all`, then sort results chronologically. Worst-case latency drops from ~4s to ~200ms. |

### Files changed
- `app/api/instructor/earnings/this-week/route.ts`
- `components/instructor/EarningsThisWeekCard.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/profile/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/clients/page.tsx`
- `app/api/clients/route.ts`
- `components/instructor/ProfileCompletenessCard.tsx`
- `components/instructor/PendingApprovalBanner.tsx`
- `components/instructor/FindNextSlot.tsx`

---

## Session: 2026-07-22 — Instructor Dashboard Deep Inspection + Gap Analysis

### Summary
Full deep inspection of the instructor dashboard — all 15 pages, 15 components, 29+ API routes, admin instructor management, and all related docs. Created `docs/DOCROLEBASE/03-instructor/DASH_GAPS.md` recording 27 identified gaps across 6 categories.

### Gaps recorded (27 total)

| Severity | Count | Examples |
|---|---|---|
| 🔴 Critical bugs | 3 | EarningsCard shows gross not net; date format US not AU; profile `alert()` |
| 🟠 High | 2 | Double booking fetch on dashboard; stale Prisma client |
| 🟡 Medium | 10 | Client search client-side only; bio threshold mismatch; FindNextSlot 21 serial calls; PayoutScheduleCard missing |
| 🟢 Low | 12 | Perth TZ hardcoded; confirm() dialogs; docs gaps |

**Files created:**
- `docs/DOCROLEBASE/03-instructor/DASH_GAPS.md` — full gap register with fix instructions and recommended fix order

**No code changed in this session.** All findings recorded for implementation in the next sprint.

---

## Session: 2026-07-22 — VAPI System Prompt — displayName Update

### Summary
Updated all instructor name references in the VAPI system prompt from `[name]`/`instructor.name` to `[displayName]`. For BUSINESS accounts, `displayName` is the school name (e.g. "Perth Drive Academy"); for individual instructors it's their personal name or trading name. This was the deferred VAPI update from Task 10.

**Files changed:** `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md`

**Changes:**
- Step 3 (ONE INSTRUCTOR RULE): `[name]` → `[displayName]`
- Step 3 (MULTIPLE INSTRUCTORS): `[name]` → `[displayName]`
- Step 4 (getPackages script): `instructor.name` → `displayName`
- Step 8b (service area out-of-range): `[instructor name]`/`[name]` → `[displayName]`
- Step 9 (confirmation script): `Instructor: [name]` → `Instructor: [displayName]`
- Step 10 (instructorQuery fallback): `[instructor name]` → `[displayName]`
- CONVERSATION STATE: `instructor_name` → `instructor_displayName` with BUSINESS note
- EXAMPLE 1 dialogue: `[API name]`/`[name]` → `[API displayName]`/`[displayName]` in findInstructors response and confirmation script

⚠️ **Action required:** Re-upload this prompt to VAPI dashboard. The built file should be generated first with real `SUPPORT_PHONE` and `SUPPORT_EMAIL` values via `node scripts/build-vapi-prompt.js` in `drivebook-hybrid/`.

---

## Session: 2026-07-22 — Booking Flow Audit + Bug Fixes

### Summary
Deep audit of the public booking wizard. Found and fixed 4 bugs including one critical (Book Later completely broken). Added slot countdown timer to payment page.

---

### Bug 1 — CRITICAL: Book Later flow was broken in main app

**`app/book/[instructorId]/payment/page.tsx`**

The payment page for Book Later was expecting `bookingResult.transactionId` but the bulk API actually returns `{ checkoutUrl, ... }` — no `transactionId` in the Book Later response. The route creates a Stripe Checkout Session, not a PaymentIntent, so there is no transaction to create an intent for.

Every Book Later attempt threw `"Missing transactionId from booking response"` — the path was completely broken.

**Fix:** Book Later now detects `bookingResult.checkoutUrl` and redirects directly to it via `window.location.href`. No PaymentIntent step needed — Stripe hosts the entire payment on their checkout page. Book Now path unchanged.

---

### Bug 2 — HIGH: `alert()` in registration page

**`app/book/[instructorId]/registration/page.tsx`**

`validateForm()` used `alert()` for all 7 validation errors. Blocks UI thread, inaccessible, terrible mobile UX.

**Fix:** Added `validationError` state. All 7 `alert()` calls replaced with `setValidationError()`. Error rendered as inline red banner below the RegistrationForm, matching the pattern in every other step.

---

### Bug 3 — MEDIUM: Confirmation page hardcoded step number

**`app/book/[instructorId]/confirmation/page.tsx`**

`<MultiStepBookingLayout currentStep={3}>` was hardcoded. When `offersTestPackage = true`, the wizard has one extra step, so the indicator was highlighting the wrong step.

**Fix:** Dynamic calculation: `bookingType === 'now' ? (offersTestPackage ? 6 : 5) : (offersTestPackage ? 5 : 4)`

---

### Bug 4 — LOW: No slot countdown on payment page

**`app/book/[instructorId]/payment/page.tsx`**

Slots are held for 10 minutes (server-side `SlotReservation`). The confirmation page warned about this, but the payment page showed no timer — students could unknowingly take too long and hit a `BOOKING_EXPIRED` error mid-payment.

**Fix:** Added a countdown timer state (`slotSecondsLeft`, 10 × 60 seconds) that ticks every second. Displayed as a colour-coded badge on the scheduled lessons card: green → amber (≤3 min) → red (≤1 min). Only shown when `scheduledBookings.length > 0` (Book Now with slots).

---

### Remaining known bugs (deferred — see TODO)

- **Bug 5 (by design):** Only the first scheduled lesson creates a `Booking` DB row. Multiple slots in one package flow — remaining are stored as `packageHoursRemaining`, students schedule from dashboard post-payment. This is intentional product design, not a bug.

---

## Session: 2026-07-22 — Payout System Audit + Bug Fixes

### Summary
Deep audit of payout system. Found and fixed 5 bugs. Built the missing instructor payouts API. Rewrote both payout docs.

---

### Bugs Fixed

**`lib/services/payout-service.ts` — Bug 1: buffer always 24h**
- `buildPayout()` was hardcoding `PAYOUT_BUFFER_HOURS = 24`
- The cron used `PlatformSettings.lateCancellationWindowHours × 2` (dynamic, default 48h)
- Three different values in the codebase for the same concept
- Fix: added `getPayoutBufferHours()` helper that reads from `PlatformSettings`; `buildPayout()` now calls it

**`app/api/admin/payouts/process-all/route.ts` — Bug 2: no `payoutHold` check**
- "Process All Eligible" admin button was missing the `payoutHold` check
- Would attempt payout for instructors with active dispute holds, then error in `buildPayout()`
- Fix: added `payoutHold` check alongside ABN check; returns `SKIPPED` cleanly with reason

**`app/api/admin/payouts/resolve/route.ts` — Bug 3: `referenceId` field doesn't exist**
- `walletTransaction.create` was using `referenceId: transactionId`
- `WalletTransaction` schema has `bookingId`, not `referenceId`
- Would throw a Prisma runtime error on every dispute refund to client wallet
- Fix: changed to `bookingId: txn.bookingId`

**`app/dashboard/earnings/page.tsx` — Bug 4: wrong payout day**
- Footer told instructors "Payouts processed weekly on Fridays"
- Cron runs Tuesday 2am AWST, not Friday
- Fix: updated to "Payouts processed automatically every Tuesday morning (AWST)"

**`app/api/instructor/payouts/route.ts` — Bug 5: empty directory**
- The `/api/instructor/payouts` directory existed but contained no `route.ts`
- Documented in PAYOUTS.md and referenced by `PayoutScheduleCard` — was a 404 in production
- Fix: created full implementation returning payout history, pending payouts, next payout date, connection status

---

### Docs Rewritten

**`docs/DOCROLEBASE/03-instructor/PAYOUTS.md`** — complete rewrite
- Accurate payout schedule (Tuesday, not Friday)
- Correct buffer hours (48h dynamic from DB, not 24h hardcoded)
- Full payout state machine documented (ELIGIBLE → PROCESSING → PAID/FAILED, bank sub-states)
- Post-payout refund clawback mechanism documented
- `GET /api/instructor/payouts` response shape documented
- What instructors can vs cannot see

**`docs/operations/02-finance.md`** — complete rewrite
- Full admin payout page (4 tabs: Eligible, Manual Transfers, Withheld, Disputes)
- Resolve modal actions (5 actions) with effects
- `PAYOUT_BATCH_SIZE` env var note
- Failed payouts — no auto-retry, admin must retry manually
- Weekly manual transfer reminder — bank/manual instructors NOT auto-processed
- Post-payout refund clawback
- Governance threshold note: policy only, not enforced in code

---

## Session: 2026-07-22 — Document System Audit + Expiry Bug Fix

### Summary
Deep audit of both instructor-facing and admin-facing document management. Found and fixed a critical expiry data storage bug. Updated 6 stale doc files. Created the missing DOCUMENTS.md for instructors.

---

### 1. Expiry Date Storage Bug — Fixed

**Root cause:** The schema has dedicated `licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry` DateTime columns that were never written to. The expiry save API was writing into `workingHours.expiry` JSON instead, causing the real columns to always be null.

**`app/api/admin/documents/instructor/[instructorId]/expiry/route.ts`**
- Now writes to **both** the real DateTime columns AND `workingHours.expiry` JSON (dual-write for backward compat)
- Real columns become the primary source going forward

**`app/api/admin/documents/compliance/route.ts`**
- Now selects `licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry` real columns
- Falls back to `workingHours.expiry` JSON for records saved before this fix

**`app/api/admin/documents/instructor/[instructorId]/route.ts`**
- Same: reads real columns first, JSON fallback

---

### 2. Documentation Fixes

**Created `docs/DOCROLEBASE/03-instructor/DOCUMENTS.md`** (was missing)
- Full reference for `/dashboard/documents` (Account Setup page)
- 5-step checklist items and conditions
- 8 document types table (required/optional, expiry tracked)
- Upload flow, expiry display, next-step banner logic, post-upload pipeline

**`docs/DOCROLEBASE/03-instructor/DASHBOARD.md`**
- Added "Documents / Account Setup Page" section before Subscription Page section

**`docs/DOCROLEBASE/03-instructor/ONBOARDING_APPROVAL.md`**
- Fixed Step 2: document upload is at `/dashboard/documents`, not `/setup/complete-profile`
- Added `photoIdDoc` to admin verification checklist

**`docs/operations/04-instructors.md`**
- Removed fictional per-document stage machine (UPLOADED/PENDING_VERIFICATION/VERIFIED/EXPIRED/REJECTED/ARCHIVED — these don't exist)
- Replaced with accurate model: URL-present = uploaded, `documentsVerified=true` = admin-approved, null URL = not uploaded or rejected
- Fixed approval checklist: changed "License number present" → actual file fields (`licenseImageFront` etc.)
- Added `photoIdDoc` and `vehicleRegistrationDoc` to checklist (were missing)

**`docs/DOCROLEBASE/00-overview/ADMIN_BUSINESS_RULES.md`**
- §1 approval checklist now uses actual DB field names (licenseImageFront, licenseImageBack, photoIdDoc, vehicleRegistrationDoc) instead of "license number present"
- Added tip pointing to Document Review page before approving

**`docs/DOCROLEBASE/05-admin/INSTRUCTOR_APPROVALS.md`**
- Updated instructor detail section: now 4 tabs (Overview / Subscription / Bookings / Documents), not 3
- Subscription tab documented with link to §7a
- Document Review section: expanded with full 6-route API inventory, reject SMS+audit behaviour, expiry dual-write note

**`docs/DOCROLEBASE/05-admin/DOCUMENT_VERIFICATION.md`**
- Removed "Instructor dashboard status page" from Phase 1 — it's done
- Removed "Audit logging" from recommendations — it's done
- Updated schema snippet: expiry fields shown as live production columns (not commented-out future)
- Added architecture note on expiry storage dual-write
- Updated API route inventory with all 7 routes
- Marked Phase 1/2/3 items accurately

---

## Session: 2026-07-21 — Subscription System Overhaul + Admin Subscription Management

### Summary
Fixed all critical bugs in the subscription upgrade/downgrade flow. Built a full admin subscription management UI. Added STUDIO commission rate throughout. Retired the legacy webhook.

---

### 1. Subscription Bug Fixes

#### Root causes fixed:

**`app/api/instructor/subscription/route.ts`**
- `POST` checkout now uses `customer: customerId` (not `customer_email`) — prevents duplicate Stripe customers on retry

**`app/api/stripe/webhook/route.ts` — `handleCheckoutCompleted`**
- DB tier/status/`stripeSubscriptionId` update moved **inside** `$transaction` — was previously in a separate `try/catch` after the transaction, causing silent failures where `stripeCustomerId` committed but tier never changed
- Now correctly finds and links the existing trial subscription row (if present) by `stripeSubscriptionId: null` + `instructorId` before creating a new row

**`app/api/stripe/webhook/route.ts` — `handleSubscriptionUpdate`**
- Now stamps `stripeSubscriptionId` on `Instructor` record (was missing)
- Race condition fix: when no subscription row found by `stripeSubscriptionId` (fires before `checkout.session.completed`), now searches for existing trial row by `instructorId` + `stripeSubscriptionId: null` and **links** it — prevents duplicate `Subscription` rows
- Only creates a brand-new row if no existing row found at all

**`app/api/instructor/subscription/billing-portal/route.ts`**
- Accepts `targetTier` parameter for upgrade checkout (trial → different tier with payment)
- Correctly creates Stripe customer from existing ID, not email

**`components/SubscriptionPlans.tsx`**
- Passes `targetTier` to billing portal on `active-change` dialog confirm
- Syncs from Stripe on both `payment_added=true` AND `portal_return=true`

#### Legacy webhook retired:
**`app/api/subscriptions/webhook/route.ts`**
- All processing removed — now returns `200` with `warning: 'legacy_endpoint_retired'` and logs a CRITICAL error
- **Action required:** Remove `/api/subscriptions/webhook` from Stripe dashboard webhooks — only `/api/stripe/webhook` should be registered

---

### 2. Admin Subscription Tab — Instructor Profile

**`app/admin/instructors/[id]/page.tsx`**
- Added **Subscription** tab (4th tab: Overview · Subscription · Bookings · Documents)
- Shows DB state vs live Stripe state side-by-side with refresh button
- Automatic drift detection — if DB and Stripe disagree, amber warning with one-click "Force Sync" button
- Actions wired to `POST /api/admin/instructors/[id]/subscription`:
  - **Force sync** — pulls live Stripe state into DB
  - **Cancel at period end** — sets `cancel_at_period_end: true` in Stripe (with reason modal)
  - **Cancel immediately** — cancels Stripe subscription now (with reason modal)
  - **Link Stripe sub ID** — manually links a `stripeSubscriptionId` to fix missing links
  - **Override tier / status** — sets any tier + status without touching Stripe (trial extensions, corrections); requires reason; audit-logged
  - **Delete duplicate row** — trash button on individual subscription rows (only visible when multiple rows exist)

---

### 3. Admin Subscriptions List Page

**`app/admin/subscriptions/page.tsx`** — new page at `/admin/subscriptions`
- Summary cards: Active / Trial / Past Due / Cancelled / Total — double as filter chips
- Search by name or email
- Filter by tier (BASIC / PRO / STUDIO / BUSINESS)
- Filter by status (ACTIVE / TRIAL / PAST_DUE / CANCELLED)
- Per-row quick Force Sync button (Stripe linked only)
- Stripe link indicator: green tick or amber warning per row
- Links to instructor profile → Subscription tab

**`app/api/admin/subscriptions/route.ts`** — new API powering the list page

**`components/admin/AdminNav.tsx`**
- Added "Subscriptions" link to the Users dropdown

---

### 4. STUDIO Commission Rate — Added End-to-End

**`prisma/schema.prisma`**
- Added `studioCommissionRate Float @default(11)` to `PlatformSettings`

**`prisma/migrations/20260721000001_add_studio_commission_rate/migration.sql`**
```sql
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "studioCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 11;
```

**`lib/services/platform-pricing.ts`**
- Added `studioCommissionRate` to `PricingSettings` interface and `DEFAULTS`
- `getCommissionRate('STUDIO')` now returns `pricing.studioCommissionRate` (was falling through to `basicCommissionRate`)

**`app/api/admin/pricing/route.ts`**
- Added `studioCommissionRate` to Zod validation schema

**`components/admin/PricingSettingsForm.tsx`**
- Commission grid expanded from 3 → 4 columns: Basic / Pro / Studio / Business

---

## Session: 2026-07-20 — Lesson Feedback + Assessment Type System

### Summary
Added `assessmentType` (COACHING/MOCK), `lessonTopics`, `passed` fields to Booking schema. Redesigned LessonFeedbackForm. Student progress redesigned as timeline. Fixed duplicate route functions and payment.ts class methods.

### Key files
`prisma/schema.prisma`, `prisma/migrations/20260720000001_add_assessment_type/migration.sql`,
`components/instructor/LessonFeedbackForm.tsx`, `app/api/instructor/lesson-feedback/route.ts`,
`app/api/client/my-performance/route.ts`, `app/client-dashboard/progress/page.tsx`,
`lib/services/lesson-feedback-service.ts`, `lib/services/payment.ts`

---

## Session: 2026-07-20 — Packages + Dashboard Widget Fixes

### Summary
Fixed `$5/h` rate bug (now uses `instructor.hourlyRate`), `ExpiresJan 1, 1970` null date bug, and unpaid packages showing in Clients Needing Attention widget. Added `RemindButton` for SMS from dashboard.

### Key files
`app/api/instructor/packages/route.ts`, `app/dashboard/packages/page.tsx`,
`app/dashboard/page.tsx`, `components/instructor/RemindButton.tsx`,
`app/api/instructor/remind-client/route.ts`, `app/api/instructor/clients/[id]/route.ts`

---

## Session: 2026-07-20 — Documents Page Redesign

### Summary
Collapsible document rows, Account Setup progress checklist, next-step banner, mobile-first layout. Added `abn`, `abnVerified`, `workingHours`, `subscriptionStatus` to profile API select. Fixed hydration error in CheckItem.

### Key files
`app/dashboard/documents/page.tsx`, `app/api/instructor/profile/route.ts`

---

## Session: 2026-07-20 — Waiting List → Slot-Open Automation

### Summary
Created `lib/services/waiting-list-notify.ts`. Wired into both cancel routes. Fire-and-forget pattern.

### Key files
`lib/services/waiting-list-notify.ts`, `app/api/bookings/[id]/cancel/route.ts`, `app/api/public/bookings/[id]/cancel/route.ts`

---

## Session: 2026-07-20 — Remove Hardcoded Values (Task 5)

### Summary
Replaced hardcoded commission rates, cancellation windows (24h/48h), payout buffer (48h), and platform fees with DB-backed `PlatformSettings` reads.

### Key files
`lib/services/payment.ts`, `lib/config/packages.ts`, `lib/services/stripe.ts`,
`app/api/analytics/route.ts`, `app/api/analytics/mobile/route.ts`,
`app/api/cron/weekly-payouts/route.ts`, `app/cancel-booking/[id]/page.tsx`,
`app/api/bookings/[id]/cancel/route.ts`, `app/api/public/bookings/[id]/cancel/route.ts`,
`app/api/bookings/[id]/cancellation-policy/route.ts`, `app/api/public/bookings/[id]/cancellation-policy/route.ts`,
`components/CancelDialog.tsx`, `lib/config/governance.ts`

---

## Session: 2026-07-19 — BUSINESS Tier Enable + Subscription Config

### Summary
Removed `comingSoon: true` from BUSINESS card. Updated feature list with `— Coming soon —` HR divider, clock icons for roadmap items. Updated `lib/config/subscriptions.ts` BUSINESS features to reflect v1 reality.

### Key files
`components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`

---

## Session: 2026-07-19 — Admin Operations Manual + Policy Page

### Summary
Created 11 operations docs in `docs/operations/`. Built `/admin/policy` page with sidebar navigation and full-text search. Fixed extractSections null crash. Added "Policy & Rules" to AdminNav.

### Key files
`docs/operations/README.md` through `11-release-management.md`,
`app/admin/policy/page.tsx`, `components/admin/AdminPolicyViewer.tsx`, `components/admin/AdminNav.tsx`

---

## Session: 2026-07-19 — Identity Architecture + BUSINESS Tier Foundation

### Summary
Introduced organisation-led identity model, created `getDisplayName` utility, traced through all student-facing surfaces. Homepage SEO fixes.

### Key files
`prisma/schema.prisma` (businessName), `lib/utils/account.ts`, `lib/branding/getDisplayIdentity.ts`,
`lib/services/sms.ts`, `lib/services/notifications.ts`, `app/subdomain/[slug]/page.tsx`,
`app/api/instructors/recommendations/route.ts`, `app/dashboard/branding/page.tsx`,
`app/api/instructor/branding/route.ts`, `app/page.tsx`

---

*Maintained by Kiro. Add new entries at the top. Each session gets a summary block.*
