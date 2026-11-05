# WLA-015 — Customer Communications Sender Identity Inventory

**Audit date:** 2026-11-04  
**Source inspected:** b2c26ab2 (v3) — inventory updated for v3/v4  
**Status:** FIX APPLIED (v4) — all booking-level paths use getProviderBookingsSender

---

## Infrastructure

### Sender identity system
- `lib/email/senders.ts` defines **5 fixed platform senders**, all hardcoded DriveBook aliases:
  - `verification` → `DriveBook Account Verification <verification@drivebook.com.au>`
  - `bookings` → `DriveBook Bookings <bookings@drivebook.com.au>`
  - `payments` → `DriveBook Payments <payments@drivebook.com.au>`
  - `team` → `DriveBook Team <hello@drivebook.com.au>`
  - `support` → `DriveBook Support <support@drivebook.com.au>`

- `lib/email/registry.ts` maps 34 event keys to these sender keys. No provider-level sender entry exists.

- `lib/email/context.ts` implements `resolveSender()`. It already documents a planned `schoolId`/`branding` hook for BUSINESS-tier white-labelling but **this is not yet implemented**. All current dispatch uses DriveBook platform identity.

- `lib/branding/getDisplayIdentity.ts` / `getDisplayName()` is used extensively to resolve a provider's display name for message **body content** only. It never affects `From:` address.

### SMS sender
- `lib/services/sms.ts` — single Twilio number from `TWILIO_PHONE_NUMBER` env var. No per-provider number selection.

---

## Classification Key

- **PLATFORM-LEVEL**: Security, financial platform, or account management — DriveBook identity is correct and expected
- **BOOKING-LEVEL (marketplace)**: Customer-facing booking communication where DriveBook legitimately identifies as the marketplace operator
- **BOOKING-LEVEL (gap)**: Customer-facing booking communication where a BUSINESS/PREMIUM/STUDIO provider entitled to independent branding receives a hardcoded DriveBook `From:` address; the body correctly shows provider name but the envelope sender does not

---

## Email Path Inventory

