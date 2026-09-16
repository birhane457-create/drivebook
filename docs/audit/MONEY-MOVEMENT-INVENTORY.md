# DriveBook — Money-Movement Inventory

**Date:** 2026-09-11  
**Purpose:** Exhaustive inventory of every code path capable of moving or representing money. Produced by global grep of all Stripe API calls, wallet writes, ledger writes, and financial state transitions. No fixes included. Each path is assessed against the control matrix and assigned a finding severity.

**Scope:** `lib/services/`, `app/api/`, `app/api/cron/`, `lib/cron/`, webhook handler, admin routes  
**Out of scope:** Read-only retrieves, dashboard display, reporting aggregates

---

## How to Read This Document

Each entry covers:
- **Trigger** — what initiates the money movement
- **Code location** — primary file(s)
- **Stripe call(s) / DB writes**
- **Control matrix** — Authorization / Ownership / Amount / State / Idempotency / Concurrency / Ledger / Audit
- **Finding** — gap or concern
- **Severity** — CRITICAL / HIGH / MEDIUM / LOW / NONE

---

## MM-01 — Provider Payout (Stripe Connect Transfer)

**Trigger:** Admin calls `POST /api/admin/payouts/[id]/execute` → `executePayout()`  
**File:** `lib/services/payout-service.ts` lines 320–600  
**Stripe call:** `stripe.transfers.create()` with `idempotencyKey`

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Admin session required; `adminUserId` logged |
| Ownership | ✅ FIXED (PAY-01) | `verifyPayoutDestinationOwnership()` checks `metadata.providerId` before transfer |
| Amount | ✅ | `netAmount` set at `buildPayout()` time, immutable by `executePayout()` |
| Currency | ✅ | Hardcoded `'aud'` |
| State | ✅ | Atomic lock: `updateMany WHERE status IN (ELIGIBLE, FAILED)` → PROCESSING |
| Idempotency | ✅ | `payout.idempotencyKey` passed to Stripe; key not consumed on ownership failure |
| Concurrency | ✅ | Lock prevents concurrent execution; second caller gets PROCESSING immediately |
| Ledger | ✅ | `appendLedgerEntry` only called after `transfer.id` confirmed; zero entries on failure |
| Audit | ✅ | `PAYOUT_PROCESSING` → `PAYOUT_PAID`/`PAYOUT_FAILED` in auditLog; `sendAlert` on failure |
| Secrets | ✅ | Alert metadata contains `payoutRef`, `providerId`, `failureReason` only |

**Finding:** NONE — PAY-01-C/D closed.  
**Severity:** NONE (controlled)

---

## MM-02 — Unguarded Transfer Path in StripeService

**Trigger:** Call to `stripeService.createPayout(accountId, amount, description)`  
**File:** `lib/services/stripe.ts` lines 178–200  
**Stripe call:** `stripe.transfers.create({ destination: accountId, ... })`

```typescript
async createPayout(accountId: string, amount: number | Decimal, description: string) {
  const transfer = await stripe.transfers.create({
    amount: amountInCents,
    currency: 'aud',
    destination: accountId,   // ← no ownership check, no idempotency key
    description,
  });
}
```

| Control | Status | Notes |
|---|---|---|
| Authorization | ❌ | Depends entirely on caller — not enforced inside the method |
| Ownership | ❌ | No `verifyPayoutDestinationOwnership()` call — `accountId` is caller-supplied |
| Amount | ❌ | Caller supplies raw amount — no bounds or audit |
| State | ❌ | No payout state machine; no lock |
| Idempotency | ❌ | No idempotency key |
| Concurrency | ❌ | No lock |
| Ledger | ❌ | No ledger entry written |
| Audit | ❌ | No audit log, no alert |

**Current caller count:** `grep stripeService.createPayout` → **0 callers**.  
This method is dead code as of this audit. However its existence creates a persistent risk: any future caller (including a developer adding an admin shortcut) would bypass all controls on MM-01.

**Finding:** Unguarded transfer method with no callers. Risk is latent but real — the method should be removed or internally enforce the same ownership check as `executePayout()`.  
**Severity:** MEDIUM (latent — zero callers today; HIGH if called by any future admin route without review)  
**Recommended action:** Delete or route through `executePayout()`. Do not add ownership check here — that would create two separately maintained security paths.

---

## MM-03 — Customer Payment Intent (Booking / Wallet Top-Up)

