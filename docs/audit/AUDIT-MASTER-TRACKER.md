# DriveBook Security Audit — Master Tracker

**Last Updated:** 2026-09-16  
**Maintained by:** Security audit sessions (Kiro + independent review)

This is the single source of truth for audit status. Cross-references the Phase 1 Remediation Register (`PHASE1_REMEDIATION_REGISTER.md`), the Security Findings Tracker (`SECURITY_FINDINGS_TRACKER.md`), and the new money-movement audit work done in this session.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ CLOSED | Fix implemented, tested (passing), verified |
| 🔨 FIXED — TEST PENDING | Production code changed, tests not yet written/run |
| 🔍 IN PROGRESS | Currently being worked |
| ⚠️ OPEN | Known, not yet started |
| ❌ REJECTED | False positive or verified safe |
| ⏸ DEFERRED | Awaiting architecture/prerequisite |

---

## PHASE 1 — Original 56-Finding Register

### P0 — Critical

| ID | Finding | Status | Evidence |
|---|---|---|---|
| P0-01A | Wallet PaymentIntent ownership (cross-user theft) | ✅ CLOSED | `wallet-add/route.ts` ownership check; tests 12/12 exit 0 |
| P0-01B | Concurrent wallet credit race condition | ✅ CLOSED | DB unique partial index on `stripePaymentIntentId`; P2002 → 409; concurrent test |

### P1 — High Priority

| ID | Finding | Status | Evidence |
|---|---|---|---|
| SUB-22 | Subscription duplicate rows (missing unique constraints) | ✅ CLOSED | `@@unique([providerId])`, `@@unique([stripeSubscriptionId])` applied; verified |
| SUB-04-A | Unpaid subscription activation (`subscription.created` → ACTIVE before payment) | ✅ CLOSED | Activation only on `invoice.payment_succeeded` |
| SUB-09-A | Instructor cancellation missing Stripe call | ✅ CLOSED | `subscription-cancel.ts` service; Stripe-first |
| SUB-10-A | Inconsistent cancellation implementations (3 paths) | ✅ CLOSED | Unified `subscription-cancel.ts`; all paths delegate |
| SUB-12-A | Trial expiry cron race with paid conversion | ✅ CLOSED | `updateMany` with `status: 'TRIAL'` guard; `count === 0` check |
| SUB-02-A | Subscription creation not atomic | ✅ CLOSED | `prisma.$transaction()` wraps subscription + provider update |
| SUB-02-B | Concurrent trial creation race | ✅ CLOSED | Race check inside SERIALIZABLE transaction |
| C-1 | Provider self-upgrade tier without payment | ✅ CLOSED | 403 guard at line 199–209 of subscription route |
| PAY-H-01 / INT-M-01A | Stripe refund outside transaction — reconciliation needed | ⚠️ OPEN | No reconciliation cron exists. F-09 left refund call outside tx by design. |
| PAY-H-02 | Booking reschedule price not recalculated | ⚠️ OPEN | `reschedule/route.ts` does not compare old/new price |
| INT-M-03A | OAuth tokens stored plaintext in DB | ⚠️ OPEN | `googleAccessToken`, `googleRefreshToken` unencrypted |
| INT-M-03F | OAuth token not revoked on calendar disconnect | ⚠️ OPEN | No revocation call in disconnect flow |

### P2 — Medium Priority

| ID | Finding | Status | Evidence |
|---|---|---|---|
| PAY-H-04 | SlotReservation concurrency (no unique constraint) | ⚠️ OPEN | No `@@unique` on `(providerId, startTime)` |
| SUB-06-A | No tests for subscription event ordering | ⚠️ OPEN | Zero tests for `updated` → `deleted` ordering |
| SUB-08-A | Seat limit not enforced in webhook | ⚠️ OPEN | No seat count check before subscription.create |
| RBAC-M-02 | Admin routes use role check instead of permission check | ⚠️ OPEN | `role === 'SUPER_ADMIN'` instead of `requirePermission()` |
| DATA-EXP-01 | Public instructor phone exposed in API | ⚠️ OPEN | `phone` in public projection |
| DOC-EXP-01 | Expired provider can still receive bookings | ⚠️ OPEN | No document expiry gate in booking creation |
| AUDIT-01 | Audit logging fails open (swallows errors) | ⚠️ OPEN | `catch` block uses `console.error` only |
| AUDIT-02 | Audit log write not in same transaction as state change | ⚠️ OPEN | Separate writes, not atomic |
| AUDIT-05 | Audit coverage gaps (wallet, booking mutations not logged) | ⚠️ OPEN | No audit trail for wallet operations |
| INT-M-01B | Stripe payment reconciliation (missed webhooks) | ⚠️ OPEN | No payment reconciliation in cron |