| # | Function / File | Sender (`From:`) | Subject includes provider? | Body includes provider? | Classification | Notes |
|---|---|---|---|---|---|---|
| 1 | `sendBookingConfirmation()` `lib/services/email.ts` | `DriveBook Bookings` | No | YES `getDisplayName()` | BOOKING-LEVEL (gap) | Called from both marketplace and dashboard paths |
| 2 | Booking cancellation `app/api/bookings/[id]/cancel/route.ts` | `DriveBook Bookings` (hardcoded) | No | Partially | BOOKING-LEVEL (gap) | Uses raw booking data not `getDisplayName()` |
| 3 | Booking cancellation `app/api/bookings/[id]/route.ts` PATCH | `DriveBook Bookings` (hardcoded) | No | No | BOOKING-LEVEL (gap) | |
| 4 | Top-up wallet prompt `app/api/bookings/route.ts` | `DriveBook Bookings` (hardcoded) | YES raw `instructor.name` | YES | BOOKING-LEVEL (gap) | Subject shows instructor name, sender is DriveBook |
| 5 | Top-up prompt `app/api/bookings/send-payment-link/route.ts` | `DriveBook Payments` (hardcoded) | YES `DriveBook` in subject | YES | BOOKING-LEVEL (gap) | Subject: "Action Required: Top up your DriveBook wallet" — also names platform in subject |
| 6 | Batch booking confirmation `app/api/bookings/batch/route.ts` | `DriveBook Bookings` (hardcoded) | Partially | YES | BOOKING-LEVEL (gap) | Three sends per batch |
| 7 | `sendCancellationRequestedEmail()` `lib/services/email.ts` | `DriveBook Bookings` | No | YES | BOOKING-LEVEL (gap) | |
| 8 | `sendCancellationApprovedEmail()` | `DriveBook Bookings` | No | YES | BOOKING-LEVEL (gap) | |
| 9 | `sendCancellationRejectedEmail()` | `DriveBook Bookings` | No | YES | BOOKING-LEVEL (gap) | |
| 10 | `sendPDATestReminder()` `lib/services/email.ts` | `DriveBook Bookings` | No | YES `getDisplayName()` | BOOKING-LEVEL (gap) | |
| 11 | Lesson reminder cron `app/api/cron/lesson-reminders/route.ts` | `DriveBook Bookings` (hardcoded) | YES `getDisplayName()` | YES | BOOKING-LEVEL (gap) | Offline bookings only |
| 12 | Waiting list slot `lib/services/waiting-list-notify.ts` | `DriveBook Bookings` (hardcoded) | YES `getDisplayName()` | YES | BOOKING-LEVEL (gap) | Subject: "A lesson slot has opened up with {provider}" |
| 13 | Bulk booking top-up `app/api/public/bookings/bulk/route.ts` | `DriveBook Bookings` (hardcoded) | YES `getDisplayName()` | YES | BOOKING-LEVEL (marketplace) | Public marketplace path; DriveBook identity reasonable here |
| 14 | **Receipt A** `sendPackagePurchaseReceipt()` `lib/services/receipt-email.ts` | `DriveBook Payments` (hardcoded) | No | YES `getDisplayName()` | PAYMENT (gap — see note) | Payment receipts — see scope discussion |
| 15 | **Receipt B** `sendWalletLessonReceipt()` | `DriveBook Payments` (hardcoded) | No | YES | PAYMENT (gap — see note) | |
| 16 | **Receipt C** `sendSingleLessonReceipt()` | `DriveBook Payments` (hardcoded) | No | YES | PAYMENT (gap — see note) | |
| 17 | **Receipt D** `sendWalletTopUpReceipt()` | `DriveBook Payments` (hardcoded) | No | No | PLATFORM-LEVEL | Wallet top-up is platform-level financial transaction |
| 18 | **Receipt E** `sendCancellationReceipt()` | `DriveBook Payments` (hardcoded) | No | YES | PAYMENT (gap — see note) | Cancellation/refund |
| 19 | **Receipt F** `sendAdminCreditReceipt()` | `DriveBook Payments` (hardcoded) | No | No | PLATFORM-LEVEL | Admin credit — platform operation |
| 20 | **Receipt G** `sendAdminDeductionReceipt()` | `DriveBook Payments` (hardcoded) | No | No | PLATFORM-LEVEL | Admin deduction — platform operation |
| 21 | `sendClaimAccountEmail()` `lib/services/email.ts` | `DriveBook Team` | YES `getDisplayName()` | YES | BOOKING-LEVEL — notable | Subject: "{provider} booked a lesson for you — claim your account" — provider name in subject is the right approach; `From:` is platform |
| 22 | `sendWelcomeEmail()` | `DriveBook Team` | No | No | PLATFORM-LEVEL | Generic platform welcome |
| 23 | `sendPasswordResetEmail()` | `DriveBook Account Verification` | DriveBook in subject | No | PLATFORM-LEVEL ✓ | Correct — security message |
| 24 | Admin password reset `app/api/admin/users/[userId]/reset-password/route.ts` | `DriveBook Account Verification` (hardcoded) | DriveBook in subject | No | PLATFORM-LEVEL ✓ | |
| 25 | OTP verification `app/api/verifications/otp/route.ts` | `DriveBook Account Verification` (hardcoded) | DriveBook in subject/body | No | PLATFORM-LEVEL ✓ | Correct — security |
| 26 | Email verification (resend) `app/api/auth/resend-verification/route.ts` | `DriveBook Account Verification` (hardcoded) | DriveBook in subject | No | PLATFORM-LEVEL ✓ | |
| 27 | New device alert `app/api/auth/device-check/route.ts` | `DriveBook Account Verification` (hardcoded) | DriveBook in subject | No | PLATFORM-LEVEL ✓ | |
| 28 | Registration verification `app/api/register/route.ts` | `DriveBook Account Verification` (hardcoded) | `PLATFORM_NAME` env override possible | No | PLATFORM-LEVEL ✓ | Only path where a partial env-var override exists |
| 29 | Trial expiry alerts `app/api/cron/send-trial-expiry-alerts/route.ts` | `DriveBook Payments` (hardcoded) | No | No | INSTRUCTOR-FACING only | Not customer-facing |
| 30 | Subscription / payment failed (webhook) `app/api/stripe/webhook/route.ts` | `DriveBook Payments` (hardcoded) | No | No | INSTRUCTOR-FACING only | Recipients are instructors |
| 31 | Payment declined to customer (webhook) `app/api/stripe/webhook/route.ts` line 465 | defaults to `DriveBook Support` | No | No | PLATFORM-LEVEL ✓ | Financial failure — platform identity appropriate |

---

## SMS Path Inventory