**Trigger:** `POST /api/payments/create-intent` → `stripeService.createPaymentIntent()`  
**File:** `lib/services/stripe.ts` lines 55–130, `app/api/payments/create-intent/route.ts`  
**Stripe call:** `stripe.paymentIntents.create()`

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Authenticated session required |
| Ownership | ✅ | `userId` stamped in metadata; wallet-add verifies `paymentIntent.metadata.userId === session.user.id` |
| Amount | ⚠️ | Amount comes from booking price (DB-sourced); but route accepts client `amount` param for wallet top-ups — validated against `walletTopUpMin`/`walletTopUpMax` platform settings |
| State | ✅ | Idempotency check: if `booking.paymentIntentId` already set, existing PI returned |
| Idempotency | ✅ | `paymentIntentId` stored on booking; duplicate create prevented inside transaction |
| Concurrency | ✅ | F-05 fix: DB `$transaction` prevents concurrent PI creation for same booking |
| Ledger | ✅ | Wallet `PENDING` transaction written at create-time; confirmed on webhook |
| Audit | ⚠️ | No explicit `auditLog` entry at create time; rely on Stripe dashboard |

**Finding:** Amount validation for wallet top-up relies on `platformSettings.walletTopUpMin/Max`. If admin sets these to extreme values, a customer could create a very large payment intent. Not a direct vulnerability but worth noting.  
**Severity:** LOW

---

## MM-04 — Wallet Top-Up Completion (Webhook-Confirmed)

**Trigger:** Stripe `payment_intent.succeeded` or `checkout.session.completed` → `handleBookingPaymentSuccess()` / wallet confirm path  
**File:** `app/api/stripe/webhook/route.ts`  
**DB write:** `walletTransaction.create(CREDIT)` inside `prisma.$transaction`

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Webhook signature verified via `stripe.webhooks.constructEvent()` |
| Ownership | ✅ | `paymentIntent.metadata.userId` matched to wallet owner inside transaction |
| Amount | ✅ | Amount taken from `paymentIntent.amount` (Stripe-authoritative), not from client request |
| State | ✅ | `WebhookEvent` idempotency key checked before processing |
| Idempotency | ✅ | `idempotencyKey` stored in `WebhookEvent` table; duplicate events skipped |
| Concurrency | ✅ | Inside `prisma.$transaction` |
| Ledger | ✅ | `walletTransaction.create(CREDIT)` inside same transaction as booking/wallet state update |
| Audit | ✅ | Webhook event recorded; `PAYOUT_PROCESSING` → `PAYMENT_COLLECTED` ledger entry |

**Finding:** NONE  
**Severity:** NONE

---

## MM-05 — Stripe Refund (Booking Cancellation)

**Trigger:** `POST /api/public/bookings/[id]/cancel` or admin cancel → `stripe.refunds.create()`  
**Files:** `app/api/public/bookings/[id]/cancel/route.ts`, `lib/services/booking-service.ts` (~line 659), `app/api/stripe/webhook/route.ts` (lines 392, 1084)

| Control | Status | Notes |
|---|---|---|
| Authorization | ⚠️ | Public cancel route is authenticated but requires booking ownership check — must verify `booking.customerId === session.user.id` |
| Ownership | ⚠️ | `paymentIntentId` comes from the booking record — if booking ownership not verified before refund, a different user could trigger a refund on someone else's booking |
| Amount | ⚠️ | `refundAmount` calculated from cancellation policy; uses `Math.round(refundAmount * 100)` — decimal rounding is safe, but partial refund logic should be audited |
| State | ⚠️ | Booking must be in cancellable state — needs verification that status gate is enforced before `stripe.refunds.create()` |
| Idempotency | ❌ | No idempotency key on `stripe.refunds.create()` calls; duplicate cancellation requests could trigger duplicate Stripe refund attempts |
| Concurrency | ⚠️ | No explicit lock before refund call — concurrent cancellation requests for same booking could race |
| Ledger | ⚠️ | Wallet credit on refund path — need to verify it's inside `$transaction` with booking status update |
| Audit | ✅ | Refund recorded via webhook `charge.refunded` event |

**Finding:** Missing idempotency key on refund creation. Missing explicit concurrency lock before refund. Public cancel route ownership verification needs confirmation.  
**Severity:** HIGH — Duplicate refunds are a direct financial loss. Ownership gap could allow refund of another customer's booking.

---

## MM-06 — Duplicate-Charge Refund (Webhook Auto-Refund)

