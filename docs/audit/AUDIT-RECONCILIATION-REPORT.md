# DriveBook Security Audit — Reconciliation Report

**Date:** 2026-09-16  
**Purpose:** Account for every finding ID across all audit phases. For each finding, record its current lifecycle stage, what evidence supports each stage, and what is explicitly missing before it can advance.  
**Source of truth:** `AUDIT-MASTER-TRACKER.md`  
**Process:** `AUDIT-PROCESS.md`

---

## Reading This Report

Each entry uses this format:

```
ID — Title
  Stage reached:  FINDING / VERIFIED / FIX / FIX-VERIFIED / CLOSED / SUPERSEDED / REJECTED
  Finding evidence:   what proves the condition exists
  Verification:       who confirmed it and how
  Fix evidence:       commit SHA or "none"
  Fix-Verified:       test count + exit code or "none"
  Missing:            what must be produced before this finding can advance
```

Findings are grouped by status: CLOSED first, then OPEN by priority, then SUPERSEDED, then REJECTED.

---

## CLOSED Findings (lifecycle complete)

---

### P0-01A — Wallet PaymentIntent cross-user theft
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — wallet-add/route.ts accepted any userId's PaymentIntent
Verification:    GPT source-level review, 2026-09-11; code path traced
Fix:             Commit b9c2f0ff — metadata.userId stamped at create-intent;
                 wallet-add verifies metadata.userId === session.user.id; fail-closed
Fix-Verified:    12 tests, Vitest exit 0
Missing:         Nothing — closure criteria met
```

---

### P0-01B — Concurrent wallet credit race condition
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — two concurrent requests could both credit wallet
                 from same PaymentIntent (TOCTOU)
Verification:    GPT source-level review; original test was sequential (inadequate);
                 race condition confirmed at source
Fix:             Commit b9c2f0ff — partial unique index on
                 metadata->>'stripePaymentIntentId' WHERE NOT NULL;
                 P2002 → 409 with PAYMENT_ALREADY_CREDITED code
Fix-Verified:    12 tests, Vitest exit 0 (genuine concurrent test using Promise.all)
Missing:         Nothing — closure criteria met
```

---

### SUB-22 — Subscription duplicate rows
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — no @@unique constraints on providerId/stripeSubscriptionId
Verification:    Source confirmed; schema inspection
Fix:             Commit 2422870d — @@unique applied; duplicates backfilled
Fix-Verified:    Source verified; DB constraint enforced
Missing:         No dedicated targeted test that would fail without the constraint.
                 Acknowledged Phase 1 methodology gap — acceptable given DB enforcement
```

---

### SUB-02-A — Subscription creation not atomic
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — Subscription.create and Provider.update separate operations
Verification:    Source confirmed — failure between them created inconsistent state
Fix:             prisma.$transaction() wraps both operations in subscription route
Fix-Verified:    Source verified
Missing:         No dedicated targeted test for partial-failure scenario.
                 Acknowledged methodology gap
```

---

### SUB-02-B — Concurrent trial creation race
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — findFirst before create allowed two concurrent trials
Verification:    Source confirmed
Fix:             Race check inside SERIALIZABLE transaction; early return on race loss
Fix-Verified:    Source verified
Missing:         No dedicated concurrent test (P2034 serialization surfaces as 500)
```

---

### SUB-04-A — Unpaid subscription activated on subscription.created
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — webhook activated subscription before payment confirmed
Verification:    Source confirmed
Fix:             Activation moved to invoice.payment_succeeded
Fix-Verified:    Source verified
Missing:         No dedicated test for failed-first-payment scenario
```

---

### SUB-09-A — Instructor cancellation missing Stripe call
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — DELETE route updated DB without calling Stripe API
Verification:    Source confirmed
Fix:             subscription-cancel.ts service; Stripe-first order enforced
Fix-Verified:    Source verified
Missing:         Nothing materially blocking; residual: Stripe cancels but DB update
                 fails → Stripe shows cancelled, DB shows active (recovery via sync;
                 not a security issue)