| # | Function / File | From | Provider name in body? | Classification |
|---|---|---|---|---|
| 1 | `sendBookingConfirmation()` `lib/services/sms.ts` | Twilio platform number | YES `getDisplayName()` | BOOKING-LEVEL (gap — sender is platform number) |
| 2 | `sendLessonReminderStudent()` | Twilio platform number | YES `getDisplayName()` | BOOKING-LEVEL (gap) |
| 3 | `sendLessonReminderInstructor()` | Twilio platform number | YES | Instructor-facing |
| 4 | OTP SMS `app/api/verifications/otp/route.ts` | Twilio platform number | No | PLATFORM-LEVEL ✓ |
| 5 | Check-in/out SMS | Twilio platform number | No | BOOKING-LEVEL — mild |
| 6 | Waiting list SMS `lib/services/waiting-list-notify.ts` | Twilio platform number | YES `getDisplayName()` | BOOKING-LEVEL (gap) |
| 7 | Admin refund SMS | Twilio platform number | No | PLATFORM-LEVEL |
| 8 | Instructor manual reminder `app/api/instructor/remind-client/route.ts` | Twilio platform number | Depends on content | BOOKING-LEVEL |
| 9 | Failed payout SMS (webhook) | Twilio platform number | No | INSTRUCTOR-FACING only |

---

## Scope Discussion: Payment Receipts

Receipt emails A, B, C, E use `DriveBook Payments <payments@drivebook.com.au>` and contain the provider/business name in the body. The scope question: should a white-label BUSINESS provider's payment receipts also carry platform identity?

**Arguments for platform identity on receipts:**
- The payment was collected by DriveBook (Stripe Connect, platform wallet)
- Financial/legal traceability requires the collecting entity to be identifiable
- Industry norm: payment processors send receipts under their own name

**Arguments for provider identity on receipts (A/B/C/E):**
- A BUSINESS-tier provider may have customers who don't know the booking is powered by DriveBook
- The receipt subject line could include the business name while retaining DriveBook Payments as the technical sender
- Receipt E (cancellation/refund) is a direct consequence of a provider decision

**Assessment:** Receipt D (wallet top-up), F (admin credit), G (admin deduction) are clearly platform-level and should retain DriveBook Payments. Receipts A, B, C, E contain provider context and may be candidates for a modified subject line (not necessarily sender change). This is a **product decision**, not a code defect that can be fixed without policy guidance.

---

## Key Findings Summary

1. **Confirmed gap (booking/reminder):** All booking confirmation, cancellation, reminder, and waiting-list emails use fixed `DriveBook Bookings` sender even when the provider has BUSINESS/PREMIUM branding entitlement. Provider name appears correctly in message body via `getDisplayName()` but not in `From:`. Paths: items 1–13 in email table, items 1–2 in SMS table.

2. **Confirmed gap (receipts A/B/C/E):** Receipt emails for lesson bookings, packages, and cancellations use `DriveBook Payments` sender and name "DriveBook" in receipt headings, even when `getDisplayName()` produces a business name in the body. Whether this is a defect or correct marketplace behaviour requires a product decision.

3. **Correctly platform-level:** All security/account communications (OTP, password reset, device alert, verification, new device) correctly use DriveBook identity. No finding here.

4. **Architecture documented:** `lib/email/context.ts` already documents the white-label `schoolId`/`branding` hook as future work. The gap is not an oversight — it is deferred implementation.

5. **No marketplace vs white-label routing:** There is no code path that selects a different `From:` sender based on whether the customer booked via a custom domain or the main platform. Both routes call the same sender resolution which always returns a DriveBook alias.

6. **SMS sender cannot be per-provider** without a Twilio sub-account or phone number provisioning strategy — this is an infrastructure constraint, not just a code gap.

---

## Recommended Scope for WLA-015 Fix

**In scope (code change possible):**
- Booking confirmation emails (1): add provider name to `From:` display name when provider has BUSINESS/PREMIUM/STUDIO tier
  - e.g. `"Perth Drive Academy (via DriveBook)" <bookings@drivebook.com.au>`
- Booking cancellation emails (2, 3): same
- Reminder emails (11): same
- Waiting list emails (12): same

**Requires product decision (deferred):**
- Receipt email sender and heading (A/B/C/E): whether DriveBook Payments remains even for white-label providers
- SMS sender: requires infrastructure (Twilio sub-account per provider)

**No change needed:**
- Security/account emails (23–28)
- Platform financial messages (17, 19, 20, D, F, G)
- Instructor-only emails (29–31)