**Trigger:** `handleBookingPaymentFailed` in webhook detects duplicate payment → `stripe.refunds.create()` with `reason: 'duplicate'`  
**File:** `app/api/stripe/webhook/route.ts` lines 1084–1090

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Webhook signature verified |
| Ownership | ✅ | Triggered by Stripe event, refunding to original payment intent |
| Amount | ✅ | Full payment intent amount refunded |
| Idempotency | ❌ | No idempotency key |
| Concurrency | ⚠️ | If webhook fires twice for same event, could attempt two refunds |
| Audit | ✅ | Webhook event recorded |

**Finding:** No idempotency key on auto-refund. Stripe's duplicate event protection partially mitigates this but does not replace an application-level idempotency key.  
**Severity:** MEDIUM

---

## MM-07 — Out-of-Band Refund Sync (`charge.refunded` webhook)

**Trigger:** Stripe `charge.refunded` event → `handleChargeRefunded()`  
**File:** `app/api/stripe/webhook/route.ts` line 262  
**DB write:** Updates booking/wallet to reflect refund issued outside the application (Stripe Dashboard)

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Webhook signature verified |
| Idempotency | ✅ | `idempotencyKey` checked |
| Ledger | ⚠️ | Need to verify wallet credit for out-of-band refund doesn't double-credit if application also issued the refund |

**Finding:** Potential double-credit if both application-initiated refund (MM-05) and `charge.refunded` webhook both write wallet credits. Depends on whether the webhook handler checks if an application refund already occurred.  
**Severity:** MEDIUM — requires reading `handleChargeRefunded()` implementation to confirm or clear.

---

## MM-08 — Subscription Checkout Session

**Trigger:** `POST /api/subscriptions/checkout` or `/api/instructor/subscription`  
**Files:** `app/api/subscriptions/checkout/route.ts`, `app/api/instructor/subscription/route.ts`, `app/api/instructor/subscription/billing-portal/route.ts`  
**Stripe call:** `stripe.checkout.sessions.create()` in `setup` or `subscription` mode

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Authenticated session required; `session.user.id` checked |
| Ownership | ✅ | `customerId` linked to authenticated provider |
| Amount | ✅ | Price ID from `SUBSCRIPTION_PLANS` constant — not caller-supplied |
| Idempotency | ✅ | Checkout sessions are single-use; webhook handles completion |
| Audit | ✅ | `invoice.payment_succeeded` webhook records the payment |

**Finding:** NONE  
**Severity:** NONE

---

## MM-09 — Subscription Cancellation

**Trigger:** `subscription-cancel.ts` called from admin or instructor routes  
**File:** `lib/services/subscription-cancel.ts` lines 118–130  
**Stripe call:** `stripe.subscriptions.update(cancel_at_period_end: true)` or `stripe.subscriptions.cancel()`

| Control | Status | Notes |
|---|---|---|
| Authorization | ⚠️ | Depends on caller — `subscription-cancel.ts` itself does not enforce auth |
| Ownership | ⚠️ | `stripeSubId` passed by caller — need to verify caller validates subscription belongs to the provider being cancelled |
| State | ✅ | Stripe subscription must be active |
| Audit | ⚠️ | Admin cancellation logs `cancelledByAdmin`/`cancelReason` in Stripe metadata; application-side audit log needs verification |

**Finding:** Cancellation service takes `stripeSubId` as input without internal ownership binding. Authorization and ownership correctness is entirely in the caller. Admin route at `/api/admin/instructors/[id]/subscription` passes subscription ID from DB lookup, which is correct, but there is no guard inside the service itself.  
**Severity:** LOW (caller pattern is correct today; medium risk if new caller added without care)

---

## MM-10 — SaaS Booking Payment (Direct-to-Provider via Connect)

**Trigger:** `POST /api/client/quotes/[id]/accept` → `createCheckoutSession()` in `saas-payment.ts`  
**File:** `lib/services/saas-payment.ts`  
**Stripe call:** `stripe.checkout.sessions.create()` with `payment_intent_data.application_fee_amount`

```typescript
sessionParams.payment_intent_data = {
  application_fee_amount: applicationFeeAmount,
}
```

Money flows **directly to the provider's Stripe account** with platform taking `application_fee_amount`.

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Authenticated customer session |
| Ownership | ⚠️ | Provider account ID comes from `business.stripeAccountId` (DB-sourced). No ownership verification against Stripe-side metadata equivalent to PAY-01 fix. |
| Amount | ⚠️ | `applicationFeeAmount` calculated as `commission * totalAmount` — commission rate from `businessConfig.commission`. Need to verify this cannot be manipulated. |
| Idempotency | ✅ | `quote.stripeSessionId` checked — existing open session reused |
| Ledger | ✅ | Quote/booking state updated in webhook on completion |
| Audit | ✅ | Webhook `checkout.session.completed` → `handleCheckoutComplete()` |