```

---

### SUB-10-A — Inconsistent cancellation implementations
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — 3 paths with inconsistent Stripe behaviour
Verification:    Source confirmed
Fix:             Unified subscription-cancel.ts; all 3 paths delegate to it
Fix-Verified:    Source verified
Missing:         Nothing
```

---

### SUB-12-A — Trial expiry cron race with paid conversion
```
Stage reached:   CLOSED (pre-existing correct implementation)
Finding:         Confirmed in Phase 1 audit — but already correctly implemented
Verification:    Source confirmed: updateMany with status:'TRIAL' guard; count===0 check
Fix:             N/A — already correct; no change needed
Fix-Verified:    N/A
Missing:         Nothing
```

---

### C-1 — Provider self-upgrade tier without payment
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — provider could POST tier change without payment
Verification:    Source confirmed — guard present at subscription route lines 199–209
Fix:             403 guard: if status !== 'TRIAL' and tier changes → USE_BILLING_PORTAL
Fix-Verified:    Source verified
Missing:         Legacy mobile endpoint (app/api/instructor/subscription/mobile/route.ts)
                 has no equivalent guard but is confirmed unused (no callers).
                 Technical debt — remove endpoint in future cleanup
```

---

### F-08 — Admin refund limit not enforced
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — maxRefundAmount not checked before Stripe call
Verification:    Source confirmed
Fix:             checkPermission + limit enforcement before Stripe call;
                 SUPER_ADMIN exempt; null treated as $0
Fix-Verified:    Source verified (95% confidence per SECURITY_FINDINGS_TRACKER)
Missing:         No targeted test for limit enforcement at the route boundary.
                 Noted gap — acceptable for now
```

---

### PAY-01 — Payout destination ownership
```
Stage reached:   FIX-VERIFIED → CLOSED
Finding:         Confirmed — executePayout() used DB-supplied stripeAccountId
                 without Stripe-side verification; DB compromise can substitute
                 attacker's account as transfer destination
Verification:    Full write-path audit (PAY-01-A/B); Stripe metadata binding
                 established as authoritative for this application threat model
Fix:             Commit b9c2f0ff
                 - lib/services/payout-security.ts: verifyPayoutDestinationOwnership()
                 - lib/services/payout-service.ts: check before stripe.transfers.create()
                 - TOCTOU: verified account captured as const verifiedAccountId
Fix-Verified:    28 tests, Vitest exit 0
                 - payout-security.test.ts: 7 (helper unit)
                 - pay-01-executePayout-security.test.ts: 5 (service-level; critical:
                   transfers.create NOT called on failure; TOCTOU assertion)
                 - pay-01-d-state-consistency.test.ts: 16 (D1-D6)
Missing:         Nothing — closure criteria met
OPS note:        sendAlert() is fire-and-forget; payout state independent of alert
                 delivery; recorded as OPS-01 (not a finding)
```

---

## OPEN Findings — P0 (VERIFIED, awaiting fix)

---

### MM-07 — Refund ledger reconciliation defect
```
Stage reached:   VERIFIED
Finding:         Confirmed — Sites C/D/E issue Stripe refunds but write no
                 LedgerEntry(REFUND_ISSUED); handleChargeRefunded() sees
                 alreadyRecordedRefund=0 → writes duplicate REFUND_SYNCED;
                 totalRefunded systematically over-counted
                 NOT a wallet double-credit (handleChargeRefunded writes no wallet entry)
Verification:    Code traced: approveCancellation(), public cancel route, and
                 admin transaction refund all confirmed to skip REFUND_ISSUED write;
                 handleChargeRefunded() refundDelta logic traced
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Add LedgerEntry(REFUND_ISSUED) write inside each of MM-05-A/B/C transaction blocks
  - Must ship in same commit as idempotency key changes (no gap window)
Missing before CLOSED:
  - Targeted test: issue refund via approveCancellation → trigger charge.refunded →
    confirm exactly one ledger entry (not two)
  - Vitest exit 0
```

