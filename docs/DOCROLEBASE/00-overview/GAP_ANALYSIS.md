# Gap Analysis

**Purpose:** Record of gaps identified during development and their resolution status.  
**For current system documentation, read the feature docs in `DOCROLEBASE/` and `docs/LAUNCH_PLAN.md`.**

---

## Resolved

| # | Area | What was wrong | What was done |
|---|------|---------------|---------------|
| 1 | Booking creation | Docs said all bookings start as PENDING_PAYMENT | SYSTEM_FLOWS.md updated — two paths documented: instructor wallet (CONFIRMED directly) and Stripe (PENDING_PAYMENT) |
| 2 | Commission rate | Hardcoded 15% regardless of tier | Both booking routes now call getCommissionRate(tier) from PlatformSettings |
| 3 | Wallet balance | Two different balance sources depending on entry point | SYSTEM_OF_RECORD.md clarified — transaction sum is authoritative |
| 4 | AuditLog on booking | Not logged on creation | POST /api/bookings now calls logBookingAction(BOOKING_CREATED) |
| 5 | No-account client booking | Hard 422 rejection | Creates PENDING_PAYMENT booking + sends claim email |
| 6 | Transaction status | Docs said COMPLETED for payout eligibility | Code uses SETTLED — FINANCIAL_DOCTRINE.md and STATE_MACHINES.md corrected |
| 7 | Webhook EXPIRED revival | Not documented | FAILURE_HANDLING.md and STATE_MACHINES.md document EXPIRED → CONFIRMED path |
| 8 | Package payment wallet | Not documented | WALLET.md documents CREDIT + DEBIT on package payment |
| 9 | Cancellation transaction | Docs said REFUNDED | Code uses CANCELLED — STATE_MACHINES.md corrected |
| 10 | Cancellation atomicity | Split transaction risk | Cancel route wraps wallet + booking + transaction in single prisma.$transaction |
| 11 | Admin booking audit | No AuditLog on status changes | PATCH /api/admin/bookings logs BOOKING_COMPLETED, BOOKING_NO_SHOW, BOOKING_CANCELLED |
| 12 | No-show party field | Stored in description string | noShowParty field added to Booking schema |
| 13 | Payout eligibility status | Docs said COMPLETED | Code uses SETTLED — all payout docs corrected |
| 14 | ABN gate behaviour | Not documented | INSTRUCTOR_APPROVALS.md documents: missing ABN = 47% withholding, present-but-unverified = blocked |
| 15 | Reconciliation stuck threshold | Docs said 24h | Code uses 10 minutes — FAILURE_HANDLING.md corrected |
| 16 | Reconciliation check 1 | Docs said Transaction check | Code checks LedgerEntry — SYSTEM_FLOWS.md corrected |
| 17 | ABN cron frequency | Docs said daily | Code is weekly (Mondays 2am) — INSTRUCTOR_APPROVALS.md corrected |
| 18 | ABN cron skip condition | Not documented | INSTRUCTOR_APPROVALS.md documents: skips if ABR_GUID not set |
| 19 | Wallet top-up amount validation | Not validated in webhook | Webhook now validates amount_received matches transaction amount |
| 20 | Wallet top-up orphan cleanup | PENDING transaction not cleaned on Stripe failure | wallet-topup-intent route deletes PENDING transaction if Stripe fails |
| 21 | Booking price from client | Accepted from request body | Price always calculated server-side; client value ignored |
| 22 | Slot conflict TOCTOU | Availability check outside transaction | Definitive conflict check now inside prisma.$transaction |
| 23 | Bulk booking instructor check | No active/approved check | public/bookings/bulk now checks approvalStatus and isActive |
| 24 | Short-notice booking expiry | Never expired | cleanup-expired-bookings cron expires PENDING bookings after 2 hours |
| 25 | WalletTransaction status | Mixed CONFIRMED/COMPLETED | All wallet transactions now use CONFIRMED |
| 26 | Wallet balance drift | Instructor path didn't update stored balance | Atomic decrement added to instructor booking path |
| 27 | sendReminder no-op | Only logged to console | Now sends real email to instructor listing expiring docs |
| 28 | Staff governance stats | Endpoint missing | GET /api/admin/staff-governance/stats implemented |
| 29 | Client review UI | Missing | ReviewModal + pending-reviews API + Leave Review button on bookings page |
| 30 | Lesson reminders cron | notifyLessonReminder never called | Cron fully wired with SMS + email for both instructor and student |
| 31 | Fake testimonials | On teach-with-drivebook page | Replaced with honest Early Access section |
| 32 | MongoDB references in docs | Multiple docs referenced MongoDB | All corrected to PostgreSQL |
| 33 | Rate locking | Not documented | BOOKING_FLOW.md and WALLET.md document book-now locked, book-later uses live rate |
| 34 | Slot blocking | check-and-reserve not documented | BOOKING_FLOW.md documents 10-min in-memory reservation |
| 35 | Admin bulk discount toggle | Not built | PricingSettingsForm now has master toggle for all three discount rates |
| 36 | 409 price-change refresh | Not built | SubdomainBookingWizard re-fetches pricing and shows amber banner |
| 37 | Offline booking system | Not built | POST /api/bookings/offline with PRO gate and platform client guard |
| 38 | SMS policy | Instructor received confirmation SMS | Confirmation SMS now student-only; instructor gets 24hr reminder SMS only |
| 39 | AuditLog indexes missing | No indexes on AuditLog table | 4 indexes created via SQL migration (createdAt, targetType, actorId, action) |
| 40 | Stripe payment events not in AuditLog | payment_intent.succeeded/failed not logged | PAYMENT_SUCCEEDED, PAYMENT_FAILED, WALLET_PAYMENT_SUCCEEDED actions added to webhook |
| 41 | Bank transfer risk undocumented | No warning about format-only BSB validation | PAYOUTS.md documents: format-only validation, admin must confirm before first transfer |
| 42 | Stripe Connect onboarding missing | Instructors had no self-service way to connect bank account | POST /api/instructor/stripe-connect/onboard + account.updated webhook handler + "Connect with Stripe" button on payout settings page |

