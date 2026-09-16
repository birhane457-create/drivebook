# MM-10 / MM-05 Deep Investigation Report

**Date:** 2026-09-11  
**Type:** Read-only investigation — no production code modified  
**Purpose:** Establish exact exploitability, required invariants, and implementation order for MM-10 (SaaS direct-to-provider payment) and MM-05 (refund idempotency). Also covers MM-06, MM-07, MM-12, MM-15 secondary classification.

---

## MM-10 — SaaS Direct-to-Provider Payment

### What the Money-Movement Inventory Said

> "SaaS payment path sends money directly to a provider's Stripe account without ownership verification. Parallel vulnerability to PAY-01." — HIGH

### What the Code Actually Shows

**This finding was materially wrong. The architecture is different from PAY-01.**

The `lib/services/saas-payment.ts` `createCheckoutSession()` function creates a Stripe Checkout Session with **no `transfer_data.destination` and no `stripeAccount` header**. Money lands on the **platform's own Stripe account**, not the provider's connected account.

```typescript
// lib/services/saas-payment.ts lines 178–201 (approximate)
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: 'payment',
  line_items: lineItems,
  // ... metadata, URLs
}

if (applicationFeeAmount > 0) {
  sessionParams.payment_intent_data = {
    application_fee_amount: applicationFeeAmount,
  }
}

const session = await stripe.checkout.sessions.create(sessionParams)
```

No `transfer_data`, no `stripeAccount` = money never routes to `provider.stripeAccountId`. The PAY-01 attack — substituting `Provider.stripeAccountId` in the database to redirect money to an attacker — **is not applicable to this path** because `stripeAccountId` is never read by `createCheckoutSession()`.

### Confirmed Finding 1: Funds Never Route to the Provider (Architectural Gap)

**Severity:** Critical design gap — not an exploitable security vulnerability.

The SaaS payment model's own code comments describe the expected flow as "Customer pays provider directly via Stripe Checkout" with "Platform commission (if any) deducted as `application_fee_amount`". But the actual implementation routes money to the platform. This means:
- Every SaaS booking payment goes to the platform Stripe account
- No automatic forwarding to the provider/business occurs
- `capabilities.payouts = false` for SaaS businesses, confirming there is no payout pipeline either

This is almost certainly **incomplete implementation** — the Connect destination routing was never added. It is not a vulnerability an external attacker can exploit, but it is a business-critical bug: SaaS businesses are not receiving direct payment.

**Required invariant (when implemented):**  
When `businessConfig.paymentModel === 'saas'` and `provider.stripeAccountId !== null && provider.chargesEnabled === true`, the checkout session MUST include `transfer_data: { destination: provider.stripeAccountId }`. Before using `stripeAccountId` as destination, it MUST be verified via `stripe.accounts.retrieve(stripeAccountId).metadata.providerId === quote.providerId` (the PAY-01 invariant applied here).

### Confirmed Finding 2: `applicationFeeAmount` Is Always Zero (Logic Bug)

**Severity:** Medium (dead code — no financial impact today, but wrong when destination routing is added).

```typescript
const commissionPercent = businessConfig.capabilities.commission
  ? (businessConfig as any).commissionPercent ?? 0
  : 0
```

`businessConfig.capabilities.commission` is `false` for all SaaS businesses by schema default. Even if it were `true`, `(businessConfig as any).commissionPercent` evaluates to `undefined` because `commissionPercent` is not a field on `BusinessConfig` — `assembleConfig()` never includes it. The `?? 0` fallback makes the fee permanently zero.

The correct field is `BusinessSettings.commissionRate` (schema confirmed), which is never read by this function.

### Confirmed Finding 3: Session Creation Race Condition (Exploitable Without DB Compromise)

**Severity:** Medium — exploitable by a customer with two browser tabs.

```typescript
// Idempotency check
if (quote.stripeSessionId) {
  const existing = await stripe.checkout.sessions.retrieve(quote.stripeSessionId)
  if (existing.status === 'open') return { sessionId: existing.id, url: existing.url }
}
// ... if we get here, create a new session
const session = await stripe.checkout.sessions.create(sessionParams)
// Write session.id AFTER creation — not conditional on stripeSessionId === null
await prisma.quote.update({ where: { id: quoteId }, data: { stripeSessionId: session.id } })
```