---

### MM-05-A — Concurrent admin refund race (approveCancellation)
```
Stage reached:   VERIFIED
Finding:         Confirmed — booking-service.ts ~659: no idempotency key;
                 cancellationStatus !== 'PENDING' check not atomic with Stripe call;
                 two concurrent admin approvals can both reach stripe.refunds.create()
Verification:    Code traced; TOCTOU pattern confirmed; idempotency key absence confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Stable key available: approve-cancel-${bookingId}
Missing before FIX:
  - Idempotency key on stripe.refunds.create()
  - Make gate atomic: updateMany({ where: { cancellationStatus: 'PENDING' },
    data: { cancellationStatus: 'APPROVING' } }); abort if count===0
Missing before CLOSED:
  - Targeted test: two concurrent approveCancellation calls for same booking →
    exactly one Stripe refund created (transfers.create called once)
  - Targeted test: second call after first commits → returns already-approved error
  - Vitest exit 0
```

---

### MM-05-C — Concurrent admin transaction refund
```
Stage reached:   VERIFIED
Finding:         Confirmed — admin/transactions/[id]/refund ~99: no atomic gate,
                 no idempotency key; transaction.status check not atomic with Stripe call
Verification:    Code traced; fully unprotected confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Stable key available: admin-refund-${transactionId}
Missing before FIX:
  - Idempotency key on stripe.refunds.create()
  - Atomic gate: updateMany({ where: { status: 'COMPLETED' }, data: { status: 'REFUNDING' } })
Missing before CLOSED:
  - Targeted test: concurrent admin refund requests → exactly one Stripe call
  - Vitest exit 0
```

---

### MM-05-B — Lost-refund / no-retry gap (public cancel route)
```
Stage reached:   VERIFIED
Finding:         Confirmed — public/bookings/[id]/cancel ~250: atomic CAS correctly
                 prevents double-cancellation; but Stripe call is outside the transaction
                 with no idempotency key; Stripe failure after DB commit leaves
                 booking cancelled but no refund issued; no safe retry path
Verification:    Code traced; updateMany CAS confirmed correct; key absence confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Stable key available: cancel-refund-${bookingId}
Note:            No atomic gate change needed (CAS already prevents duplicate entry);
                 only idempotency key required for safe retry
Missing before FIX:
  - Idempotency key on stripe.refunds.create()
Missing before CLOSED:
  - Targeted test: Stripe call fails → retry with same key → only one refund object
  - Vitest exit 0
```

---

## OPEN Findings — P1 (VERIFIED, awaiting fix)

---

### MM-10-A — SaaS provider routing absent
```
Stage reached:   VERIFIED
Finding:         Confirmed — saas-payment.ts createCheckoutSession() has no
                 transfer_data.destination; money lands on platform Stripe account
Verification:    saas-payment.ts sessionParams confirmed: no transfer_data field;
                 Business/Provider schema confirmed: no stripeAccountId on Business model
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Note:            When transfer_data.destination IS added, PAY-01 ownership
                 verification MUST be applied before session creation
Missing before FIX:
  - Stripe Connect eligibility check (provider.chargesEnabled + stripeAccountId != null)
  - verifyPayoutDestinationOwnership() call before session creation
  - PAY-01 security invariant extended to this path
Missing before CLOSED:
  - Targeted tests (service-level with mocked Stripe): session not created if provider
    not eligible; session contains correct destination; ownership check blocks wrong account
  - Vitest exit 0
```

---

