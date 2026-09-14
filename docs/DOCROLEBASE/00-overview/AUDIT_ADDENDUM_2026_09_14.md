# DriveBook Whole-App Audit — Current-Tree Addendum

**Date:** 2026-09-14
**Branch:** `main`
**Purpose:** Record additional findings verified after the initial whole-app audit register was created.

## New verified findings

### DASH-H-01 — Instructor dashboard layout does not explicitly require the instructor role

**Evidence:** `app/dashboard/layout.tsx` redirects CLIENT, ADMIN and SUPER_ADMIN, but any other authenticated role falls through to the instructor dashboard. It does not explicitly require `session.user.role === 'provider'` before rendering the dashboard.

**Impact:** The dashboard's authorization boundary is based on exclusion rather than positive role assertion. If another role is introduced or a role value is corrupted/misassigned, that account can reach instructor dashboard pages and their API calls.

**Priority:** P1 security/authorization hardening.

### DASH-H-02 — Staff task API has no granular staff permission model

**Evidence:** `app/api/staff/tasks/route.ts` authorizes by role (`ADMIN`, `SUPER_ADMIN`, `STAFF`) but does not use the granular admin/staff permission catalogue used by the admin API surface.

**Impact:** Staff task operations are governed by a separate authorization model. This may be intentional, but it creates a second RBAC boundary that must be explicitly documented and tested.

**Priority:** P1 architecture/authorization review.

### DASH-M-01 — Staff dashboard `assignedToMe` filter is not enforced by the API

**Evidence:** `app/staff/dashboard/page.tsx` sends `assignedToMe=true`, but `app/api/staff/tasks/route.ts` parses status/priority/category and does not read or apply `assignedToMe`.

**Impact:** The UI presents a filter that does not change server results. Users may believe they are viewing only their own tasks when they are not.

**Priority:** P2 functional correctness.

### FIN-H-01 — Public cancellation has a non-transactional Stripe refund side effect after booking cancellation

**Evidence:** `app/api/public/bookings/[id]/cancel/route.ts` atomically marks the booking CANCELLED, then separately calls `stripe.refunds.create()`. A Stripe failure leaves the booking cancelled while the expected refund remains outstanding and requires manual action.

**Impact:** The route does expose `requiresManualAction`, but the financial state machine does not persist a durable refund-pending state. Retry/reconciliation semantics therefore need explicit verification.

**Priority:** P1 financial recovery/state-machine review.

### FIN-H-02 — Public reschedule ownership token is consumed before the booking write

**Evidence:** `app/api/public/bookings/[id]/reschedule/route.ts` clears the user's verification token before performing availability checking and booking update.

**Impact:** A valid OTP verification can be consumed even if the subsequent reschedule fails due to conflict or another error. This is a reliability/UX issue and complicates retry semantics.

**Priority:** P2.

### FIN-H-03 — Public reschedule constructs wall-clock time with server-local `Date` semantics

**Evidence:** `app/api/public/bookings/[id]/reschedule/route.ts` uses `new Date(year, month - 1, day, hour, minute, 0, 0)` and comments that this is server-local time. DriveBook otherwise has explicit instructor timezone conversion helpers.

**Impact:** If production server timezone is UTC, an instructor in an Australian timezone can receive a rescheduled lesson at the wrong UTC instant relative to the intended local time.

**Priority:** P1 timezone/data-integrity review.

### DATA-H-01 — Private document upload contract is violated by persistence of `result.url`

**Evidence:** `lib/services/cloudinary.ts` explicitly says private documents must store only `publicId`; `app/api/instructor/documents/route.ts` stores `result.url` in DrivingProviderProfile. The admin signed-URL route also contains a direct legacy URL fallback.

**Impact:** Permanent document URL exposure may bypass the intended five-minute signed URL protection.

**Priority:** P0/P1 privacy/security.

### DATA-H-02 — Instructor payout settings response exposes full bank account number

**Evidence:** `app/api/instructor/payout-settings/route.ts` returns `bankBsb`, `bankAccount`, `bankAccountName`, ABN and tax fields directly in the JSON response.

**Impact:** The endpoint is authenticated and scoped to the instructor, so this is not automatically an authorization failure. However, bank details are high-sensitivity financial data and should be minimised/masked in UI-facing responses unless the full value is genuinely required.

**Priority:** P1 data minimisation review.

### AI-H-03 — Admin AI operational metrics can silently become false-zero during database errors

**Evidence:** `lib/admin/ai-tools.ts` catches many Prisma query failures and substitutes `0`, `{}`, or empty arrays. The AI then presents the resulting aggregate as current platform data.

**Impact:** An infrastructure/database problem can be interpreted as a healthy platform or as an absence of operational issues. This is especially problematic for an admin decision-support system.

**Priority:** P1 operational correctness.

## Current route/surface verification notes

### Student dashboard

The current dashboard documentation describes the main dashboard plus 11 sub-routes and a post-payment confirmation route. The dashboard layout positively requires CLIENT role before rendering. Current audit focus should remain on each API's ownership checks rather than relying on the layout.

### Instructor dashboard

The current documentation describes the main dashboard and more than 20 functional pages. The main layout checks authenticated role indirectly and performs subscription/approval lookups. The role gate needs positive assertion as described above.

### Admin dashboard

The current documentation lists 20+ admin pages. The layout positively restricts access to ADMIN/SUPER_ADMIN. Current admin API evidence shows extensive `requirePermission()` adoption, but a complete route-by-route permission matrix is still required before claiming every admin endpoint is verified.

### Public booking

The public booking flow has multiple layers of protection: rate limiting, provider approval/subscription checks, server-side price calculation, idempotency, PaymentIntent ownership for authenticated payment, and public payment tokens. Current audit findings show that concurrency and external-side-effect state machines still need hardening in cancellation/reschedule/slot reservation.

## Important audit distinction

The repository's historical inspection documents contain many statements such as "Area Done" and "all findings fixed." Those statements are useful historical evidence but are not treated as current closure certificates. The current branch is the source of truth for the present audit.

## Updated status

**Known production blockers remain.** The most urgent are:

1. Wallet transaction ownership.
2. Instructor-controlled ABN/tax verification state.
3. Private compliance-document URL exposure.
4. Stripe subscription correlation fallback/race.
5. Booking/reschedule/slot concurrency.
6. Subscription entitlement fail-open.
7. Unsupported DIRECT registration state.
8. Timezone correctness in public reschedule.

No production deployment recommendation should be made until these are resolved and regression-tested.