Two concurrent requests both pass the `quote.stripeSessionId` null check before either writes. Both create Stripe sessions. Both write to `Quote.stripeSessionId` — the last write wins. Two valid payment URLs now exist for the same quote. A customer paying both creates a double-charge. `handleCheckoutComplete()`'s idempotency (`quote.status === 'PAID'`) prevents double-booking but NOT double-charge.

**Required invariant:**  
The `Quote.stripeSessionId` write must be conditional: `prisma.quote.update({ where: { id: quoteId, stripeSessionId: null }, data: { stripeSessionId: session.id } })`. If this update affects 0 rows, a concurrent request already won — return an error or retry the idempotency check.

### Confirmed Finding 4: `payment_status` Not Checked in SaaS Webhook Path

**Severity:** Low.

`handleCheckoutComplete()` does not independently verify `session.payment_status === 'paid'` before updating Quote/Booking to PAID/CONFIRMED. The wallet flow in the same handler does check this. While Stripe only fires `checkout.session.completed` after payment succeeds, the inconsistency is worth standardising.

### Classification: MM-10 Revised

**MM-10 is NOT a parallel to PAY-01.** The attack class (DB-compromise → stripeAccountId substitution) does not apply because stripeAccountId is never read. The actual findings are:

| Finding | Class | Severity |
|---|---|---|
| Funds never reach provider | Architectural incompleteness | Critical design gap (not exploit) |
| `applicationFeeAmount` always zero | Logic bug | Medium |
| Session creation race condition | Application-level exploit (no DB compromise needed) | Medium |
| `payment_status` not verified in SaaS webhook | Inconsistency | Low |

**No PAY-01-equivalent fix is needed here.** The correct fix is to complete the Connect destination routing that was clearly intended but never implemented, with ownership verification applied at that point.

---

## MM-05 — Booking Cancellation Refund Idempotency

### The five stripe.refunds.create() call sites

**Site A — `webhook/route.ts` ~line 392 (3DS/prepaid auto-refund)**

Trigger: `checkout.session.completed` → payment is `paid` but card is prepaid or 3DS failed.

```typescript
await stripe.refunds.create({
  payment_intent: paymentIntentId as string,
  metadata: { drivebookReason: '...', drivebookCheckoutSessionId: checkoutSession.id },
  // ← NO idempotencyKey
})
```

No idempotency key. Worse: this code path **does not call `recordWebhookEvent()`** — it returns early after the refund. If Stripe retries this event, the entire refund path re-executes. Stripe will prevent a second actual charge to the customer (the PaymentIntent is already fully refunded), but the application has no record of having processed this event. **Theoretical risk only** — Stripe's own deduplication is the only guard.

**Site B — `webhook/route.ts` ~line 1084 (expired booking auto-refund)**

Trigger: `payment_intent.succeeded` for an already-EXPIRED booking.

```typescript
await stripe.refunds.create(
  { payment_intent: err.paymentIntentId, reason: 'duplicate', ... },
  { idempotencyKey: `expired-booking-refund-${err.bookingId}-${err.paymentIntentId}` }
)
```

✅ Has a correct idempotency key. However: the `recordWebhookEvent()` inside the `$transaction` is always rolled back (because `ExpiredBookingError` thrown inside the callback causes Prisma to roll back). This means Stripe will keep retrying the event indefinitely (each attempt returns 500), the application will keep attempting the refund call, and the Stripe idempotency key is the only true guard. **Confirmed behavioural gap** — not exploitable but will spam alerts and Stripe retries.

**Site C — `booking-service.ts` ~line 659 (admin `approveCancellation()`)**

Trigger: Admin approves a package cancellation.

```typescript
// Check (NOT atomic with Stripe call):
if (booking.cancellationStatus !== 'PENDING') throw new Error(...)

// Then: 
stripeRefund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: Math.round(refundAmount * 100),
  reason: 'requested_by_customer',
  metadata: { bookingId, adminId, ... },
  // ← NO idempotencyKey
})

// Then atomically:
await prisma.$transaction(async tx => {
  await tx.booking.update({ data: { cancellationStatus: 'APPROVED', status: 'CANCELLED' } })
  await tx.walletTransaction.create({ type: 'DEBIT', ... })
})
```