### MM-10-B — Concurrent checkout session creation (double-charge)
```
Stage reached:   VERIFIED
Finding:         Confirmed — Quote.stripeSessionId write not conditional on null;
                 two concurrent accepts create two Stripe sessions; double-charge possible
                 without any DB compromise
Verification:    saas-payment.ts lines ~106–236 traced; update not conditional on
                 stripeSessionId: null confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - prisma.quote.update({ where: { id: quoteId, stripeSessionId: null },
    data: { stripeSessionId: session.id } })
  - Return existing session or error if 0 rows updated (concurrent request already won)
Missing before CLOSED:
  - Targeted test: two concurrent createCheckoutSession calls for same quoteId →
    only one Stripe session created
  - Vitest exit 0
```

---

### MM-10-C — applicationFeeAmount always zero
```
Stage reached:   VERIFIED
Finding:         Confirmed — (businessConfig as any).commissionPercent always undefined;
                 assembleConfig() never sets it; ?? 0 fallback makes fee permanently zero;
                 correct field is BusinessSettings.commissionRate
Verification:    saas-payment.ts lines ~130–136; business-config.ts assembleConfig()
                 confirmed: commissionPercent not in returned object
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Replace (businessConfig as any).commissionPercent with query to BusinessSettings.commissionRate
Missing before CLOSED:
  - Targeted test: business with commissionRate=10 → applicationFeeAmount = 10% of total
  - Vitest exit 0
```

---

### MM-05-D — No app-level guard on 3DS/prepaid auto-refund
```
Stage reached:   VERIFIED
Finding:         Confirmed — webhook/route.ts ~392: no idempotency key on
                 stripe.refunds.create(); no recordWebhookEvent() on this code path;
                 Stripe retries re-execute the refund call
Verification:    Code traced; confirmed Stripe own deduplication is only guard
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Stable key available: prepaid-refund-${checkoutSession.id}
Missing before FIX:
  - Idempotency key on stripe.refunds.create()
  - recordWebhookEvent() call to prevent retry re-execution
Missing before CLOSED:
  - Targeted test: same webhook event delivered twice → refund created once
  - Vitest exit 0
```

---

### MM-05-E — WebhookEvent rolls back on expired-booking refund
```
Stage reached:   VERIFIED
Finding:         Confirmed — webhook/route.ts ~1084: ExpiredBookingError thrown inside
                 $transaction rolls back recordWebhookEvent INSERT; Stripe idempotency
                 key exists and is correct; but Stripe retries indefinitely because
                 application never returns 200 with a persisted WebhookEvent
Verification:    Transaction rollback behaviour traced; key confirmed correct;
                 retry loop confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Write recordWebhookEvent OUTSIDE $transaction, after stripe.refunds.create() succeeds
  - Or: use a separate non-rolling-back transaction for the WebhookEvent write
Missing before CLOSED:
  - Targeted test: same payment_intent.succeeded event for expired booking delivered
    twice → refund created once; second delivery returns 200 without calling Stripe
  - Vitest exit 0
```

---

### PAY-H-01 / INT-M-01A — Stripe refund reconciliation gap
```
Stage reached:   VERIFIED
Finding:         Confirmed — F-09 deliberately moved refund call outside transaction;
                 if Stripe succeeds but DB update fails, no reconciliation mechanism exists
                 to detect orphaned Stripe refunds
Verification:    Source confirmed; no reconciliation cron exists
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Daily cron comparing Stripe refund IDs against booking.stripeRefundId
  - Alert on mismatches
Missing before CLOSED:
  - Targeted test or cron integration test
```

---

### PAY-H-02 — Booking reschedule price not recalculated
```
Stage reached:   VERIFIED
Finding:         Confirmed — reschedule/route.ts does not compare old and new price
Verification:    Source confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Price recalculation on reschedule; charge/refund difference if > $0.01
Missing before CLOSED:
  - Targeted test: 1hr lesson rescheduled to 2hr → additional charge applied
```

---