**Finding:** The SaaS payment path sends money directly to a provider's Stripe account (`business.stripeAccountId`) without the same Stripe metadata ownership verification introduced in PAY-01. If `business.stripeAccountId` is tampered with in the database, money moves to the wrong account without detection.  
This is a **parallel vulnerability to PAY-01** on a different payment path.  
**Severity:** HIGH

---

## MM-11 — Stripe Connect Account Creation

**Trigger:** `POST /api/instructor/stripe-connect/onboard`  
**File:** `app/api/instructor/stripe-connect/onboard/route.ts` lines 48–68  
**Stripe call:** `stripe.accounts.create()` with `metadata.providerId`

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Authenticated instructor session |
| Ownership | ✅ | `metadata.providerId` bound to authenticated `instructor.id` at creation |
| Idempotency | ✅ | Only creates if `instructor.stripeAccountId` is null |
| Audit | ✅ | Stored to `Provider.stripeAccountId` immediately |

**Finding:** NONE  
**Severity:** NONE

---

## MM-12 — Admin Direct Wallet Credit/Debit

**Trigger:** Admin routes `POST /api/admin/clients/[id]/wallet/add-credit` and `deduct-credit`  
**Files:** `app/api/admin/clients/[id]/wallet/add-credit/route.ts`, `deduct-credit/route.ts`  
**DB write:** `walletTransaction.create(CREDIT/DEBIT)` directly without Stripe involvement

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Admin role check required |
| Ownership | ✅ | Client ID from URL param, wallet looked up by client ID |
| Amount | ⚠️ | Amount comes from request body — validated by Zod schema, but upper bound needs verification |
| Idempotency | ❌ | No idempotency key or duplicate-detection — admin could submit the same credit twice |
| Audit | ✅ | `adminNote` stored on transaction; `actorId` recorded |

**Finding:** No idempotency protection on admin wallet credit. Double-submit of the form (or network retry) creates a duplicate credit. No financial impact to Stripe but wallet balance inflated.  
**Severity:** MEDIUM

---

## MM-13 — Wallet-Funded Booking

**Trigger:** Customer books a lesson → wallet debit inside `$transaction`  
**Files:** `app/api/bookings/route.ts`, `lib/services/booking-service.ts`, `app/api/client/bookings/create-bulk/route.ts`  
**DB write:** `walletTransaction.create(DEBIT)` inside `prisma.$transaction`

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Authenticated customer session |
| Ownership | ✅ | Wallet looked up by `session.user.id` inside transaction |
| Amount | ✅ | Price from booking record, not client-supplied |
| State | ✅ | Balance check inside transaction |
| Idempotency | ✅ | Booking creation is atomic; duplicate booking prevented by DB constraints |
| Concurrency | ✅ | Balance check and debit inside `$transaction` |
| Ledger | ✅ | `walletTransaction` is the ledger |

**Finding:** NONE  
**Severity:** NONE

---

## MM-14 — Dispute Handling

**Trigger:** Stripe `charge.dispute.created/updated/closed` → `handleDisputeOpened/Updated/Closed()`  
**File:** `app/api/stripe/webhook/route.ts`  
**DB write:** Payout holds, `StripeDispute` record updates; no direct money movement

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Webhook signature verified |
| Idempotency | ✅ | `idempotencyKey` checked |
| Ledger | ⚠️ | Dispute resolution may trigger wallet credit on close — need to verify no double-credit with MM-07 |

**Finding:** Dispute close path may overlap with out-of-band refund sync (MM-07) — double-credit risk needs explicit confirmation via code read.  
**Severity:** MEDIUM (needs verification)

---

## MM-15 — Transfer Failure Recovery

**Trigger:** Stripe `transfer.failed` → `handleTransferFailed()`  
**File:** `app/api/stripe/webhook/route.ts` line 267  
**DB write:** Marks payout FAILED, logs audit event

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Webhook signature verified |
| Idempotency | ✅ | `idempotencyKey` checked |
| State | ✅ | Sets payout to FAILED enabling retry |
| Ledger | ⚠️ | If ledger entries were already written on the successful transfer path, a failed transfer may leave ledger credits that don't correspond to actual money movement |

**Finding:** If `transfer.failed` fires after `PAYOUT_PAID` ledger entries were written (i.e. Stripe accepted the transfer then later failed it), the ledger would show a payout that didn't actually complete. This is an edge case but needs explicit handling.  
**Severity:** MEDIUM

---

## MM-16 — Reconciliation Cron (Read + Alert Only)

