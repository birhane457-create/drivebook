# Receipt System

## Overview

DriveBook sends automated email receipts to students for every payment event. Receipts are handled by `lib/services/receipt-email.ts` and wired into the relevant API routes.

Receipt numbers follow the format `DB-{YEAR}-{LAST6_OF_ID}` (e.g. `DB-2026-A3F9C1`).

---

## Receipt Types

### A — Package Purchase
**Trigger:** Stripe `payment_intent.succeeded` where `isPackageBooking=true`  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleBookingPaymentSuccess`  
**Function:** `sendPackagePurchaseReceipt()`

What it shows:
- Package hours purchased and instructor name
- First lesson date, time, pickup address
- Payment breakdown: hrs × rate, discount (if any), platform fee (3.6%), total charged
- Payment method and Stripe reference
- Wallet balance: credits loaded, first lesson debit, remaining balance with approx hours
- Cancellation policy

---

### B — Wallet Lesson Booking
**Trigger:** Instructor creates a booking via `POST /api/bookings` — wallet is debited atomically  
**Wired in:** `app/api/bookings/route.ts` after transaction completes  
**Function:** `sendWalletLessonReceipt()`

What it shows:
- Lesson date, time, duration, instructor name
- "Booked by: Your instructor (Name)" label when `bookedBy: 'instructor'`
- Payment: hrs × rate, deducted from wallet, $0.00 charged to card
- Wallet balance: before, debit, after with approx hours remaining
- Cancellation policy

Key difference from Stripe receipts: no card charge, no platform fee line — GST was already collected when the wallet was topped up.

---

### C — Single Lesson (Stripe)
**Trigger:** Stripe `payment_intent.succeeded` for a non-package single booking  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleBookingPaymentSuccess`  
**Function:** `sendSingleLessonReceipt()`

What it shows:
- Lesson date, time, duration, instructor name, pickup address
- Payment breakdown: hrs × rate, platform fee (3.6%), total charged
- Payment method and Stripe reference
- Upsell nudge: "Save with a package — buy 10 hours and save $X"
- Cancellation policy

---

### D — Wallet Top-Up
**Trigger:** Stripe `payment_intent.succeeded` where metadata contains `transactionId` or `walletId` (no `bookingId`)  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleWalletPaymentSuccess`  
**Function:** `sendWalletTopUpReceipt()`

What it shows:
- Credits added (large green amount)
- Payment method and Stripe reference
- Wallet balance: previous, top-up added, new balance with approx hours
- Note: "Credits never expire and can be used with any instructor on DriveBook"

---

## Trigger Map

| Event | Route | Receipt |
|---|---|---|
| Instructor books lesson (wallet debit) | `POST /api/bookings` | B — Wallet Lesson |
| Student pays single lesson via Stripe | Stripe webhook | C — Single Lesson |
| Student buys package via Stripe | Stripe webhook | A — Package Purchase |
| Student tops up wallet via Stripe | Stripe webhook | D — Wallet Top-Up |

---

## Implementation Notes

- All receipt calls are wrapped in `try/catch` — a receipt failure never blocks the booking or payment flow
- Receipt emails are sent **after** the DB transaction commits, never inside it
- Wallet balance shown on receipts is read from `clientWallet.balance` after the transaction — this is the live balance, not a calculated value
- The `bookedBy` field on type B distinguishes instructor-initiated vs student-initiated bookings
- Receipt number is derived from the booking/transaction ID — no separate sequence needed
- HTML uses inline styles and HTML entities (no JSX) for maximum email client compatibility

---

## File Locations

| File | Purpose |
|---|---|
| `lib/services/receipt-email.ts` | All 4 receipt functions |
| `app/api/bookings/route.ts` | Wires type B after wallet debit |
| `app/api/stripe/webhook/route.ts` | Wires types A, C, D after Stripe confirms |
