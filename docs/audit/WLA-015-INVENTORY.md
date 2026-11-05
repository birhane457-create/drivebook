# WLA-015 — Customer Communications Sender Identity Inventory

**Audit date:** 2026-11-04  
**Source inspected:** 6a89a943 (v4)  
**Status:** FIX APPLIED (v4) — all booking-level paths use `getProviderBookingsSender()`; platform-level exceptions documented and retained

---

## Implementation Summary (v4)

`getProviderBookingsSender(provider?)` in `lib/email/senders.ts` resolves the `From:` display name using `getAccountFeatures(provider).whiteLabel` (central feature abstraction — never checks tier directly). When `whiteLabel` is true (PREMIUM tier only) and `businessName` is non-empty, the display name becomes `"${businessName} via DriveBook"`. The email address is always `bookings@drivebook.com.au` — DKIM/deliverability is unchanged.

### Booking-level paths now using `getProviderBookingsSender()`:
- `sendBookingConfirmation()` — both callers (`bookings/route.ts`, `public/bookings/route.ts`) pass `provider`
- `sendCancellationRequestedEmail()` / `sendCancellationApprovedEmail()` / `sendCancellationRejectedEmail()` — accept optional `provider`; `booking-service.ts` passes `booking.provider`
- `sendPDATestReminder()` — uses `data.provider`
- `[id]/cancel/route.ts` — uses `booking.provider` (customer + instructor copies)
- `[id]/route.ts` PATCH — uses `booking.provider`
- `bookings/route.ts` top-up prompt — uses `instructor` (Prisma select includes `businessName`)
- `batch/route.ts` customer lesson-confirmed + top-up — uses `instructor` (Prisma select includes `businessName`)
- `waiting-list-notify.ts` — uses `instructor` (select includes `subscriptionTier`)
- `lesson-reminders/route.ts` cron — uses `booking.provider` (select includes `subscriptionTier`)
- `checkProviderEligible.ts` — returns `businessName` for white-label resolution

### Platform-level exceptions (no change, explicitly documented):
- `send-payment-link/route.ts` — `DriveBook Payments` sender for wallet top-up mechanism
- `batch/route.ts` instructor-facing batch summary — instructor is the recipient, not a customer
- Receipt emails A/B/C/E — `DriveBook Payments` sender; deferred as a product decision (whether the collecting payment entity should retain its identity for white-label providers)
- Receipt D/F/G — wallet top-up, admin credit/deduction; correctly platform-level
- SMS sender — single Twilio platform number; requires Twilio sub-account infrastructure to change
- All security/account emails (OTP, password reset, device alert, verification) — correctly platform-level

---

## Infrastructure

### Sender identity system
- `lib/email/senders.ts` defines 5 platform senders (unchanged):
  - `verification`, `bookings`, `payments`, `team`, `support`
- New: `getProviderBookingsSender(provider?)` resolves a white-label display name for PREMIUM providers via `getAccountFeatures().whiteLabel`
- `formatSender(key)` returns the standard platform sender; `getProviderBookingsSender()` calls `formatSender('bookings')` as fallback

### SMS sender
- `lib/services/sms.ts` — single Twilio number from `TWILIO_PHONE_NUMBER` env var. No per-provider number selection. **Deferred — infrastructure constraint.**

---

## Email Path Inventory (v4 state)