---

## Resolved — April 2026 Gap Sprint

| # | Area | What was wrong | What was done |
|---|------|---------------|---------------|
| 43 | Student booking detail page | No `/client-dashboard/bookings/[id]` page existed | Created `app/client-dashboard/bookings/[id]/page.tsx` + `app/api/client/bookings/[id]/route.ts` |
| 44 | PENDING/PENDING_PAYMENT hidden from students | `api/client/profile` filtered out unpaid bookings | All statuses now visible with correct display labels |
| 45 | Student notifications page missing | No dedicated `/client-dashboard/notifications` page | Created `app/client-dashboard/notifications/page.tsx` |
| 46 | Reviews not in mobile nav | No reviews indicator in client mobile bottom nav | Pending-reviews badge added to "My Bookings" tab |
| 47 | Instructor client detail page missing | No `/dashboard/clients/[id]` page | Created `app/dashboard/clients/[id]/page.tsx` + `app/api/instructor/clients/[id]/route.ts` |
| 48 | Booking edit page missing | `/dashboard/bookings/[id]/edit` folder had no `page.tsx` | Created `app/dashboard/bookings/[id]/edit/page.tsx` |
| 49 | Send payment link button missing | API existed but no UI triggered it | Button added to booking detail page and client detail page |
| 50 | /my-bookings orphaned page | Legacy leftover not linked from anywhere | Deleted |
| 51 | /instructor-dashboard redirect dead weight | Just a redirect to /dashboard | Deleted |
| 52 | PDA test result update broken | `PUT /api/pda-tests/[id]` route folder had no `route.ts` | Created `app/api/pda-tests/[id]/route.ts` with PUT + DELETE |
| 53 | PDA test schedule form missing | "Schedule Test" button opened nothing | Rebuilt `app/dashboard/pda-tests/page.tsx` with full form |
| 54 | PDA availability blocking broken | Called `prisma.pDATest` — model doesn't exist | Fixed to query `Booking` where `bookingType = 'PDA_TEST'` |
| 55 | PDA mobile route stub | Returned empty array with TODO comment | Replaced with real Booking query |
| 56 | PDA test duration wrong | Hardcoded 45min | Fixed to 165min (2h45) |
| 57 | PDA test centre free-text | Dirty data, no consistency | Added `TestCentre` model, seeded 15 WA DVS centres, schedule form uses dropdown grouped by region |
| 58 | PDA test price not configurable per test | No price field in schedule form | Price field added, defaults to instructor's `testPackagePrice`, per-test override supported |
| 59 | PDA tests invisible to students | Students couldn't see test day bookings | Student booking detail shows purple "Test Day" badge, centre name/address displayed correctly |
| 60 | Availability buffer not applied | `bookingBufferMinutes` fetched but never used in slot generation | Fixed — buffer applied to all bookings; PDA tests block `testStart - buffer` through `testEnd` |
| 61 | Student reschedule page missing | `/client-dashboard/bookings/[id]/reschedule` returned 404 | Created `app/client-dashboard/bookings/[id]/reschedule/page.tsx` with calendar + slot picker |
| 62 | /manage-booking not linked from emails | Page existed but no email linked to it | Added "Manage booking" link to all booking receipt emails; page pre-fills from `?id=` query param |
| 63 | Admin test centre management | Only way to manage centres was seed script | Created `app/admin/test-centres/page.tsx` + `GET/POST /api/admin/test-centres` + `PATCH/DELETE /api/admin/test-centres/[id]`; added to admin nav |
| 64 | Google Calendar OAuth — already implemented | Marked as missing but callback route existed | Confirmed `GET /api/calendar/callback` + `GoogleCalendarSettings` component fully implemented |
| 65 | Custom domain DNS guide — already implemented | Marked as missing but wizard existed | Confirmed `CustomDomainWizard` in branding page has full step-by-step DNS guide with CNAME table and root domain options |
| 66 | Admin dashboard hardcoded zeros | pendingInstructors, subscriptionStats all hardcoded to 0 | Dashboard now queries real data: pending count, subscription breakdown by tier, revenue MTD |
| 67 | Admin dashboard no action alerts | No surface for daily operational tasks | Added 4 alert banners: ended lessons, expiring docs, unverified ABNs, pending approvals |
| 68 | Admin reviews page crashed silently | Queried `prisma.review` — model doesn't exist | Fixed to read from `Booking.clientRating/clientReview/isReviewed` |
| 69 | Instructor detail "Coming Soon" box | Subscription/ABN/tax data not shown | Replaced with real subscription tier, status, hourly rate, payout method, ABN, withholding rate |
| 70 | Instructor detail broken booking link | Linked to `/booking/[id]` (public page) | Fixed to `/admin/bookings` |
| 71 | Instructor list no subscription tier | Couldn't see tier at a glance | PRO/STUDIO/BUSINESS badge added inline to each row |
| 72 | Staff governance broken links | `/staff/dashboard` and `/admin/audit-logs` don't exist | Fixed to `/admin/audit-log` and `/admin/payouts` |

