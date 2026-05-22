# Receipt System

**Service:** `lib/services/receipt-email.ts`  
**Last updated:** May 2026

## Overview

DriveBook sends automated email receipts to students for every payment event. All receipts are:

- **Traceable** — receipt ID is always a DB-backed CUID (`WalletTransaction.id` or `Booking.id`), never a timestamp or synthetic value
- **Unique** — CUIDs are globally unique; no collision possible
- **Immutable** — the DB record the ID points to cannot be deleted or modified
- **Auditable** — admin wallet operations also write to `AuditLog` with the same `transactionId`

Receipt number format: `DB-{YEAR}-{LAST6_OF_ID}` (e.g. `DB-2026-A3F9C1`)  
To look up a receipt: query `WalletTransaction` or `Booking` by the last 6 chars of the ID.

---

## Receipt Types

### A — Package Purchase
**Trigger:** Stripe `payment_intent.succeeded` where `isPackageBooking = true`  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleBookingPaymentSuccess`  
**Function:** `sendPackagePurchaseReceipt()`  
**Receipt ID:** `Booking.id`

What it shows:
- Package hours purchased, instructor name, first lesson date/time, pickup address
- Payment breakdown: `packageHours × lockedHourlyRate`, package discount (from `lockedDiscountPct`), platform fee, total charged
- Payment method and Stripe reference (`paymentIntent.id`)
- Wallet balance: credits loaded, first lesson debit, remaining balance with approx hours
- Cancellation policy
- "Manage booking" link in footer

---

### B — Wallet Lesson Booking
**Trigger:** Instructor creates booking via `POST /api/bookings` — wallet debited atomically  
**Also triggered:** Client books from dashboard via `POST /api/client/bookings/create-bulk`  
**Function:** `sendWalletLessonReceipt()`  
**Receipt ID:** `Booking.id`

What it shows:
- Lesson date, time, duration, instructor name
- "Booked by: Your instructor (Name)" label when `bookedBy: 'instructor'`
- Payment: hrs × rate, deducted from wallet, $0.00 charged to card
- Wallet balance: before, debit, after with approx hours remaining
- Cancellation policy
- "Manage booking" link in footer

Key difference from Stripe receipts: no card charge, no platform fee line — GST was already collected when the wallet was topped up.

---

### C — Single Lesson (Stripe)
**Trigger:** Stripe `payment_intent.succeeded` for a non-package single booking  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleBookingPaymentSuccess`  
**Function:** `sendSingleLessonReceipt()`  
**Receipt ID:** `Booking.id`

What it shows:
- Lesson date, time, duration, instructor name, pickup address
- Payment breakdown: hrs × rate, platform fee (3.6%), total charged
- Payment method and Stripe reference
- Upsell nudge: "Save with a package — buy 10 hours and save $X"
- Cancellation policy
- "Manage booking" link in footer

---

### D — Wallet Top-Up
**Two trigger paths:**

**Path 1 (new flow):** `POST /api/client/wallet-topup-intent` creates a PENDING `WalletTransaction`, Stripe webhook confirms it  
**Wired in:** `app/api/stripe/webhook/route.ts` → `handleWalletPaymentSuccess`

**Path 2 (legacy flow):** `POST /api/client/wallet-add` — used by `AddCreditsModal` and `add-funds` page  
**Wired in:** `app/api/client/wallet-add/route.ts` directly

**Function:** `sendWalletTopUpReceipt()`  
**Receipt ID:** `WalletTransaction.id` (the confirmed transaction)

What it shows:
- Credits added (large green amount)
- Payment method and Stripe reference (if Stripe-initiated)
- Wallet balance: previous (computed from transactions, not stored field), top-up added, new balance with approx hours
- Note: "Credits never expire and can be used with any instructor on DriveBook"

**Note on balance accuracy:** Both paths use `getWalletBalance()` (transaction-computed) not `ClientWallet.balance` (stored field, not updated by the transaction-based system).

---

### E — Cancellation
**Trigger:** `POST /api/bookings/[id]/cancel` — any party (instructor, client, admin)  
**Wired in:** `app/api/bookings/[id]/cancel/route.ts` after audit log  
**Function:** `sendCancellationReceipt()`  
**Receipt ID:** `Booking.id`

What it shows:
- Cancelled lesson date, time, instructor name
- Who cancelled (you / your instructor / DriveBook support)
- Refund summary: lesson price, refund amount (or reason for no refund)
- Wallet balance after refund (only shown if refund > 0)
- Support contact link

---

### F — Admin Manual Credit
**Trigger:** Admin adds wallet credit via `POST /api/admin/clients/[id]/wallet/add-credit`  
**Wired in:** `app/api/admin/clients/[id]/wallet/add-credit/route.ts`  
**Function:** `sendAdminCreditReceipt()`  
**Receipt ID:** `WalletTransaction.id` (the created transaction)