| # | Function / File | v4 Sender | Classification | Status |
|---|---|---|---|---|
| 1 | `sendBookingConfirmation()` | `getProviderBookingsSender(data.provider)` | BOOKING-LEVEL | ✅ FIXED — both callers pass provider |
| 2 | `[id]/cancel/route.ts` customer | `getProviderBookingsSender(booking.provider)` | BOOKING-LEVEL | ✅ FIXED |
| 3 | `[id]/cancel/route.ts` instructor | `getProviderBookingsSender(booking.provider)` | BOOKING-LEVEL | ✅ FIXED |
| 4 | `[id]/route.ts` PATCH cancel | `getProviderBookingsSender(booking.provider)` | BOOKING-LEVEL | ✅ FIXED |
| 5 | `bookings/route.ts` top-up prompt | `getProviderBookingsSender(instructor)` | BOOKING-LEVEL | ✅ FIXED — businessName added to select |
| 6 | `send-payment-link/route.ts` | `DriveBook Payments` | PLATFORM-LEVEL | ✅ Retained — wallet payment mechanism |
| 7 | `batch/route.ts` instructor summary | `DriveBook Bookings` | INSTRUCTOR-FACING | ✅ Retained — not customer-facing |
| 8 | `batch/route.ts` customer top-up | `getProviderBookingsSender(instructor)` | BOOKING-LEVEL | ✅ FIXED — businessName added to select |
| 9 | `batch/route.ts` customer lesson-confirmed | `getProviderBookingsSender(instructor)` | BOOKING-LEVEL | ✅ FIXED — businessName added to select |
| 10 | `sendCancellationRequestedEmail()` | `getProviderBookingsSender(data.provider)` | BOOKING-LEVEL | ✅ FIXED — optional provider field added |
| 11 | `sendCancellationApprovedEmail()` | `getProviderBookingsSender(data.provider)` | BOOKING-LEVEL | ✅ FIXED — booking-service passes provider |
| 12 | `sendCancellationRejectedEmail()` | `getProviderBookingsSender(data.provider)` | BOOKING-LEVEL | ✅ FIXED — booking-service passes provider |
| 13 | `sendPDATestReminder()` | `getProviderBookingsSender(data.provider)` | BOOKING-LEVEL | ✅ FIXED |
| 14 | Lesson reminder cron | `getProviderBookingsSender(booking.provider)` | BOOKING-LEVEL | ✅ FIXED — subscriptionTier added to select |
| 15 | Waiting list slot | `getProviderBookingsSender(instructor)` | BOOKING-LEVEL | ✅ FIXED |
| 16 | Receipts A/B/C/E | `DriveBook Payments` | PAYMENT | ⏸ DEFERRED — product decision |
| 17 | Receipts D/F/G | `DriveBook Payments` | PLATFORM-LEVEL | ✅ Correct |
| 18 | `sendClaimAccountEmail()` | `DriveBook Team` | PLATFORM-LEVEL | ✅ Retained — account setup |
| 19 | `sendWelcomeEmail()` | `DriveBook Team` | PLATFORM-LEVEL | ✅ Correct |
| 20 | Security/account emails (OTP, reset, device, verification) | `DriveBook Account Verification` | PLATFORM-LEVEL | ✅ Correct |
| 21 | Trial/subscription/payout (instructor-facing) | `DriveBook Payments` | INSTRUCTOR-FACING | ✅ Correct |
| 22 | Payment declined (webhook to customer) | `DriveBook Support` | PLATFORM-LEVEL | ✅ Correct |

---

## SMS Path Inventory (v4 state)

| # | Function | From | Classification | Status |
|---|---|---|---|---|
| 1 | Booking confirmation SMS | Twilio platform number | BOOKING-LEVEL | ⏸ DEFERRED — infrastructure constraint |
| 2 | Lesson reminder SMS (student) | Twilio platform number | BOOKING-LEVEL | ⏸ DEFERRED — infrastructure constraint |
| 3 | Lesson reminder SMS (instructor) | Twilio platform number | Instructor-facing | ✅ Correct |
| 4 | OTP SMS | Twilio platform number | PLATFORM-LEVEL | ✅ Correct |
| 5 | Waiting list SMS | Twilio platform number | BOOKING-LEVEL | ⏸ DEFERRED — infrastructure constraint |
| 6 | Admin/other SMS | Twilio platform number | PLATFORM-LEVEL | ✅ Correct |

**SMS deferred items:** Provider name appears in message body via `getDisplayName()`. Sender number requires Twilio sub-account or per-provider number provisioning — infrastructure constraint, not a code-only fix.

---

## Deferred Scope Items

**Receipts A/B/C/E (product decision):** Whether `DriveBook Payments` sender should change for white-label providers is a product/legal question. Arguments for retaining: payment was collected by DriveBook (Stripe Connect); financial traceability. Arguments for changing: white-label provider's customer may not know about DriveBook. **Requires explicit product decision before implementation.**

**SMS sender (infrastructure):** Per-provider Twilio numbers require sub-account provisioning, number purchase, and routing logic. **Deferred to infrastructure track.**

---

## Test Evidence

**20/20 tests pass exit 0** (no DB required — pure function + source checks):
- S01–S09b: Pure function tests on `getProviderBookingsSender()` (tier logic, whitespace, null handling, architecture rule via `getAccountFeatures`)
- S10–S15: Source-presence checks verifying `getProviderBookingsSender` is imported and used at email.ts, cron, waiting-list, both booking callers, and checkProviderEligible
- S16–S19: Source-presence checks for remaining booking-level paths (cancel routes, PATCH cancel, top-up, batch)

**Test qualification:** S01–S09b are pure function tests. S10–S19 are source-presence checks that verify the function name and caller arguments appear in the source file — they do not invoke the actual HTTP route handlers or verify email dispatch at runtime.