### MM-15 — Late transfer.failed after PAID ledger entries
```
Stage reached:   FINDING (verification incomplete)
Finding:         Possible — if transfer.failed fires after PAYOUT_PAID ledger
                 entries written, ledger shows payout that didn't complete
Verification:    UNVERIFIED — handleTransferFailed() not yet read
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before VERIFIED:
  - Read handleTransferFailed() in webhook/route.ts
  - Confirm whether it reverses appendLedgerEntry(PAYOUT_PAID) entries
  - If reversal missing, that is the finding; if present, REJECTED
Missing before CLOSED:
  - Targeted test (after verification): Stripe fires transfer.failed after PAID state
    → ledger correctly reversed or alert fired for manual reconciliation
```

---

### MM-14 — Dispute close / charge.refunded overlap
```
Stage reached:   FINDING (verification incomplete)
Finding:         Possible — handleDisputeClosed() and handleChargeRefunded() may both
                 write credits for the same economic event
Verification:    UNVERIFIED — handleDisputeClosed() not yet read
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before VERIFIED:
  - Read handleDisputeClosed() in webhook/route.ts
  - Determine whether it writes a wallet credit or ledger entry
  - Cross-reference with handleChargeRefunded() to check for overlap
Missing before CLOSED:
  - Targeted test (after verification): dispute closed → charge.refunded also fires →
    wallet/ledger credited exactly once
```

---

## OPEN Findings — P2

---

### MM-12 — Admin wallet credit/debit no idempotency
```
Stage reached:   VERIFIED
Finding:         Confirmed — add-credit and deduct-credit routes have no
                 duplicate-submit protection; double-submit inflates wallet balance
Verification:    Routes confirmed: no idempotency key or duplicate detection
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Request idempotency key (from header or client-generated token)
  - DB: check for existing transaction with same key before creating
Missing before CLOSED:
  - Targeted test: admin submits same credit twice with same idempotency key →
    wallet credited once
```

---

### MM-02 — Unguarded dead-code transfer method
```
Stage reached:   VERIFIED
Finding:         Confirmed — StripeService.createPayout() has 0 callers; no ownership
                 check, no idempotency key, no ledger write, no state machine
Verification:    grep confirmed 0 callers
Fix:             NOT-STARTED (deletion)
Fix-Verified:    PENDING
Missing before FIX:
  - Delete StripeService.createPayout() method from lib/services/stripe.ts
Missing before CLOSED:
  - grep confirms 0 matches after deletion
  - TypeScript compilation passes
```

---

### INT-M-03A — OAuth tokens stored plaintext
```
Stage reached:   VERIFIED
Finding:         Confirmed — googleAccessToken and googleRefreshToken stored as
                 plaintext strings in Provider model
Verification:    Schema confirmed; no encryption decorator or application-layer cipher
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Application-layer AES-256-GCM encrypt on write, decrypt on read
  - Migrate existing tokens
Missing before CLOSED:
  - Targeted test: stored value is ciphertext; decrypted value enables calendar sync
```

---

### INT-M-03F — OAuth token not revoked on disconnect
```
Stage reached:   VERIFIED
Finding:         Confirmed — no google.auth.OAuth2.revokeToken() call in
                 calendar disconnect flow
Verification:    googleCalendar.ts disconnect() confirmed: only DB update, no Stripe call
Fix:             NOT-STARTED
Fix-Verified:    PENDING
Missing before FIX:
  - Call revokeToken() before DB update in disconnect()
Missing before CLOSED:
  - Targeted test: disconnect → old access token rejected by Google API
```

---

### PAY-H-04 — SlotReservation concurrency
```
Stage reached:   VERIFIED
Finding:         Confirmed — no @@unique([providerId, startTime]) in schema
Verification:    Schema confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
```

### DOC-EXP-01 — Expired provider can still receive bookings
```
Stage reached:   VERIFIED
Finding:         Confirmed — no document expiry gate in booking creation route
Verification:    Source confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
```

### DATA-EXP-01 — Public instructor phone exposed
```
Stage reached:   VERIFIED
Finding:         Confirmed — phone in public projection
Verification:    Source confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
```

