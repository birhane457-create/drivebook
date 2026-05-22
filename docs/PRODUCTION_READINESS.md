# Production Readiness — Gap Analysis & Fix Plan

**Date:** May 2026  
**Scope:** Full platform — booking, instructor, admin, payments, compliance.  
**Status:** Core platform complete. 2 config items remain before go-live (P0.1, P0.2).

---

## Current State Summary

The core booking flow (subdomain → package → payment → wallet) is working end-to-end. All P0, P1, and P2 items from the original April 2026 review are resolved. The following documents the current state.

---

## P0 — Hard Blockers (must fix before any real users)

### P0.1 — Stripe Webhook Secret is a placeholder

**Current state:**  
`STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here` in production `.env` / Vercel.  
The webhook handler verifies the Stripe signature on every event. If the secret is wrong, every `payment_intent.succeeded` event is rejected with a 400. Bookings never confirm. Wallets never credit.

**Impact:** Every payment succeeds on Stripe but the booking stays `PENDING_PAYMENT` forever. Student paid, got nothing.

**Fix:**  
1. Go to Stripe Dashboard → Webhooks → select the `drivebook.com.au/api/stripe/webhook` endpoint
2. Copy the signing secret (`whsec_...`)
3. Set `STRIPE_WEBHOOK_SECRET=whsec_...` in Vercel environment variables
4. Redeploy

**Files:** `.env`, Vercel dashboard  
**Effort:** 5 minutes (config only, no code change)

---

### P0.2 — Google Calendar redirect URI typo (production env)

**Current state:**  
The `.env` file in dev has `GOOGLE_REDIRECT_URI=https://localhost:3000/api/calendar/callback` which is correct for dev. However, the production Vercel env must be set to `https://drivebook.com.au/api/calendar/callback`. If it was ever set with the reported typo (`deivebook`), every instructor who tries to connect Google Calendar gets an OAuth error.

**Impact:** Google Calendar sync is broken for all instructors in production.

**Fix:**  
1. Check Vercel environment variables for `GOOGLE_REDIRECT_URI`
2. Ensure it is exactly `https://drivebook.com.au/api/calendar/callback`
3. Also verify in Google Cloud Console → OAuth credentials → Authorised redirect URIs

**Files:** Vercel dashboard, Google Cloud Console  
**Effort:** 5 minutes (config only)

---

## P1 — High Priority (fix before first real instructor goes live)

### P1.1 — Instructor not notified on normal (non-short-notice) booking ✅ DONE

**Was:** Only short-notice bookings triggered `notifyShortNoticeBookingRequest`. Normal bookings sent no notification to the instructor.

**Fixed:** `app/api/public/bookings/bulk/route.ts` now calls `notifyBookingRequest` to the instructor and `notifyClientBookingConfirmed` to the student for all normal (non-short-notice) bookings.

---

### P1.2 — No lesson reminder notifications ✅ DONE

**Was:** `notifyLessonReminder` was defined but never called. No cron existed.

**Fixed:**
- Added `notifyLessonReminderInstructor` and `notifyLessonReminderStudent` to `lib/services/notifications.ts`
- Created `app/api/cron/lesson-reminders/route.ts` — queries CONFIRMED bookings in the 23-25hr window, sends reminders to both parties
- Added to `vercel.json`: `"0 22 * * *"` (10pm UTC = 8am AEST)

---

### P1.3 — Compliance email reminders not triggered automatically ✅ DONE

**Was:** `sendReminder` in the compliance route called `notifyDocumentExpiring` but only when an admin manually clicked "Send Reminder". No automated check existed.

**Fixed:**
- Created `app/api/cron/document-expiry-check/route.ts` — queries instructors with documents expiring within 30 days, sends `notifyDocumentExpiring` for each
- Added to `vercel.json`: `"0 2 * * 1"` (Mondays 2am UTC, same schedule as ABN recheck)

---

### P1.4 — Student post-payment onboarding gap ✅ DONE

**Was:** New students had no clear path to their account after paying. Confirmation pages had no login prompt.

**Fixed:**
- `app/booking/[id]/confirmation/page.tsx` — unauthenticated users now see "Your DriveBook account was created automatically. Login with the email you used to book."
- `app/payment/wallet/[transactionId]/confirmation/page.tsx` — same message + login link added
- `lib/services/receipt-email.ts` footer — added login link and "New to DriveBook? Your account was created automatically" note to all receipt emails

---

## P2 — Medium Priority (fix within first week of production)

### P2.1 — Instructor "book on behalf" requires existing account + wallet balance ✅ DONE

**Was:**  
`POST /api/bookings` hard-rejected if `client.userId` was null — meaning the client had no DriveBook account. Instructors couldn't book for new students who hadn't registered yet.