---

## Resolved — May 2026 Admin Sprint

| # | Area | What was wrong | What was done |
|---|------|---------------|---------------|
| 73 | PlatformSettings/PlatformLedger missing after DB reset | DB reset wiped all data; dashboard crashed on missing seed records | Created `seed-platform-data.js` (idempotent upsert); run after any fresh migration |
| 74 | Admin dashboard crashed on missing data | Unguarded Prisma queries threw 500 on empty DB | All dashboard queries wrapped in `try/catch`; page renders with zero stats if DB unavailable |
| 75 | Admin support centre missing | No way for admin to act on behalf of users | Built `/admin/support` (user search) + `/admin/support/user/[userId]` (send message, reset password, add wallet credit); all actions logged to AuditLog |
| 76 | Admin reviews page crashed silently | Queried `prisma.review` — model doesn't exist in schema | Fixed to read from `Booking.clientRating`, `Booking.clientReview`, `Booking.isReviewed` |

---

## Open — What Still Needs to Be Built

These are genuine gaps that have not been implemented yet. Ordered by priority.

---

### OPEN-01: BUSINESS Tier — Multi-Instructor Management

**Status:** Deferred — tier is "Coming Soon" in UI, cannot be purchased  
**Scope:** Large — separate spec required before starting

---

### OPEN-02: Prisma Migration Required for TestCentre

**Status:** Schema updated, migration not yet run  
**Action:** Run `npx prisma migrate dev --name add-test-centre` then `npm run seed:test-centres`

This is a deployment step, not a code gap.

---

### OPEN-04: Rate Limiting — Redis Not Configured

**Status:** In-memory fallback only  
**Action:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars.

---

### OPEN-05: ABN Placeholder in Footer

**Status:** Placeholder text in `app/about/page.tsx`  
**Action:** Add real ABN once registered. One-line change.