What it shows:
- Credits added (large green amount)
- Reason for credit
- Wallet balance: previous (read before credit), credit added, new balance
- "Issued by: DriveBook Support"

**Audit trail:** Every admin credit also writes a `WALLET_CREDITED` entry to `AuditLog` with `transactionId`, `userId`, `amount`, `reason`, `balanceBefore`, `balanceAfter`.

---

### G — Admin Manual Deduction
**Trigger:** Admin deducts wallet credit via `POST /api/admin/clients/[id]/wallet/deduct-credit`  
**Wired in:** `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts`  
**Function:** `sendAdminDeductionReceipt()`  
**Receipt ID:** `WalletTransaction.id` (the created transaction)

What it shows:
- Amount deducted (large red amount)
- Reason for deduction (required — min 3 chars)
- Transaction ID shown prominently in meta table and footer — student can quote it in a dispute
- Wallet balance: previous (read before deduction), deduction, new balance
- "Issued by: DriveBook Support"
- Footer: "If you believe this deduction was made in error, contact us and quote Transaction ID [id]"

**Audit trail:** Every admin deduction also writes a `WALLET_DEDUCTED` entry to `AuditLog` with `transactionId`, `userId`, `amount`, `reason`, `balanceBefore`, `balanceAfter`.

---

## Complete Coverage Table

| Event | Route | Receipt | Receipt ID source |
|-------|-------|---------|-------------------|
| Instructor books lesson (wallet debit) | `POST /api/bookings` | B — Wallet Lesson | `Booking.id` |
| Client books from dashboard (wallet debit) | `POST /api/client/bookings/create-bulk` | B — Wallet Lesson | `Booking.id` |
| Client pays single lesson via Stripe | Stripe webhook | C — Single Lesson | `Booking.id` |
| Client buys package via Stripe | Stripe webhook | A — Package Purchase | `Booking.id` |
| Client tops up wallet via Stripe (new flow) | Stripe webhook | D — Wallet Top-Up | `WalletTransaction.id` |
| Client tops up wallet via card (legacy flow) | `POST /api/client/wallet-add` | D — Wallet Top-Up | `WalletTransaction.id` |
| Booking cancelled (any party) | `POST /api/bookings/[id]/cancel` | E — Cancellation | `Booking.id` |
| Admin adds wallet credit | `POST /api/admin/clients/[id]/wallet/add-credit` | F — Admin Credit | `WalletTransaction.id` |
| Admin deducts wallet credit | `POST /api/admin/clients/[id]/wallet/deduct-credit` | G — Admin Deduction | `WalletTransaction.id` |

---

## Receipt ID Traceability

Every receipt ID maps directly to a DB record:

| Receipt ID type | DB model | How to look up |
|----------------|----------|----------------|
| `Booking.id` | `Booking` | `prisma.booking.findUnique({ where: { id } })` |
| `WalletTransaction.id` | `WalletTransaction` | `prisma.walletTransaction.findUnique({ where: { id } })` |

Receipt number `DB-2026-A3F9C1` → last 6 chars = `A3F9C1` → search both models for IDs ending in `A3F9C1`.

---

## Implementation Notes

- All receipt calls are wrapped in `try/catch` — a receipt failure never blocks the booking or payment flow
- Receipt emails are sent **after** the DB transaction commits, never inside it
- Wallet balance shown on receipts uses `getWalletBalance()` (transaction-computed) — not `ClientWallet.balance` (stored field, not updated by the transaction-based system)
- The `bookedBy` field on type B distinguishes instructor-initiated vs student-initiated bookings
- HTML uses inline styles and HTML entities (no JSX) for maximum email client compatibility
- Package receipt uses `lockedDiscountPct` and `lockedHourlyRate` from the booking record — shows the actual discount applied at time of purchase

---

## File Locations

| File | Purpose |
|------|---------|
| `lib/services/receipt-email.ts` | All 7 receipt functions (A–G) |
| `app/api/bookings/route.ts` | Wires type B after instructor wallet debit |
| `app/api/client/bookings/create-bulk/route.ts` | Wires type B per booking after client wallet debit |
| `app/api/stripe/webhook/route.ts` | Wires types A, C, D (Stripe flow) after Stripe confirms |
| `app/api/client/wallet-add/route.ts` | Wires type D (legacy flow) after direct wallet credit |
| `app/api/bookings/[id]/cancel/route.ts` | Wires type E after cancellation |
| `app/api/admin/clients/[id]/wallet/add-credit/route.ts` | Wires type F after admin credit |
| `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` | Wires type G after admin deduction |