Classic TOCTOU: `cancellationStatus !== 'PENDING'` read and `cancellationStatus = 'APPROVED'` write are not atomic. Two concurrent admin approvals both read `PENDING`, both call Stripe. No idempotency key means Stripe may issue two separate refund objects if the first hasn't fully settled.

**Classification: Confirmed theoretical vulnerability.** Requires concurrent admin submissions (browser double-click, two admins acting simultaneously, or a network retry hitting the route twice).

**Site D — `app/api/public/bookings/[id]/cancel/route.ts` ~line 250 (voice agent / self-service cancel)**

Trigger: Customer or voice agent cancels a booking via public API.

```typescript
// Atomic CAS (strongest guard):
const guard = await tx.booking.updateMany({
  where: { id: params.id, status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] } },
  data: { status: 'CANCELLED', cancelledAt: now },
})
if (guard.count === 0) throw Object.assign(new Error('ALREADY_CANCELLED'), { code: 'ALREADY_CANCELLED' })

// OUTSIDE the transaction:
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: refundAmountCents,
  reason: 'requested_by_customer',
  // ← NO idempotencyKey
})
```

The `updateMany` CAS prevents duplicate cancellation. **However:** the Stripe call is outside the transaction. If the Stripe call fails after the DB commit (network partition), the booking is cancelled but no refund is issued. There is no idempotency key to enable a safe retry. This is a **confirmed gap** — not a duplicate-refund risk, but a lost-refund risk.

**Site E — `admin/transactions/[transactionId]/refund/route.ts` ~line 99**

Trigger: Admin refunds a specific transaction.

Status check (`transaction.status !== 'COMPLETED'`) is not atomic with the Stripe call. No idempotency key. Two concurrent admin requests can both pass the status check and both call Stripe. `stripeService.createRefund()` itself has no idempotency key either.

**Classification: Confirmed vulnerability** — fully unprotected against concurrent admin submissions.

### Does DriveBook have a Refund state machine?

**No.** There is no `Refund`, `CancellationRecord`, or `RefundRequest` model in the Prisma schema. No `REFUND_REQUESTED`, `REFUNDING`, or `REFUNDED` enum values exist. Refund tracking is scattered:
- `Booking.stripeRefundId String?` — set by `approveCancellation()` only
- `Booking.cancellationStatus String?` — null / PENDING / APPROVED / REJECTED
- `LedgerEntry(type: REFUND_ISSUED | REFUND_SYNCED)` — written only by `handleChargeRefunded()`
- `Transaction(type: REFUND)` — written only by Site E

**The absence of a unified refund record is the structural root cause of MM-07.**

### MM-07: handleChargeRefunded() double-ledger-write (confirmed)

`handleChargeRefunded()` guards against double-credit by checking existing `LedgerEntry` records:

```typescript
const existingRefunds = await tx.ledgerEntry.findMany({
  where: { referenceId: bookingId, type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED'] } },
})
const alreadyRecordedRefund = existingRefunds.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0)
refundDelta = Math.max(0, refundedAmount - alreadyRecordedRefund)
```

**The gap:** Sites C and D do **not** write `LedgerEntry(REFUND_ISSUED)` records when they issue refunds. Only `handleChargeRefunded()` writes `REFUND_SYNCED`. So:

1. Site C (admin approveCancellation) issues a Stripe refund → writes `Booking.stripeRefundId`, `WalletTransaction(DEBIT)`, but **no LedgerEntry**
2. Stripe fires `charge.refunded`
3. `handleChargeRefunded()` finds `alreadyRecordedRefund = 0` → writes `REFUND_SYNCED` for the full amount
4. The platform ledger's `totalRefunded` counter increments for a refund that was already application-initiated

**Result:** A systematic over-count of refunds in the platform ledger. Financial reconciliation will show more refunds than were actually unexpected (every admin-approved cancellation gets double-counted). **Confirmed ledger consistency bug.**

