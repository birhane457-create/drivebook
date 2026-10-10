---
inclusion: always
---

# Booking Engine Architecture — Three-Layer Separation

This document defines the mandatory separation between the core booking engine, product-specific rules, and payment execution. **Every change to booking, cancellation, or refund logic must respect these boundaries.**

---

## The Three Layers

### Layer 1 — Core Booking Engine

**Location:** `lib/services/booking-service.ts`, `app/api/bookings/`

**Responsible for:**
- Generic booking state transitions (PENDING_PAYMENT → CONFIRMED → COMPLETED → CANCELLED)
- Payment-mode awareness: knows whether the booking used PLATFORM or DIRECT payment
- Transaction records and the FinancialLedger
- Audit logs for every state change
- Cancellation orchestration: receives a cancellation instruction and the refund amount to issue; does not calculate the amount itself
- Duplicate-request protection and idempotency

**Must NOT:**
- Contain driving-specific cancellation or refund rules
- Hardcode tier-aware discount percentages
- Assume DriveBook controls the payment for every booking
- Calculate refund amounts — it receives them from Layer 2
- Execute Stripe refunds directly — it delegates to Layer 3

**Current state:** `cancelBooking()` in `booking-service.ts` mixes all three layers. It calculates the refund via `calculatePartialPackageRefund()` (Layer 2 work), issues the wallet credit (Layer 1 work), and does not check payment authority (Layer 3 missing). This must be refactored as each finding is addressed.

---

### Layer 2 — Product Rules (Driving)

**Location:** `lib/services/driving/` (to be created), or guarded sections of `booking-service.ts` until refactored

**Responsible for:**
- Determining cancellation eligibility for a driving lesson
- Calculating the refundable base amount (tier-aware, usage-based)
- Applying time-based policy (48h/24h thresholds from PlatformSettings)
- Returning a `CancellationDecision` to Layer 1 — it does not execute anything

**Must NOT:**
- Exist in shared booking engine paths used by non-driving products
- Directly write to the database
- Know which payment adapter will execute the refund

**The `calculatePartialPackageRefund()` function is Layer 2 logic.** It lives in `booking-service.ts` today because the layers have not yet been separated. It is correct in intent but depends on stale `packageHoursRemaining`. See `package-entitlement-policy.md` for the replacement formula.

**`CancellationDecision` shape (target — not yet implemented):**
```typescript
interface CancellationDecision {
  eligible: boolean
  refundableAmount: number    // before time-policy applied; from Layer 2 calculation
  finalRefundAmount: number   // after time-policy applied
  refundPercentage: number
  hoursNotice: number
  reason: string
  authority: 'DRIVEBOOK' | 'BUSINESS_DIRECT' | 'NONE'
}
```

---

### Layer 3 — Payment Execution Adapter

**Location:** `lib/services/payment-adapter.ts` (to be created)

**Responsible for:**
- Checking `Booking.source` and `Provider.paymentMode` to determine who controls the money
- For `paymentMode = 'PLATFORM'`: executing the Stripe refund and wallet credit
- For `paymentMode = 'DIRECT'` (phase 2): recording that a refund is required and notifying the business; DriveBook does NOT execute the refund
- Returning a `RefundResult` to Layer 1 for recordkeeping

**Must NOT:**
- Determine how much to refund — that comes from Layer 2
- Be called if Layer 2 has not first confirmed the booking is eligible for refund

**Current state:** The Stripe refund path exists in `app/api/admin/transactions/[transactionId]/refund/route.ts` and inside `booking-service.ts`. Neither checks payment authority before executing. This is safe today only because `paymentMode = 'DIRECT'` is blocked at booking creation time (phase 2 guard). The guard must remain in place until the adapter is implemented.

---

## The Two Payment Models