### P3 — Low Priority

| ID | Finding | Status |
|---|---|---|
| PAY-H-06 | Package expiry refund policy not documented | ⚠️ OPEN |
| AUDIT-03 | AuditLog deletable (no DB trigger) | ⚠️ OPEN |
| AUDIT-04 | No audit log retention policy | ⚠️ OPEN |
| APP-H-04 to APP-H-08 | Documentation gaps | ⚠️ OPEN |

### Deferred

| ID | Finding | Status |
|---|---|---|
| AI-M-01 | AI prompt injection | ⏸ DEFERRED — awaiting architecture redesign |
| AI-M-02 | AI tool authorization completeness | ⏸ DEFERRED — awaiting architecture redesign |

### Verified Safe (no fix needed)

PAY-H-03, PAY-H-05, SUB-12-A (already was correct), AUTH-M-01, AUTH-M-02, RBAC-M-01, APP-H-01, APP-H-02, APP-H-03, DATA-M-01, DATA-M-02, DATA-M-03, INT-M-01C, INT-M-01D, INT-M-02, INT-M-03B, INT-M-03C, INT-M-03D, INT-M-03E, F-08 (ADMIN-05 refund limit)

---

## PHASE 2 — PAY-01 Payout Destination Ownership

This was identified during Phase 1 gap analysis and fully addressed this session.