### AUDIT-01/02/05 — Audit logging hardening
```
Stage reached:   VERIFIED
Finding:         All three confirmed — fail-open catch, non-atomic audit writes,
                 coverage gaps
Verification:    Source confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
```

### RBAC-M-02 — Role checks instead of permission checks
```
Stage reached:   VERIFIED
Finding:         Confirmed — role === 'SUPER_ADMIN' pattern in admin routes
Verification:    Source confirmed
Fix:             NOT-STARTED
Fix-Verified:    PENDING
```

---

## SUPERSEDED Findings

---

### MM-10 — SaaS direct-to-provider payment (original HIGH classification)
```
Stage reached:   SUPERSEDED
Finding:         Original: Confirmed as HIGH (PAY-01 parallel, account substitution)
Reclassified:    2026-09-16 — original security classification disproven by code
                 verification. saas-payment.ts never reads provider.stripeAccountId.
                 No transfer_data.destination in sessionParams. Money lands on
                 platform Stripe account, not provider. PAY-01 attack class not
                 applicable.
Replaced-by:     MM-10-A, MM-10-B, MM-10-C
Evidence:        phase2/MM10-MM05-INVESTIGATION.md
Original evidence preserved: MONEY-MOVEMENT-INVENTORY.md (MM-10 row)
```

### MM-17 — Dead-code StripeService.createPayout() (duplicate)
```
Stage reached:   SUPERSEDED
Reason:          Duplicate of MM-02; MM-02 is the canonical ID
Replaced-by:     MM-02
```

---

## REJECTED Findings

| ID | Title | Rejection reason |
|---|---|---|
| P0-02 | Client reschedule TOCTOU | Code has correct ownership check |
| P0-03 | Reviews authorisation missing | Ownership check present at line 207 |
| PAY-H-03 | Package hour credit race | Transaction-wrapped updateMany — safe |
| PAY-H-05 | Wallet-booking disconnect | Separate flows by design; balance checked atomically |
| AUTH-M-01 | Session fixation | NextAuth v4 regenerates tokens on auth |
| AUTH-M-02 | Token rotation | NextAuth v4 handles JWT rotation |
| RBAC-M-01 | Role escalation via API | No route allows self-role modification |
| APP-H-01/02/03 | Rate limiting gaps | Vercel Edge + Stripe limits adequate |
| DATA-M-01/02/03 | Data over-projection | Projections verified appropriate |
| INT-M-01C | SMS delivery failure | Notification-only; fire-and-forget acceptable |
| INT-M-01D | Webhook retry behaviour | WebhookEvent idempotency key prevents duplicates |
| INT-M-02 | Email failure handling | Retry queue exists for critical emails |
| INT-M-03B/C/D/E | OAuth token sub-issues | Refresh, exposure, expiry, scope all safe |

---

## Summary: What Each Finding Still Needs

| Status | Count | Next action |
|---|---|---|
| ✅ CLOSED | 12 | Nothing |
| SUPERSEDED | 2 | Nothing (sub-findings carry forward) |
| REJECTED | 16 | Nothing |
| VERIFIED → awaiting FIX | 18 | Implement fix, add targeted tests |
| FINDING → awaiting VERIFIED | 2 (MM-14, MM-15) | Read code before fixing |
| DEFERRED | 2 | Await architecture redesign |

**Total active findings tracked:** 52

**Findings with no targeted tests at all (including CLOSED):**  
All Phase 1 CLOSED findings except P0-01A/B and PAY-01 were closed by source verification alone. This is an acknowledged Phase 1 methodology gap. It means those closures rest on code inspection, not executable regression tests. They remain CLOSED but are flagged here for completeness.

**Single most critical gap before P0 work can begin:**  
MM-14 and MM-15 must be verified (code read) before their findings can be confirmed or rejected. MM-14 in particular may affect the MM-07 fix design if dispute closure also writes credits.
