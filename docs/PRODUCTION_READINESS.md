# Production Readiness — Gap Analysis & Fix Plan

**Date:** April 2026  
**Scope:** Student booking, instructor booking, and core communication flows only.  
Admin enhancements and Business tier deferred to post-launch.

---

## Current State Summary

The core booking flow (subdomain → package → payment → wallet) is working end-to-end in dev. The following gaps were identified through code inspection and external review. Each item is documented as-is, with a clear fix plan.

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

### P1.1 — Instructor not notified on normal (non-short-notice) booking

**Current state:**  
In `app/api/public/bookings/bulk/route.ts`, `notifyShortNoticeBookingRequest` is called only when `isShortNotice === true`. For normal bookings (`PENDING_PAYMENT`), no notification is sent to the instructor.

```typescript
if (isShortNotice) {
  // notify instructor
}
// Normal bookings: instructor gets no notification
```

**Impact:** Instructor doesn't know a student booked. They find out when they check the dashboard or when the student shows up.

**Fix:**  
After the booking is confirmed (post-payment via webhook), send `notifyBookingRequest` to the instructor. The webhook already handles this for the payment success path — verify it fires correctly. For the "book later" path (wallet only), add a notification after wallet transaction is confirmed.

**Files:** `app/api/stripe/webhook/route.ts` (verify notification fires), `app/api/public/bookings/bulk/route.ts`  
**Effort:** 1-2 hours

---

### P1.2 — No lesson reminder notifications

**Current state:**  
`notifyLessonReminder()` is defined in `lib/services/notifications.ts` but is never called. No cron job exists to send reminders before lessons.

**Impact:** Students and instructors get no reminder. Missed lessons, no-shows, chargebacks.

**Fix:**  
Create `app/api/cron/lesson-reminders/route.ts`:
- Runs daily (e.g. 8am via Vercel cron)
- Queries bookings with `status: CONFIRMED` and `startTime` between now+23hrs and now+25hrs
- Calls `notifyLessonReminder(instructorUserId, studentName, bookingId, startTime)` for each
- Calls a student reminder notification (add `notifyStudentLessonReminder` to notifications service)

Add to `vercel.json`:
```json
{ "path": "/api/cron/lesson-reminders", "schedule": "0 22 * * *" }
```
(10pm UTC = 8am AEST)

**Files:** `app/api/cron/lesson-reminders/route.ts` (new), `lib/services/notifications.ts`, `vercel.json`  
**Effort:** 3-4 hours

---

### P1.3 — Compliance email reminders not triggered automatically

**Current state:**  
`app/api/admin/documents/compliance/route.ts` has a `sendReminder` action that calls `notifyDocumentExpiring()` — this part works. However, it is only triggered manually by an admin clicking "Send Reminder" in the admin UI. There is no automated cron that checks for expiring documents and sends reminders proactively.

**Impact:** Instructor's insurance expires. Payouts are blocked. Instructor was never warned. Support ticket.

**Fix:**  
Create `app/api/cron/document-expiry-check/route.ts`:
- Runs weekly (Mondays 2am)
- Queries instructors with documents expiring in the next 30 days
- Sends `notifyDocumentExpiring` for each expiring document
- Already exists as `app/api/cron/recheck-abn/route.ts` — follow same pattern

**Files:** `app/api/cron/document-expiry-check/route.ts` (new), `vercel.json`  
**Effort:** 2-3 hours

---

### P1.4 — Student post-payment onboarding gap

**Current state:**  
After a student books via subdomain and pays, they land on a confirmation page. But:
- New students don't know their account was created
- No clear "login to see your booking" prompt
- No email with login credentials or booking summary (receipt email fires but may not include login link)

**Impact:** Student paid, has no idea how to access their booking or schedule remaining lessons.

**Fix:**  
1. Add to the booking confirmation email: "Your DriveBook account has been created. Login at drivebook.com.au/login with your email."
2. Update `/booking/[id]/confirmation` and `/payment/wallet/[transactionId]/confirmation` to show: "Check your email for your booking confirmation and login details."
3. Ensure the receipt email (`sendPackagePurchaseReceipt`) includes a login link

**Files:** `lib/services/receipt-email.ts`, `app/booking/[id]/confirmation/page.tsx`, `app/payment/wallet/[transactionId]/confirmation/page.tsx`  
**Effort:** 2 hours

---

## P2 — Medium Priority (fix within first week of production)

### P2.1 — Instructor "book on behalf" requires existing account + wallet balance

**Current state:**  
`POST /api/bookings` (instructor-created booking) requires:
- `client.userId` must exist (client must have a DriveBook account)
- Client wallet balance ≥ lesson price

If an instructor is sitting with a new student who hasn't registered, they cannot book for them.

**Impact:** Instructors can't onboard new students face-to-face. They have to tell the student to go home and register online first.

**Fix (pragmatic for launch):**  
Add a "Create account for client" flow in the instructor dashboard:
1. Instructor enters client name + email + phone
2. System creates a `User` + `Client` record with a temporary password
3. Sends welcome email to client with login link
4. Instructor can then book for them immediately

For the wallet requirement: allow instructors to create a booking with `paymentMethod: 'invoice'` that creates the booking as `CONFIRMED` and marks it as "payment pending" — instructor collects cash/card directly.

**Files:** `app/api/bookings/route.ts`, new `app/api/instructor/clients/create/route.ts`, `app/dashboard/clients/page.tsx`  
**Effort:** 1 day

---

### P2.2 — AuditLog missing for instructor-created bookings

**Current state:**  
`POST /api/bookings` creates no `AuditLog` entry. If an instructor creates a booking and something goes wrong (wrong price, wrong client, dispute), there is no trace.

**Fix:**  
Add after successful booking creation in `app/api/bookings/route.ts`:
```typescript
await logBookingAction(AuditAction.BOOKING_CREATED, ActorRole.INSTRUCTOR, session.user.instructorId, booking.id, { clientId, price: lessonPrice });
```

**Files:** `app/api/bookings/route.ts`  
**Effort:** 30 minutes

---

### P2.3 — Wallet-only refund policy not communicated to students

**Current state:**  
All cancellation refunds go to the DriveBook wallet, not the original payment card. This is by design but students don't know this before cancelling.

**Impact:** Student cancels, expects bank refund, sees wallet credit, raises Stripe chargeback.

**Fix:**  
Add to the cancel confirmation modal: "Refunds are credited to your DriveBook wallet, not your original payment card. Your wallet balance can be used for future lessons."

**Files:** `app/client-dashboard/bookings/[id]/page.tsx` (cancel modal)  
**Effort:** 30 minutes

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

| Priority | Item | Effort | Who |
|----------|------|--------|-----|
| P0.1 | Set real Stripe webhook secret in Vercel | 5 min | Config |
| P0.2 | Verify Google redirect URI in Vercel | 5 min | Config |
| P1.1 | Instructor notification on normal booking | 2 hrs | Code |
| P1.2 | Lesson reminder cron | 4 hrs | Code |
| P1.3 | Document expiry cron | 3 hrs | Code |
| P1.4 | Student post-payment onboarding email | 2 hrs | Code |
| P2.1 | Instructor book-on-behalf for new clients | 1 day | Code |
| P2.2 | AuditLog for instructor bookings | 30 min | Code |
| P2.3 | Wallet refund policy copy | 30 min | Copy |