| Sub-task | Finding | Status | Evidence |
|---|---|---|---|
| PAY-01-A | Write-path audit: no API vulnerability, DB write is attack vector | ✅ CLOSED | Code audit; no API path writes stripeAccountId without auth |
| PAY-01-B | Stripe metadata binding established | ✅ CLOSED | `PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| PAY-01-C | Reproduction + regression tests | ✅ CLOSED | `payout-security.test.ts` (7/7) + `pay-01-executePayout-security.test.ts` (5/5); exit 0 |
| PAY-01-D | Post-verification state, retry, idempotency, ledger, alert, concurrency | ✅ CLOSED | `pay-01-d-state-consistency.test.ts` (16/16); exit 0 |

**Total PAY-01 tests:** 28/28 passing, Vitest exit code 0.

**Fix location:** `lib/services/payout-service.ts` — `verifyPayoutDestinationOwnership()` called before `stripe.transfers.create()` with TOCTOU protection (verified account ID used as `const verifiedAccountId`).

**Operational note (OPS-01):** `sendAlert()` in catch block is `void` (fire-and-forget). Payout correctly reaches FAILED state independently of alert delivery. Monitoring runbooks should account for alert-service unavailability. Not a financial invariant issue.

---

## PHASE 2 — Money-Movement Inventory (new this session)

17 paths identified. Full detail: `docs/MONEY-MOVEMENT-INVENTORY.md`

| ID | Path | Severity | Status |
|---|---|---|---|
| MM-01 | Provider payout (Stripe Connect transfer) | NONE | ✅ CONTROLLED — PAY-01-D closed |
| MM-02 | `StripeService.createPayout()` — unguarded dead code | MEDIUM | ⚠️ OPEN — delete |
| MM-03 | Customer payment intent (booking/top-up) | LOW | ⚠️ OPEN — minor wallet top-up amount bounds |
| MM-04 | Wallet top-up webhook confirmation | NONE | ✅ CONTROLLED |
| MM-05-A | Concurrent admin refund race — `approveCancellation()` | HIGH | ⚠️ OPEN — confirmed; no idempotency key, TOCTOU gate |
| MM-05-B | Lost-refund / no-retry gap — public cancel route | MEDIUM | ⚠️ OPEN — confirmed; atomic CAS exists, Stripe call outside tx |
| MM-05-C | Concurrent admin transaction refund | HIGH | ⚠️ OPEN — confirmed; fully unprotected, no gate, no key |
| MM-05-D | No app-level guard on 3DS/prepaid auto-refund (Site A) | LOW | ⚠️ OPEN — theoretical; Stripe dedup reduces real risk |
| MM-05-E | Webhook record rolls back on expired-booking refund (Site B) | LOW | ⚠️ OPEN — behavioural gap; idempotency key exists |
| MM-06 | Duplicate-charge auto-refund (webhook) — same class as MM-05-D | MEDIUM | ⚠️ OPEN — missing idempotency key; no WebhookEvent record |
| MM-07 | Refund ledger reconciliation defect (`charge.refunded` double-writes) | MEDIUM | ⚠️ OPEN — confirmed ledger accuracy bug; no wallet double-credit |
| MM-08 | Subscription checkout | NONE | ✅ CONTROLLED |
| MM-09 | Subscription cancellation | LOW | ⚠️ OPEN — no internal ownership guard in service |
| MM-10-A | SaaS provider routing absent — no `transfer_data.destination` | — | ⚠️ OPEN — architectural incompleteness, not a security exploit |
| MM-10-B | Concurrent SaaS checkout session creation — double-charge risk | MEDIUM | ⚠️ OPEN — confirmed; two concurrent accepts → two Stripe sessions |
| MM-10-C | `applicationFeeAmount` always zero — commission config defect | MEDIUM | ⚠️ OPEN — confirmed logic bug; `commissionPercent` not in `BusinessConfig` |
| MM-11 | Stripe Connect account creation | NONE | ✅ CONTROLLED |
| MM-12 | Admin wallet credit/debit | MEDIUM | ⚠️ OPEN — no idempotency |
| MM-13 | Wallet-funded booking | NONE | ✅ CONTROLLED |
| MM-14 | Dispute handling | MEDIUM | ⚠️ OPEN — overlap with MM-07 possible |
| MM-15 | Transfer failure recovery (`transfer.failed`) | MEDIUM | ⚠️ OPEN — possible ledger mismatch if fired post-PAID |
| MM-16 | Reconciliation cron | NONE | ✅ CONTROLLED — read-only |
| MM-17 | Dead code `StripeService.createPayout()` | MEDIUM | ⚠️ OPEN — same as MM-02 |

---

## MM-10 — SaaS Payment Findings (reclassified 2026-09-16)

**Investigation:** `audit/phase2/MM10-MM05-INVESTIGATION.md`  
**Original classification:** HIGH (PAY-01 parallel) — **INCORRECT. Reclassified.**

`saas-payment.ts` does not read `provider.stripeAccountId` and does not set `transfer_data.destination`. Money lands on the platform Stripe account, not the provider. The PAY-01 account-substitution attack class is **not applicable** to this path. The three remaining findings are tracked independently below.

### MM-10-A — Provider routing absent (architectural incompleteness)

| Field | Value |
|---|---|
| Class | Architectural gap — not an exploitable security vulnerability |
| Impact | SaaS providers cannot receive direct payment; every SaaS booking payment accumulates on the platform account with no forwarding |
| Code location | `lib/services/saas-payment.ts` — `createCheckoutSession()` — no `transfer_data` in `sessionParams` |
| Phase 1 cross-ref | None — new finding from Phase 2 money-movement audit |
| Security note | When `transfer_data.destination` IS added, ownership verification (same as PAY-01 fix) MUST be applied before session creation |
| Status | ⚠️ OPEN — P1 (feature completion prerequisite for future security control) |

### MM-10-B — Concurrent checkout session creation (double-charge risk)

| Field | Value |
|---|---|
| Class | Application-level concurrency defect — no database compromise required |
| Impact | Two concurrent `/api/client/quotes/[id]/accept` requests create two Stripe sessions for the same quote; customer paying both is double-charged; `handleCheckoutComplete()` idempotency prevents double-booking but not double-charge |
| Code location | `lib/services/saas-payment.ts` lines ~106–236 — `quote.stripeSessionId` write is not conditional on `stripeSessionId === null` |
| Exploit complexity | Two concurrent browser requests (e.g. double-click, two tabs) |
| Required fix | `prisma.quote.update({ where: { id: quoteId, stripeSessionId: null }, data: { stripeSessionId: session.id } })` — reject if 0 rows updated |
| Phase 1 cross-ref | None — new finding |
| Status | ⚠️ OPEN — P1 |

### MM-10-C — `applicationFeeAmount` always zero (commission config defect)

| Field | Value |
|---|---|
| Class | Logic bug — dead code |
| Impact | Platform collects 0 commission on all SaaS bookings regardless of `BusinessSettings.commissionRate`; `commissionPercent` is not a field on `BusinessConfig`; `assembleConfig()` never populates it; `?? 0` fallback makes fee permanently zero |
| Code location | `lib/services/saas-payment.ts` lines ~130–136 |
| Required fix | Read `BusinessSettings.commissionRate` directly instead of the non-existent `businessConfig.commissionPercent` |
| Phase 1 cross-ref | None — new finding |
| Status | ⚠️ OPEN — P1 |

---

## MM-05 — Refund Idempotency Findings (granular 2026-09-16)

**Investigation:** `audit/phase2/MM10-MM05-INVESTIGATION.md`  
**Root structural weakness:** No dedicated `Refund` entity. State is scattered across `Booking.stripeRefundId`, `Booking.cancellationStatus`, `LedgerEntry`, and `Transaction` records. The fix must establish **one authoritative refund lifecycle** covering: refund intent → Stripe refund ID → idempotency key → status → amount → booking/transaction → ledger linkage. Every refund entry point must use that lifecycle. "Create a Refund model" is one possible implementation but not the only valid one.

### MM-05-A — Concurrent admin refund race (`approveCancellation()`)

| Field | Value |
|---|---|
| Class | Confirmed money-movement defect |
| Impact | Two concurrent admin approve requests for the same cancellation can both pass the `cancellationStatus !== 'PENDING'` check before either writes `APPROVED`; both call `stripe.refunds.create()`; two separate Stripe refund objects may be issued |
| Code location | `lib/services/booking-service.ts` ~line 659 — `approveCancellation()` |
| Gate | `cancellationStatus !== 'PENDING'` check — **not atomic** with Stripe call (TOCTOU) |
| Idempotency key | **None** |
| Stable key available | `bookingId` — use `approve-cancel-${bookingId}` |
| Phase 1 cross-ref | PAY-H-01 (refund reconciliation) — related but separate |
| Status | ⚠️ OPEN — **P0** |

### MM-05-B — Lost-refund / no-retry gap (public cancel route)

| Field | Value |
|---|---|
| Class | Confirmed reliability / money-movement defect |
| Impact | `stripe.refunds.create()` is called **after** the DB transaction commits (booking → CANCELLED via atomic CAS); if the Stripe call fails (network partition, Stripe outage), the booking is cancelled but no refund is ever issued; no safe retry path exists without an idempotency key |
| Code location | `app/api/public/bookings/[id]/cancel/route.ts` ~line 250 |
| Gate | ✅ Atomic `updateMany` CAS — correctly prevents double-cancellation |
| Idempotency key | **None** — key would be `cancel-refund-${bookingId}` |
| Phase 1 cross-ref | PAY-H-01 / INT-M-01A (Stripe call outside transaction) |
| Status | ⚠️ OPEN — **P0** |

### MM-05-C — Concurrent admin transaction refund

| Field | Value |
|---|---|
| Class | Confirmed money-movement defect |
| Impact | Two concurrent admin refund requests for the same transaction both pass `transaction.status !== 'COMPLETED'` check; both reach `stripe.refunds.create()`; no atomic gate, no idempotency key |
| Code location | `app/api/admin/transactions/[transactionId]/refund/route.ts` ~line 99 |
| Gate | `transaction.status !== 'COMPLETED'` — **not atomic** with Stripe call (TOCTOU) |
| Idempotency key | **None** — key would be `admin-refund-${transactionId}` |
| Phase 1 cross-ref | F-08 (refund limit enforcement — separate concern, already closed) |
| Status | ⚠️ OPEN — **P0** |

### MM-05-D — No app-level guard on 3DS/prepaid auto-refund (Site A)

| Field | Value |
|---|---|
| Class | Theoretical risk |
| Impact | `checkout.session.completed` webhook handler issues refund without calling `recordWebhookEvent()`; Stripe retry of the same event re-executes the refund path; Stripe's own deduplication (same PaymentIntent, already fully refunded) is the only guard |
| Code location | `app/api/stripe/webhook/route.ts` ~line 392 |
| Idempotency key | **None** — key would be `prepaid-refund-${checkoutSession.id}` |
| Status | ⚠️ OPEN — P1 (Stripe dedup reduces urgency) |

### MM-05-E — WebhookEvent rolls back on expired-booking refund (Site B)

| Field | Value |
|---|---|
| Class | Behavioural gap |
| Impact | `ExpiredBookingError` thrown inside `$transaction` rolls back the `recordWebhookEvent` INSERT; Stripe retries the event indefinitely; the Stripe idempotency key (`expired-booking-refund-${bookingId}-${paymentIntentId}`) prevents duplicate Stripe refund objects but the application keeps re-executing the code path |
| Code location | `app/api/stripe/webhook/route.ts` ~line 1084 |
| Idempotency key | ✅ Stripe key present and correct |
| Required fix | Write `recordWebhookEvent` **outside** (after) the transaction, once the Stripe refund call succeeds |
| Status | ⚠️ OPEN — P1 |

---

## MM-07 — Refund Ledger Reconciliation Defect (confirmed 2026-09-16)

| Field | Value |
|---|---|
| Class | Confirmed ledger accuracy / reconciliation defect |
| Impact | `approveCancellation()` (MM-05-A) and the public cancel route (MM-05-B) issue Stripe refunds but write **no `LedgerEntry(REFUND_ISSUED)`**. When Stripe subsequently fires `charge.refunded`, `handleChargeRefunded()` finds `alreadyRecordedRefund = 0` and writes a `REFUND_SYNCED` entry for the full amount. The same economic refund is double-represented in the ledger: once as a booking debit, once as a `REFUND_SYNCED` that implies the refund was platform-originated. |
| What is NOT affected | Customer wallet balance — `handleChargeRefunded()` does not write wallet credits; no customer-facing money is double-counted |
| What IS affected | `totalRefunded` on `PlatformLedger`; financial reconciliation reports; any dashboard that aggregates `LedgerEntry` by type |
| Root cause | No `LedgerEntry(REFUND_ISSUED)` written at refund-issuance time by Sites C/D/E |
| Required fix | Every refund entry point that calls `stripe.refunds.create()` must also write `LedgerEntry(REFUND_ISSUED)` in the same transaction as the booking/status update, so `handleChargeRefunded()` can correctly compute `refundDelta = 0` |
| Phase 1 cross-ref | PAY-H-01, INT-M-01A (reconciliation gaps) |
| Phase 1 cross-ref | AUDIT-02 (financial state changes not transactionally linked to audit/ledger records) |
| Status | ⚠️ OPEN — **P0** (prerequisite for MM-05 fixes to be complete) |

---

## Current Priority Queue

### P0 — Fix before next release

| # | ID | Item | Why | Prerequisite |
|---|---|---|---|---|
| 1 | MM-05-A | Add idempotency key + atomic gate to `approveCancellation()` | Confirmed: concurrent admin approvals can double-refund | None |
| 2 | MM-05-C | Add idempotency key + atomic gate to admin transaction refund | Confirmed: fully unprotected, no gate, no key | None |
| 3 | MM-05-B | Add idempotency key to public cancel route | DB gate (CAS) exists; key enables safe retry on Stripe failure | None |
| 4 | MM-07 | Write `LedgerEntry(REFUND_ISSUED)` from all refund entry points (MM-05-A/B/C) | Prerequisite for `handleChargeRefunded()` to detect already-processed refunds; fixes ledger double-count | None — but implement alongside P0 items 1–3 |

### P1 — Next sprint

| # | ID | Item | Why | Prerequisite |
|---|---|---|---|---|
| 5 | MM-10-B | Fix session creation race — conditional `stripeSessionId` write | Two concurrent accepts → double charge; no DB compromise needed | None |
| 6 | MM-10-C | Fix `applicationFeeAmount` — read `BusinessSettings.commissionRate` | Commission is permanently zero; dead code | None |
| 7 | MM-10-A | Complete SaaS Connect destination routing | SaaS providers cannot receive payment; when implemented, apply PAY-01 ownership verification | Stripe Connect setup for business accounts |
| 8 | MM-05-D | Add idempotency key + `recordWebhookEvent()` to 3DS/prepaid refund (Site A) | Stripe retries re-execute path; no app-level guard | None |
| 9 | MM-05-E | Fix WebhookEvent rollback in expired-booking path (Site B) | Stripe retries indefinitely; idempotency key is only guard | None |
| 10 | MM-15 | Verify/fix `handleTransferFailed()` ledger reversal | Possible ledger mismatch if fired after `PAYOUT_PAID` entries written | Read `handleTransferFailed()` first |
| 11 | PAY-H-01 / INT-M-01A | Stripe refund reconciliation cron | No detection mechanism when refund Stripe call succeeds but DB fails | None |
| 12 | PAY-H-02 | Booking reschedule price recalculation | Wrong amount charged when reschedule changes duration | None |

### P2 — Follow-up

| # | ID | Item |
|---|---|---|
| 13 | MM-12 | Admin wallet credit/debit idempotency |
| 14 | MM-02/MM-17 | Delete `StripeService.createPayout()` (dead code) |
| 15 | INT-M-03A | Encrypt OAuth tokens at rest |
| 16 | INT-M-03F | Revoke OAuth token on calendar disconnect |
| 17 | PAY-H-04 | SlotReservation unique constraint |
| 18 | DOC-EXP-01 | Block bookings with expired provider documents |
| 19 | DATA-EXP-01 | Remove phone number from public instructor API |
| 20 | AUDIT-01/02/05 | Audit logging hardening |
| 21 | RBAC-M-02 | Replace role checks with permission checks in admin routes |

---

## Files Written This Session

| File | Purpose |
|---|---|
| `lib/services/payout-security.ts` | `verifyPayoutDestinationOwnership()` helper |
| `lib/services/__tests__/payout-security.test.ts` | Unit tests for helper (7/7) |
| `lib/services/__tests__/pay-01-executePayout-security.test.ts` | Service-level tests — proves `transfers.create` not called on failure (5/5) |
| `lib/services/__tests__/pay-01-d-state-consistency.test.ts` | D1–D6 state/retry/idempotency/ledger/alert/concurrency tests (16/16) |
| `lib/services/__tests__/pay-01-FAILED-module-mocking-attempt.test.ts.skip` | Preserved audit evidence of earlier failed approach |
| `docs/PAY-01-STRIPEACCOUNTID-UPDATE-PATH-AUDIT.md` | Complete write-path audit for `Provider.stripeAccountId` |
| `docs/MONEY-MOVEMENT-INVENTORY.md` | 17-path money-movement inventory |
| `docs/MM10-MM05-INVESTIGATION.md` | Deep investigation of MM-10 and MM-05 (5 refund sites) |
| `docs/PAY-01-C-REPRODUCTION-TEST.md` | PAY-01-C status document (closed) |
| `docs/PAY-01-INVESTIGATION-STATUS.md` | PAY-01 overall status |
| `PAY-01-STRIPEACCOUNTID-UPDATE-PATH-AUDIT.md` | (root-level copy) |
| `docs/AUDIT-MASTER-TRACKER.md` | **This file** |

---

## Quick Reference: What Is Done / What Is Next

```
DONE:
  PAY-01 (A/B/C/D)   ← full payout destination ownership fix, 28/28 tests, exit 0
  MM inventory        ← 17 paths catalogued
  MM-10 investigation ← reclassified into MM-10-A/B/C (not a PAY-01 parallel)
  MM-05 investigation ← 5 refund sites → granular sub-findings MM-05-A/B/C/D/E
  MM-07 investigation ← confirmed ledger reconciliation defect

NEXT (P0 — implement now, in order):
  MM-07               ← write REFUND_ISSUED ledger entries (enables correct dedup)
  MM-05-A             ← approveCancellation() idempotency key + atomic gate
  MM-05-C             ← admin transaction refund idempotency key + atomic gate
  MM-05-B             ← public cancel route idempotency key

  NOTE: MM-07 is listed first because the REFUND_ISSUED ledger write must ship
  in the same commit as the Stripe call changes, so handleChargeRefunded() can
  immediately detect the newly keyed refunds rather than double-counting them.

NEXT (P1 — next sprint):
  MM-10-B             ← session creation race (conditional stripeSessionId write)
  MM-10-C             ← applicationFeeAmount fix (use BusinessSettings.commissionRate)
  MM-10-A             ← SaaS Connect destination routing (full feature, with PAY-01 guard)
  MM-05-D/E           ← webhook refund path guards
  MM-15               ← handleTransferFailed() ledger reversal verification

OPEN (Phase 1 P1 not yet started):
  PAY-H-01/INT-M-01A, PAY-H-02, INT-M-03A, INT-M-03F
```