**Trigger:** `GET /api/cron/reconcile-stripe`  
**File:** `app/api/cron/reconcile-stripe/route.ts`  
**Stripe calls:** `stripe.paymentIntents.list()`, `stripe.transfers.retrieve()` (read-only)

| Control | Status | Notes |
|---|---|---|
| Authorization | ✅ | Cron secret checked |
| Money movement | ✅ | Read-only — no Stripe writes |

**Finding:** NONE  
**Severity:** NONE

---

## MM-17 — Dead Code: `StripeService.createPayout()`

**File:** `lib/services/stripe.ts` lines 178–200  
**Caller count:** **0** (confirmed by grep)

An unguarded `stripe.transfers.create()` method with no ownership check, no idempotency key, no state machine, no ledger write, no audit log.

**Finding:** Dead code today but a latent risk. Any future caller of this method bypasses all controls established for MM-01 (PAY-01). Should be deleted before it acquires a caller.  
**Severity:** MEDIUM (latent)  
**Action:** Delete the method. If a shortcut admin transfer is ever needed, it must route through `executePayout()`.

---

## Summary Table

| ID | Path | Severity | Status |
|---|---|---|---|
| MM-01 | Provider payout (Stripe Connect transfer) | NONE | ✅ Controlled (PAY-01-D) |
| MM-02 | `StripeService.createPayout()` — unguarded, dead code | MEDIUM | ⚠️ Open — delete |
| MM-03 | Customer payment intent (booking/top-up) | LOW | ⚠️ Minor: wallet top-up amount bounds |
| MM-04 | Wallet top-up webhook confirmation | NONE | ✅ Controlled |
| MM-05 | Booking cancellation refund | HIGH | ❌ Open — missing idempotency key, concurrency gap |
| MM-06 | Duplicate-charge auto-refund (webhook) | MEDIUM | ⚠️ Open — missing idempotency key |
| MM-07 | Out-of-band refund sync (`charge.refunded`) | MEDIUM | ⚠️ Needs read — possible double-credit with MM-05 |
| MM-08 | Subscription checkout | NONE | ✅ Controlled |
| MM-09 | Subscription cancellation | LOW | ⚠️ No internal ownership guard in service |
| MM-10 | SaaS booking payment (direct-to-provider) | HIGH | ❌ Open — parallel PAY-01 on different path |
| MM-11 | Stripe Connect account creation | NONE | ✅ Controlled |
| MM-12 | Admin wallet credit/debit | MEDIUM | ⚠️ Open — no idempotency |
| MM-13 | Wallet-funded booking | NONE | ✅ Controlled |
| MM-14 | Dispute handling | MEDIUM | ⚠️ Needs verification — possible overlap with MM-07 |
| MM-15 | Transfer failure recovery | MEDIUM | ⚠️ Ledger consistency on late failure |
| MM-16 | Reconciliation cron | NONE | ✅ Read-only |
| MM-17 | Dead code: `StripeService.createPayout()` | MEDIUM | ⚠️ Open — delete |

---

## Priority Order for Next Fixes

**1. MM-10 (HIGH)** — SaaS direct-to-provider payment path has no Stripe metadata ownership check. Same class as PAY-01. Apply `verifyPayoutDestinationOwnership()` or equivalent before `checkout.sessions.create()` using `business.stripeAccountId`.

**2. MM-05 (HIGH)** — Booking cancellation refund is missing idempotency key and has a potential concurrency gap. Duplicate refund = direct financial loss.

**3. MM-02 / MM-17 (MEDIUM)** — Delete `StripeService.createPayout()`. Zero callers now; leaving it creates maintenance risk.

**4. MM-06 (MEDIUM)** — Add idempotency key to webhook auto-refund.

**5. MM-07 / MM-14 (MEDIUM)** — Read `handleChargeRefunded()` and `handleDisputeClosed()` to confirm or clear double-credit concern.

**6. MM-12 (MEDIUM)** — Add idempotency protection to admin wallet credit (session token or request ID).

**7. MM-15 (MEDIUM)** — Verify `handleTransferFailed()` reverses ledger if payout already marked PAID.

---

## Operational Finding (from PAY-01-D)

**OPS-01:** `sendAlert()` in `executePayout()` catch block is `void` (fire-and-forget). If the alert service is unavailable, the payout correctly enters `FAILED` state but the operational team may not receive the notification. The payout state machine is correct and independent of alert delivery — this is an operational resilience concern, not a financial invariant failure. Monitoring/runbooks should account for alert-service unavailability. Do not make alerts synchronous without evidence the business requires it.