**Fixed:**  
- `app/api/bookings/route.ts` — removed the hard block. If `client.userId` is null, the booking is created with status `PENDING_PAYMENT` (no wallet deduction). A "claim your account" email is sent to the student with a registration link pre-filled with their email and the booking ID.
- `lib/services/email.ts` — added `sendClaimAccountEmail()` method.
- `app/dashboard/clients/page.tsx` — clients without a DriveBook account now show an amber "No account" badge and an explanatory note in the expanded view.

The existing `POST /api/clients` already creates a `Client` without requiring a `User`, so no new endpoint was needed.

---

### P2.2 — AuditLog missing for instructor-created bookings ✅ DONE

**Was:** `POST /api/bookings` created no `AuditLog` entry.

**Fixed:** `app/api/bookings/route.ts` now calls `logBookingAction(BOOKING_CREATED, INSTRUCTOR, ...)` after successful booking creation.

---

### P2.3 — Wallet-only refund policy not communicated to students ✅ DONE

**Was:** Students could cancel without knowing refunds go to wallet, not original card.

**Fixed:** `components/CancelDialog.tsx` now shows: "Refunds are credited to your DriveBook wallet, not your original payment card. Wallet credits can be used for future lessons."

---

## P3 — Post-Launch Enhancements (within first month)

| Item | Current State | Plan |
|------|--------------|------|
| Stripe Connect automated payouts | Manual bank transfer only | Wire `payout-service.ts` Stripe Connect path; requires instructors to complete Stripe onboarding |
| Lesson reminder SMS | Email only | Add Twilio SMS via existing notification channels |
| Student can message instructor | No in-platform messaging | Add simple message thread on booking detail page |
| Instructor can block specific dates | Weekly hours only | Add `AvailabilityException` model + UI |
| Review moderation (admin) | Display only | Add publish/hide/flag actions to admin reviews page |

---

## May 2026 — Additional Fixes Applied

These items were identified and resolved after the April 2026 review:

| Item | Fix |
|------|-----|
| Instructor approval gate | PENDING instructors blocked from creating bookings (`POST /api/bookings`, `/api/bookings/offline`, `/api/pda-tests`). `PendingApprovalBanner` shown on dashboard. |
| Instructor terms at registration | Mandatory Terms + Privacy Policy checkboxes on `/register`. `termsAcceptedAt` recorded on `User`. |
| Separate learner/instructor terms | `/terms` (learner), `/instructor-terms` (instructor), `/privacy` (shared). All footers updated. |
| Pending payment screen | When instructor books for a client with no funds, shows informative amber screen instead of fast redirect. |
| Admin instructor list — subscription data | `subscriptionTier`, `subscriptionStatus`, `termsAcceptedAt`, joined date now included in Prisma query and displayed. |
| Admin instructor list — pending badge | Amber count badge on "Pending" filter tab. Alert banner when PENDING instructors exist. |
| Admin payouts — Hold button | Hold button added to manual-transfer tab. `handleHoldPayout` calls `POST /api/admin/payouts/[payoutId]/hold`. |
| Admin support — wallet credit ID fix | Support page now uses `clientId` (Client record ID) not `userId` for wallet credit API call. |
| Admin instructor detail — terms/joined | `termsAcceptedAt` and real joined date shown on instructor detail page. |

---

## Not Blocking (accepted for launch)

| Item | Reason |
|------|--------|
| 10-minute slot expiry | Intentional. Revival path handles late payments. Acceptable UX. |
| Wallet-only refunds | Policy decision, not a bug. Fix is copy/UX only (P2.3 above). |
| New tab payment UX | Works. Anchor click approach bypasses popup blockers. |
| Bank account ownership verification | No public AU API. Stripe Connect handles identity. Deferred. |
| ATO withholding remittance | Legal/accounting decision. Platform withholds correctly. Remittance process is manual for now. |
| Business tier | Marked "Coming Soon". Not blocking launch. |
| Staff governance stats API | Admin enhancement. Not blocking. |

---

## Fix Order Summary

| Priority | Item | Status |
|----------|------|--------|
| P0.1 | Set real Stripe webhook secret in Vercel | ⚠️ Config — must be done manually in Vercel dashboard |
| P0.2 | Verify Google redirect URI in Vercel | ⚠️ Config — must be verified in Vercel + Google Cloud Console |
| P1.1 | Instructor notification on normal booking | ✅ Done |
| P1.2 | Lesson reminder cron | ✅ Done |
| P1.3 | Document expiry cron | ✅ Done |
| P1.4 | Student post-payment onboarding email | ✅ Done |
| P2.1 | Instructor book-on-behalf for new clients | ✅ Done |
| P2.2 | AuditLog for instructor bookings | ✅ Done |
| P2.3 | Wallet refund policy copy | ✅ Done |