---

## Summary

| Category | Count |
|----------|-------|
| Resolved (all time) | 76 |
| Open — deployment/config | 4 (OPEN-02, OPEN-04, OPEN-05, OPEN-11) |
| Open — feature gap | 1 (OPEN-10 — progress chart) |
| Deferred — future tier | 1 (OPEN-01 — BUSINESS tier) |

---

## Open — What Still Needs to Be Built

These are genuine gaps that have not been implemented yet. Ordered by priority.

---

### OPEN-01: BUSINESS Tier — Multi-Instructor Management

**Status:** Deferred — tier is "Coming Soon" in UI, cannot be purchased  
**Scope:** Large — separate spec required before starting

---

### OPEN-02: Prisma Migration for TestCentre

**Status:** Migration run locally (April 2026). Must be run on production DB if not already applied.  
**Action:** `npx prisma migrate dev --name add-test-centre` then `npm run seed:test-centres`

---

### OPEN-04: Rate Limiting — Redis Not Configured

**Status:** In-memory fallback only in production (serverless-unsafe)  
**Action:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars.

---

### OPEN-05: ABN Placeholder in Footer

**Status:** Placeholder text in `app/about/page.tsx`  
**Action:** Add real ABN once registered. One-line change.

---

### OPEN-10: Student Progress — No Chart Library

**Status:** Progress page uses CSS bar chart (div widths) instead of a real chart library.  
**Decision:** Acceptable for launch. Install `recharts` post-launch if needed.

---

### OPEN-11: Live Mode Stripe Keys

**Status:** All Stripe keys are test mode. Real payments cannot be processed.  
**Action before go-live:** Create live Stripe products/prices, update all `STRIPE_*` env vars in Vercel with live keys, update `STRIPE_WEBHOOK_SECRET` with the live webhook signing secret from Stripe Dashboard.

---

## Resolved Contradictions (Documentation Corrections)

These were identified as contradictions in the docs but are resolved in code. Documented here for clarity.

| # | Contradiction | Resolution |
|---|--------------|------------|
| C1 | Wallet balance drift — instructor vs admin path | Fixed (gap #26). All paths use transaction sum. SYSTEM_OF_RECORD.md updated to remove "known inconsistency" language. |
| C2 | Stripe webhook secret "placeholder" warning | Resolved. Real test secret set in Vercel. STRIPE.md updated with current status. |
| C3 | Payout eligibility "COMPLETED" vs "SETTLED" | Resolved (gap #6/#13). All docs use SETTLED. |
| C4 | Reconciliation stuck threshold 24h vs 10min | Resolved (gap #15). FAILURE_HANDLING.md corrected to 10 minutes. |
| C5 | "Lesson Completed" transaction status inconsistency | Resolved. FAILURE_HANDLING.md now correctly says SETTLED for all paths. |
| C6 | AuditLog missing on POST /api/bookings | Resolved (gap #4). Booking creation logs BOOKING_CREATED. |
| C7 | Stale Prisma client | Resolved. Migration run April 2026, client regenerated. |

---

## Design Decisions (Intentional, Not Bugs)

| Item | Decision | Rationale |
|------|----------|-----------|
| TFN collection | Not active. Field commented out in schema. | Enabled only if legally required by ATO. |
| Manual recovery for negative balances | Admin creates MANUAL_ADJUSTMENT transaction. No automated self-healing. | Prevents accidental corrections. Every adjustment requires human review and audit trail. |
| Automated Stripe Connect transfers | Implemented for `payoutMethod = stripe_connect`. Manual bank transfer for others. | Instructors who haven't completed Connect onboarding fall back to manual. |
| Progress chart (CSS bars) | Functional. Recharts not installed. | Acceptable for launch. Real chart library is a post-launch enhancement. |
| No TFN collection | TFN fields commented out in schema. | ATO does not require TFN for contractor payments if ABN is provided. |

---

## Summary

| Category | Count |
|----------|-------|
| Resolved (all time) | 76 |
| Open — deployment/config | 4 (OPEN-02, OPEN-04, OPEN-05, OPEN-11) |
| Open — feature gap | 1 (OPEN-10 — progress chart) |
| Deferred — future tier | 1 (OPEN-01 — BUSINESS tier) |
| Resolved contradictions | 7 (C1–C7) |