| Responsibility | DriveBook-managed (PLATFORM) | White-label direct (DIRECT — phase 2) |
|---|---|---|
| Customer pays | Through DriveBook's Stripe account | Through the business's own Stripe account |
| Refund policy | Driving product rules (Layer 2) | Defined and administered by the business |
| Refund execution | DriveBook executes via Stripe (Layer 3) | Business or their payment provider executes; DriveBook records only |
| DriveBook's role | Payment, ledger, refund, reconciliation | Booking state, integration status, audit records |
| Reconciliation | DriveBook reconciles its Stripe transactions | Business reconciles their own transactions |

**Critical rule:** White-label branding alone does not determine who handles refunds. Only `Provider.paymentMode` and who actually received the original payment determine refund authority. A PREMIUM-tier instructor with custom branding is still `paymentMode = 'PLATFORM'` today and DriveBook executes their refunds normally.

---

## Cancellation Flow — Target Architecture

```
Student or instructor triggers cancellation
         │
         ▼
Layer 1: booking-service.ts
  validateCancellationRequest()
  — Check booking status is cancellable
  — Check who is cancelling (actorRole)
  — Read Provider.paymentMode
         │
         ▼
Layer 2: driving product rules (if businessType = 'driving')
  calculateCancellationDecision(booking)
  — Fetch child booking prices (see package-entitlement-policy.md)
  — Apply time-based policy from PlatformSettings
  — Return CancellationDecision { finalRefundAmount, authority }
         │
         ▼
Layer 1: booking-service.ts
  orchestrateCancellation(booking, decision)
  — Set Booking.status = 'CANCELLED'
  — Write AuditLog
  — Call Layer 3 with decision.finalRefundAmount
         │
         ▼
Layer 3: payment-adapter (when authority = 'DRIVEBOOK')
  executeRefund(booking, amount)
  — paymentMode = 'PLATFORM': Stripe refund + wallet debit to zero remaining credit
  — paymentMode = 'DIRECT': record refund obligation, notify business, no Stripe call
  — Return RefundResult { stripeRefundId, status }
         │
         ▼
Layer 1: booking-service.ts
  finaliseRecord(booking, refundResult)
  — Store stripeRefundId on Booking
  — Update WalletTransaction
  — Send notifications
```

---

## What This Means for Open Findings

### H-01 (Refund calculation using stale hours)
Fix is in **Layer 2**: replace `calculatePartialPackageRefund()` stale-hours formula with the wallet-attributed formula defined in `package-entitlement-policy.md`. Layer 1 (`cancelBooking`) receives the corrected amount; it does not change.

### H-02 (Child booking `price: 0`)
Fix is in **Layer 2** and bookkeeping: set `Booking.price = instructor.hourlyRate × duration` on each confirmed child booking. This makes `sum(child Booking.price)` reliable as the "amount consumed" input to the Layer 2 refund formula. See `package-entitlement-policy.md`.

### H-02b (Read Committed isolation in confirm-package-booking)
Fix is in **Layer 1**: wrap the confirm transaction with `withSerializableRetry` and `isolationLevel: 'Serializable'`. This is a concurrency safety fix, not a product-rules change.

### Admin cancellation UI (H-01a)
The admin modal calls its own refund formula (simple proportion). Once Layer 2 has a single `calculateCancellationDecision()` function, both the admin UI and the server cancellation path must call the same function. No separate formula may exist.

---

## Rules for Every Future Change

1. **Do not add driving-specific logic to `booking-service.ts` generic paths.** Add a `isDriving` guard or place it in the driving product layer.

2. **Do not execute a Stripe refund without first checking `Provider.paymentMode`.** Until the payment adapter exists, the existing `paymentMode = 'DIRECT'` runtime guard in `assertPlatformPaymentMode()` must remain in place.

3. **Do not calculate a refund amount in a UI component or API route.** Calculation belongs in Layer 2. Routes and UI receive the result.

4. **Do not create a `WalletTransaction` in Layer 2 or Layer 3 directly.** All wallet writes are Layer 1's responsibility, using amounts provided by Layer 2 and Layer 3.

5. **The `PackageCancellationModal` client-side estimate must call the same server function as the approval route.** A preview endpoint exposing `calculateCancellationDecision()` is the correct solution — not a parallel client formula.