No wallet double-credit occurs — `handleChargeRefunded()` does not touch wallets.

---

## Secondary Classifications

### MM-15 — Late `transfer.failed` and Ledger Consistency

**Investigation status:** Needs one additional read of `handleTransferFailed()`. Based on the transfer success path, `appendLedgerEntry(PAYOUT_PAID)` and `incrementLedger()` are called only after `transfer.id` is confirmed. If Stripe later fires `transfer.failed` for a transfer that already received `PAID` status + ledger entries, `handleTransferFailed()` must reverse those entries or flag the payout.

**Preliminary classification:** MEDIUM — potential ledger/Stripe state mismatch. Needs `handleTransferFailed()` read before confirming.

### MM-06 — Webhook Auto-Refund (Site A, 3DS/prepaid)

**Confirmed classification:** The missing idempotency key and missing `recordWebhookEvent()` call mean Stripe retries will re-execute this path. Stripe's own idempotency (same PI, already refunded) prevents double-charge. Application risk is inconsistent state tracking. **Theoretical risk, not confirmed financial exploit.**

### MM-12 — Admin Wallet Credit Idempotency

**Confirmed classification:** No idempotency protection. A double-submit creates two wallet credit records and inflates the balance. No Stripe involvement, so no financial impact to the platform — but a customer's balance can be artificially inflated. **Medium — confirmed duplicate vulnerability, no external exploit required (admin UI re-submission is sufficient).**

---

## Required Invariants Before Implementation

### MM-10 (SaaS Payment)

1. **Routing invariant:** `createCheckoutSession()` MUST include `transfer_data: { destination: provider.stripeAccountId }` when provider has a verified Connect account. Until this is implemented, SaaS businesses do not receive direct payment.

2. **Ownership invariant:** Before using `provider.stripeAccountId` as `transfer_data.destination`, MUST call `verifyPayoutDestinationOwnership(stripe, stripeAccountId, quote.providerId)` — same function used in PAY-01 fix.

3. **Eligibility gate:** `provider.stripeAccountId !== null && provider.chargesEnabled === true` must be checked before session creation.

4. **Fee invariant:** `applicationFeeAmount` must be derived from `BusinessSettings.commissionRate`, not from the non-existent `businessConfig.commissionPercent`.

5. **Session idempotency invariant:** `Quote.stripeSessionId` write must be conditional: `WHERE stripeSessionId IS NULL`. If 0 rows updated, return the existing session.

6. **Webhook invariant:** `handleCheckoutComplete()` must check `session.payment_status === 'paid'` before updating Quote/Booking state.

### MM-05 (Refund Idempotency)

1. **Idempotency key invariant:** Every `stripe.refunds.create()` call MUST include an `idempotencyKey` that is stable and deterministic per refund operation:
   - Site A: `prepaid-refund-${checkoutSession.id}`
   - Site C: `approve-cancel-${bookingId}`
   - Site D: `cancel-refund-${bookingId}`
   - Site E: `admin-refund-${transactionId}`

2. **Atomic gate invariant:** For Sites C and E, the "has this already been refunded?" check must be atomic with the state update that prevents re-entry. The current TOCTOU pattern (read `status`, then call Stripe, then write `status`) must become: write `status = REFUNDING` atomically before calling Stripe, or use a `updateMany` CAS like Site D.

3. **Ledger invariant:** When a Stripe refund is issued by the application (Sites C, D, E), a `LedgerEntry(REFUND_ISSUED)` MUST be written in the same transaction as the booking status update. This enables `handleChargeRefunded()` to correctly detect already-processed refunds.

4. **Webhook idempotency invariant for expired bookings (Site B):** The `ExpiredBookingError` throw inside the `$transaction` callback causes the WebhookEvent record to be rolled back. The outer catch block must write the WebhookEvent **outside** the transaction (or in a separate non-failing transaction) after the refund call succeeds, so that Stripe retries don't keep re-executing the path.

---

## Confirmed vs Theoretical Findings

| Finding | Status | Severity | Requires DB compromise? | Exploit complexity |
|---|---|---|---|---|
| MM-10: Funds never reach provider | Confirmed — architectural | Critical design gap | No | N/A — this is a bug, not an attack vector |
| MM-10: Race condition in session creation | Confirmed exploit | Medium | No | Two concurrent HTTP requests |
| MM-10: Fee always zero | Confirmed logic bug | Medium | No | N/A — dead code |
| MM-05 Site C: TOCTOU in approveCancellation | Confirmed theoretical | Medium | No | Concurrent admin submissions |
| MM-05 Site D: Missing Stripe idempotency key | Confirmed gap | Medium | No | Network partition after DB commit |
| MM-05 Site E: Unprotected admin refund | Confirmed | Medium | No | Concurrent admin submissions |
| MM-05 Site A: Missing idempotency key + no WebhookEvent | Confirmed gap | Low | No | Stripe retry after failure |
| MM-05 Site B: WebhookEvent rollback | Confirmed behavioural gap | Low | No | Stripe retry behaviour |
| MM-07: Double ledger write on admin-initiated refunds | Confirmed | Medium | No | Every admin-approved cancellation |
| MM-12: Admin wallet credit no idempotency | Confirmed | Medium | No | Admin UI double-submit |

---

## Existing Test Coverage

| Path | Covered | Missing |
|---|---|---|
| `createCheckoutSession()` | ❌ No tests | Session creation, metadata binding, race condition, fee calculation |
| `handleCheckoutComplete()` | ❌ No tests | Webhook completion, double-booking guard, payment_status check |
| `approveCancellation()` | ❌ No tests | TOCTOU, concurrent approval, Stripe failure after DB commit |
| Public cancel route | ❌ No tests | CAS guard, Stripe failure scenario |
| `handleChargeRefunded()` | ❌ No tests | Double ledger entry scenario, existing refund detection |
| Site B expired-booking refund | ⚠️ Key format test only | Actual deduplication, WebhookEvent rollback behaviour |
| Site E admin transaction refund | ❌ No tests | Concurrent refund, idempotency |

---

## Recommended Implementation Order

### P0 (implement before next release)

1. **MM-05 Site C — Add idempotency key and atomic gate to `approveCancellation()`**  
   Lowest complexity, highest confirmed exploit probability (concurrent admin actions are realistic). Add `idempotencyKey: \`approve-cancel-${bookingId}\`` and make the `cancellationStatus` check+update atomic with a conditional `updateMany`.

2. **MM-05 Site D — Add idempotency key to public cancel route**  
   Already has the strongest DB guard. Adding the idempotency key is a one-line fix that enables safe retry on Stripe API failure.

3. **MM-05 Site E — Add idempotency key and atomic gate to admin transaction refund**  
   Fully unprotected. Add `idempotencyKey: \`admin-refund-${transactionId}\`` and move the status check inside a conditional update.

4. **MM-07 — Write `LedgerEntry(REFUND_ISSUED)` from Sites C, D, E**  
   This is the prerequisite for `handleChargeRefunded()` to correctly detect already-processed refunds.

### P1 (next sprint)

5. **MM-10 — Complete SaaS Connect destination routing**  
   Add `transfer_data.destination`, provider eligibility gate, ownership verification (reuse `verifyPayoutDestinationOwnership()`), fix `applicationFeeAmount` to use `BusinessSettings.commissionRate`, and make session idempotency conditional on `stripeSessionId === null`.

6. **MM-05 Site A — Add idempotency key + `recordWebhookEvent()` to 3DS/prepaid refund path**

7. **MM-05 Site B — Fix WebhookEvent rollback in expired-booking path**  
   Write the WebhookEvent outside the `$transaction` after the refund succeeds.

### P2 (follow-up)

8. **MM-12 — Admin wallet credit idempotency**  
   Add a request idempotency key (from request header or generated token) to prevent double-submit.

9. **MM-15 — Verify `handleTransferFailed()` reverses ledger entries**  
   Read the function; if it doesn't reverse the `PAYOUT_PAID` ledger entry, add that logic.

10. **MM-02/MM-17 — Delete `StripeService.createPayout()`**  
    Zero callers. Remove before it acquires one.
