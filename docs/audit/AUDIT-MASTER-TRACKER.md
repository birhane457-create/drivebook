# DriveBook Security Audit — Master Tracker

**Version:** 3.9 (MM-02 CLOSED)
**Last Updated:** 2026-09-22  
**Process:** See `AUDIT-PROCESS.md` for stage definitions, closure rules, and Kiro enforcement rules.  
**Authority:** This file is the single authoritative record of every finding's lifecycle state.  
All other audit documents are evidence records that support this file.

---

## How to Read This Table

| Column | Meaning |
|---|---|
| **ID** | Stable identifier — never changes |
| **Title** | Short description |
| **Risk** | CRITICAL / HIGH / MEDIUM / LOW / NONE / ARCHITECTURAL |
| **Finding** | CONFIRMED / REJECTED / SUPERSEDED |
| **Verification** | VERIFIED (independent code proof) / UNVERIFIED |
| **Fix** | Commit SHA or NOT-STARTED or N/A |
| **Fix-Verified** | `N tests, exit 0` or PENDING or N/A |
| **Status** | OPEN / CLOSED / SUPERSEDED / REJECTED |
| **Evidence** | Primary evidence document path |
| **Phase-1-ref** | Cross-ref to PHASE1_REMEDIATION_REGISTER ID |

---

## Section 1 — Phase 1 Findings (Original 56-Finding Register)

### 1.1 — P0 Critical

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| P0-01A | Wallet PaymentIntent cross-user theft | CRITICAL | CONFIRMED | VERIFIED — `wallet-add/route.ts` ownership check absent confirmed in source | `b9c2f0ff` (metadata check + userId stamping) | 18 tests (10 unit + 8 integration), exit 0 | ✅ CLOSED | `phase1/P0-01_TEST_EVIDENCE.md` | P0-01 |
| P0-01B | Concurrent wallet credit race condition | MEDIUM | CONFIRMED | VERIFIED — DB constraint absent confirmed; test was sequential not concurrent | `b9c2f0ff` (partial unique index on `stripePaymentIntentId`; P2002 → 409) | 12 tests, exit 0 | ✅ CLOSED | `phase1/P0-01B_FIX_IMPLEMENTATION.md` | P0-01 |

### 1.2 — P1 High Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| SUB-22 | Subscription duplicate rows — missing unique constraints | HIGH | CONFIRMED | VERIFIED — source confirmed no `@@unique` on Provider/Subscription | `2422870d` (@@unique constraints applied) | DB constraint + tests | ✅ CLOSED | `phase1/SUB-22_VERIFICATION.md` | SUB-22 |
| SUB-04-A | Unpaid subscription activated on `subscription.created` | HIGH | CONFIRMED | VERIFIED — webhook handler activated on wrong event | Activation moved to `invoice.payment_succeeded` | Verified in source | ✅ CLOSED | `phase1/SUB-04-A_VERIFICATION.md` | SUB-04-A |
| SUB-09-A | Instructor cancellation missing Stripe call | CRITICAL | CONFIRMED | VERIFIED — DELETE route updated DB without calling Stripe | `subscription-cancel.ts` service; Stripe-first order | Verified in source | ✅ CLOSED | `phase1/SUB-09-10-12_VERIFICATION.md` | SUB-09-A |
| SUB-10-A | Three inconsistent cancellation implementations | CRITICAL | CONFIRMED | VERIFIED — three paths with different Stripe behaviour | Unified `subscription-cancel.ts`; all paths delegate | Verified in source | ✅ CLOSED | `phase1/SUB-09-10-12_VERIFICATION.md` | SUB-10-A |
| SUB-12-A | Trial expiry cron race with paid conversion | CRITICAL | CONFIRMED | VERIFIED — `updateMany` with status guard confirmed correct | Already fixed; no change needed | N/A — pre-existing fix | ✅ CLOSED | `phase1/SUB-12A-VERIFICATION-COMPLETE.md` | SUB-12-A |
| SUB-02-A | Subscription creation not atomic | HIGH | CONFIRMED | VERIFIED — Subscription.create and Provider.update were separate | `prisma.$transaction()` wraps both operations | Verified in source | ✅ CLOSED | `phase1/SUB-02_VERIFICATION.md` | SUB-02-A |
| SUB-02-B | Concurrent trial creation race | HIGH | CONFIRMED | VERIFIED — findFirst before create allowed race | Race check inside SERIALIZABLE transaction | Verified in source | ✅ CLOSED | `phase1/SUB-02_VERIFICATION.md` | SUB-02-B |
| C-1 | Provider self-upgrade tier without payment | CRITICAL | CONFIRMED | VERIFIED — guard present at subscription route line 199–209 | 403 guard on non-TRIAL tier change | Verified in source | ✅ CLOSED | `phase1/C-1_VERIFICATION.md` | C-1 |
| PAY-H-01 | Stripe refund outside transaction — no reconciliation | HIGH | CONFIRMED | VERIFIED — F-09 left refund call outside tx by design | This commit — Path B: `stripeRefundId` written in same `booking.update` as `notes`; Check 5 in `reconcile-stripe` cron enumerates `stripe.refunds.list()`, repairs missing `stripeRefundId` (CANCELLED bookings), flags financial mismatches, idempotent alerting; no auto ledger entries | 15 PAY-H-01 tests (PH-1–PH-10), exit 0 — `pay-h01-refund-reconciliation.test.ts` | ✅ FIX-VERIFIED | `PHASE1_REMEDIATION_REGISTER.md` | PAY-H-01 |
| PAY-H-02 | Booking reschedule price not recalculated | HIGH | CONFIRMED | VERIFIED — `reschedule/route.ts` no price comparison; all four routes left `platformFee`, `providerPayout`, `commissionRate`, `Transaction` stale after duration change; Route C had no transaction wrapper; Stripe-paid bookings not blocked on price change | This commit — `computeRescheduleFinancials()` pure helper (locked rate, never live provider rate); `rescheduleBooking()` rewritten as single SERIALIZABLE source of truth: `rescheduleCount` CAS, Stripe-paid price-change block, package duration block, full four-field financial update, `Transaction` `updateMany`, atomic wallet debit/credit; Routes A/B/C delegate entirely; Route C conflict check inside transaction | 35 PAY-H-02 tests (F1–F9 pure, R1–R26 service), exit 0 — `pay-h02-reschedule-financials.test.ts` | ✅ FIX-VERIFIED | `PHASE1_REMEDIATION_REGISTER.md` | PAY-H-02 |
| INT-M-01A | Stripe refund reconciliation gap (inverse of PAY-H-01) | HIGH | CONFIRMED | VERIFIED — no reconciliation cron exists | Subsumed by PAY-H-01 fix this commit (Check 5 in reconcile-stripe cron) | Same 15 tests as PAY-H-01 | ✅ FIX-VERIFIED — consolidated with PAY-H-01 | `PHASE1_REMEDIATION_REGISTER.md` | INT-M-01A |
| INT-M-03A | OAuth tokens stored plaintext | HIGH | CONFIRMED | VERIFIED — `googleAccessToken` plaintext in Provider model | `ec928470` — `lib/encryption/oauth-tokens.ts` (AES-256-GCM, 12-byte nonce, v1 format); `googleCalendar.ts` encrypt/decrypt integrated; `scripts/migrate-encrypt-oauth-tokens.mjs` production migration script | 6 MSE tests (MSE-1 to MSE-6), exit 0, 18.25s — `oauth-migration-script-execution.test.ts` executes actual migration script via npx tsx; isolated PostgreSQL database (Docker localhost:5433); migration stdout/stderr captured; MSE-5 DB snapshots prove --verify-only non-destructive; MSE-2 idempotency verified (2 encrypted, then 0 encrypted/4 skipped) | ✅ TEST VERIFIED — `a81c2aa6` (evidence package commit); tested code at `ec928470` | `docs/audit/INT-M-03A_FINAL_EXECUTION_REPORT.md` | INT-M-03A |
| INT-M-03F | OAuth token not revoked on calendar disconnect | HIGH | CONFIRMED | VERIFIED — no revocation call in disconnect flow | `14628e9d` + `e4488298` (caller audit: enableSync required) | 18 INT-M-03F tests (T1–T11 + variants), exit 0 | ✅ FIX-VERIFIED — `e4488298` ✅ Vercel SUCCESS | `PHASE1_REMEDIATION_REGISTER.md` | INT-M-03F |

### 1.3 — P2 Medium Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| PAY-H-04 | SlotReservation concurrency — no unique constraint | MEDIUM | CONFIRMED | VERIFIED — no `@@unique([providerId, startTime])` | DESIGN AUTHORISED — all Q1-Q5 answered by prototype (2026-09-22): btree_gist not pre-installed (must CREATE EXTENSION); partial constraint rejected; all-rows GIST exclusion confirmed; Prisma error = PrismaClientUnknownRequestError code=none (match on 23P01 or constraint name); Option A required (expired rows block constraint, must delete before insert) | PENDING — PAY-H-04-C design doc + migration | ⚠️ OPEN — design authorised, fix not yet started | `docs/audit/PAY-H-04_INVESTIGATION.md` | PAY-H-04 |
| SUB-06-A | No tests for subscription event ordering | MEDIUM | CONFIRMED | VERIFIED — zero tests for updated→deleted | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | SUB-06-A |
| SUB-08-A | Seat limit not enforced in webhook | MEDIUM | CONFIRMED | VERIFIED — no seat count check before subscription.create | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | SUB-08-A |
| RBAC-M-02 | Admin routes use role check instead of permission check | MEDIUM | CONFIRMED | VERIFIED — `role === 'SUPER_ADMIN'` pattern found | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | RBAC-M-02 |
| DATA-EXP-01 | Public instructor phone exposed in API | MEDIUM | CONFIRMED | VERIFIED — `phone` in public projection | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | DATA-EXP-01 |
| DOC-EXP-01 | Expired provider can still receive bookings | MEDIUM | CONFIRMED | VERIFIED — no document expiry gate in booking creation | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | DOC-EXP-01 |
| AUDIT-01 | Audit logging fails open (swallows errors) | MEDIUM | CONFIRMED | VERIFIED — catch block uses console.error only | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | AUDIT-01 |
| AUDIT-02 | Audit log write not atomic with state change | MEDIUM | CONFIRMED | VERIFIED — separate writes confirmed | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | AUDIT-02 |
| AUDIT-05 | Audit coverage gaps (wallet, booking mutations) | MEDIUM | CONFIRMED | VERIFIED — no audit trail for wallet operations | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | AUDIT-05 |
| INT-M-01B | Stripe payment reconciliation (missed webhooks) | MEDIUM | CONFIRMED | VERIFIED — no payment reconciliation in cron | NOT-STARTED | PENDING | ⚠️ OPEN | `PHASE1_REMEDIATION_REGISTER.md` | INT-M-01B |
| F-08 | Admin refund maxRefundAmount not enforced | MEDIUM | CONFIRMED | VERIFIED — enforcement absent before fix | Fixed: checkPermission + limit check before Stripe call | Verified in source | ✅ CLOSED | `phase1/F-08_VERIFICATION.md` | F-08 |

### 1.4 — P3 Low Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|
| PAY-H-06 | Package expiry refund policy undocumented | LOW | CONFIRMED | VERIFIED — business policy, not bug | NOT-STARTED | N/A | ⚠️ OPEN | PAY-H-06 |
| AUDIT-03 | AuditLog deletable (no DB trigger) | LOW | CONFIRMED | VERIFIED — no immutability protection | NOT-STARTED | PENDING | ⚠️ OPEN | AUDIT-03 |
| AUDIT-04 | No audit log retention policy | LOW | CONFIRMED | UNVERIFIED | NOT-STARTED | PENDING | ⚠️ OPEN | AUDIT-04 |
| APP-H-04 | Role catalogue incomplete | LOW | ARCHITECTURAL | VERIFIED — documented gap | NOT-STARTED | N/A | ⚠️ OPEN | APP-H-04 |
| APP-H-05 | No centralised authorisation matrix | LOW | ARCHITECTURAL | VERIFIED — documented gap | NOT-STARTED | N/A | ⚠️ OPEN | APP-H-05 |
| APP-H-06 | DIRECT booking mode undocumented | LOW | ARCHITECTURAL | VERIFIED — feature exists without docs | NOT-STARTED | N/A | ⚠️ OPEN | APP-H-06 |
| APP-H-07 | Business template feature incomplete | LOW | ARCHITECTURAL | VERIFIED — feature incomplete | NOT-STARTED | N/A | ⚠️ OPEN | APP-H-07 |
| APP-H-08 | RBAC usage guide missing | LOW | ARCHITECTURAL | VERIFIED — onboarding gap | NOT-STARTED | N/A | ⚠️ OPEN | APP-H-08 |

### 1.5 — Deferred

| ID | Title | Risk | Finding | Status | Reason |
|---|---|---|---|---|---|
| AI-M-01 | AI prompt injection | MEDIUM | CONFIRMED | ⏸ DEFERRED | Awaiting AI architecture redesign |
| AI-M-02 | AI tool authorisation completeness | MEDIUM | CONFIRMED | ⏸ DEFERRED | Awaiting AI architecture redesign |

### 1.6 — Rejected / Verified Safe

| ID | Title | Finding | Reason |
|---|---|---|---|
| P0-02 | Client reschedule TOCTOU | REJECTED | Code has correct ownership check |
| P0-03 | Reviews authorisation missing | REJECTED | Ownership check present at line 207 |
| PAY-H-03 | Package hour credit race | REJECTED | Transaction-wrapped updateMany with status guard — safe |
| PAY-H-05 | Wallet-booking disconnect | REJECTED | Separate flows by design; balance checked atomically |
| AUTH-M-01 | Session fixation | REJECTED | NextAuth v4 regenerates tokens on auth |
| AUTH-M-02 | Token rotation | REJECTED | NextAuth v4 handles JWT rotation |
| RBAC-M-01 | Role escalation via API | REJECTED | No route allows self-role modification |
| APP-H-01/02/03 | Rate limiting gaps | REJECTED | Vercel Edge + Stripe built-in limits adequate |
| DATA-M-01/02/03 | Data over-projection | REJECTED | Projections verified appropriate |
| INT-M-01C | SMS delivery failure | REJECTED | Notification-only; fire-and-forget acceptable |
| INT-M-01D | Webhook retry behaviour | REJECTED | WebhookEvent idempotency key prevents duplicate processing |
| INT-M-02 | Email failure handling | REJECTED | Fire-and-forget; retry queue exists for critical emails |
| INT-M-03B/C/D/E | OAuth token sub-issues | REJECTED | Refresh, exposure, expiry, scope all verified safe |

---

## Section 2 — Phase 2: PAY-01 Payout Destination Ownership

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| PAY-01 | Provider payout destination ownership | HIGH | CONFIRMED | VERIFIED — `executePayout()` used DB-supplied `stripeAccountId` without Stripe-side check | `b9c2f0ff` — `verifyPayoutDestinationOwnership()` before `stripe.transfers.create()`; TOCTOU-safe `const verifiedAccountId` | 28 tests, exit 0 | ✅ CLOSED | `phase2/PAY-01-INVESTIGATION-STATUS.md` |

**PAY-01 sub-task evidence:**

| Sub-task | Purpose | Status | Evidence |
|---|---|---|---|
| PAY-01-A | Write-path audit — confirmed DB-write attack vector, no API path | ✅ CLOSED | `phase2/PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| PAY-01-B | Stripe metadata binding — `metadata.providerId` authoritative for this threat model | ✅ CLOSED | `phase2/PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| PAY-01-C | Reproduction + regression tests | ✅ CLOSED | `phase2/PAY-01-C-REPRODUCTION-TEST.md`; `payout-security.test.ts` 7/7; `pay-01-executePayout-security.test.ts` 5/5 |
| PAY-01-D | Post-fix state/retry/idempotency/ledger/alert/concurrency | ✅ CLOSED | `pay-01-d-state-consistency.test.ts` 16/16; exit 0 |

**Test files (all in `lib/services/__tests__/`):**
- `payout-security.test.ts` — 7 unit tests for helper
- `pay-01-executePayout-security.test.ts` — 5 service-level tests; critical: `transfers.create` NOT called on failure; TOCTOU assertion
- `pay-01-d-state-consistency.test.ts` — 16 tests: D1 state, D2 retry, D3 idempotency, D4 ledger, D5 alerts, D6 concurrency

**OPS-01 (operational note, not a finding):** `sendAlert()` in catch block is fire-and-forget. Payout correctly reaches FAILED state independently of alert delivery. Not a financial invariant issue.

---

## Section 3 — Phase 2: Money-Movement Inventory

Full inventory: `MONEY-MOVEMENT-INVENTORY.md`

### 3.1 — Controlled (no fix required)

| ID | Title | Risk | Status | Evidence |
|---|---|---|---|---|
| MM-01 | Provider payout (Stripe Connect) | NONE | ✅ CONTROLLED — PAY-01 closed | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-04 | Wallet top-up webhook confirmation | NONE | ✅ CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-08 | Subscription checkout | NONE | ✅ CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-11 | Stripe Connect account creation | NONE | ✅ CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-13 | Wallet-funded booking | NONE | ✅ CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-16 | Reconciliation cron (read-only) | NONE | ✅ CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |

### 3.2 — MM-10: SUPERSEDED (reclassified 2026-09-16)

| ID | Title | Status | Reason | Replaced-by |
|---|---|---|---|---|
| MM-10 | SaaS direct-to-provider payment (PAY-01 parallel) | **SUPERSEDED** | Original HIGH classification was incorrect. `saas-payment.ts` never reads `provider.stripeAccountId`; no `transfer_data.destination` in session params; money lands on platform account not provider. PAY-01 account-substitution attack class not applicable. | MM-10-A, MM-10-B, MM-10-C |

Sub-findings from reclassification:

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-10-A | SaaS provider routing absent — no `transfer_data.destination` | ARCHITECTURAL | **SUPERSEDED** | VERIFIED — `saas-payment.ts` confirmed: no `transfer_data` in `sessionParams`; money lands on platform. Original finding premise was incorrect: this is deliberate `PLATFORM` mode, not an accidentally omitted destination. | N/A | N/A | **SUPERSEDED — Accepted as intentional architecture; no remediation required.** `DIRECT` mode (provider Stripe account routing) is Phase 2, blocked by `assertPlatformPaymentMode()`. Product roadmap tracked in `docs/newplan/PAYMENT-WHITE-LABEL.md`. PAY-01 threat model does not apply. | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-10-B | Concurrent checkout session creation — double-charge | MEDIUM | CONFIRMED | VERIFIED — `Quote.stripeSessionId` write not conditional on null; no Stripe idempotency key; two concurrent accepts → two independently payable sessions | This commit — `Quote.checkoutGeneration Int @default(1)`; Stripe idempotency key `scs-{quoteId}-{generation}`; `advanceCheckoutGeneration()` CAS on (stripeSessionId, checkoutGeneration); `_createAndBindSession()` CAS write WHERE stripeSessionId IS NULL AND checkoutGeneration=N; loser reads winner session; expired→automatic generation advance; lookup error NOT treated as expiry; completed→QuoteAlreadyPaidError; accept route allows PENDING_PAYMENT re-entry | 13 MM-10-B tests (S1–S10), exit 0 — `mm-10b-checkout-session.test.ts` | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-10-C | `applicationFeeAmount` always zero — commission config defect | MEDIUM | CONFIRMED | VERIFIED — `commissionPercent` not a field on `BusinessConfig`; `assembleConfig()` never sets it; `?? 0` fallback makes fee zero | This commit — `commissionPercent: number` added to `BusinessConfig` interface; `assembleConfig()` maps `settings.commissionRate`; `saas-payment.ts` reads `businessConfig.commissionPercent` directly (no `as any`); all three templates updated | 13 MM-10-C tests (C1–C6 + data path), exit 0 — `mm-10c-commission-fee.test.ts` | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |

### 3.3 — MM-05: Refund Idempotency (5 confirmed sites)

Structural root weakness: no dedicated `Refund` entity. State scattered across `Booking.stripeRefundId`, `Booking.cancellationStatus`, `LedgerEntry`, `Transaction`. Fix must establish one authoritative refund lifecycle used by all entry points.

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-05-A | Concurrent admin refund race — `approveCancellation()` | HIGH | CONFIRMED | VERIFIED — `booking-service.ts` ~659: no idempotency key; `cancellationStatus` check not atomic with Stripe call (TOCTOU) | `dc13c7b0` — CAS `PENDING→APPROVING` via `updateMany`; idempotency key `approve-cancel-${bookingId}`; `APPROVING→PENDING` revert on error; `REFUND_ISSUED` written in tx | 7 MM-integrity tests, exit 0 | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-B | Lost-refund / no-retry gap — public cancel route | MEDIUM | CONFIRMED | VERIFIED — `public/bookings/[id]/cancel` ~250: atomic CAS exists (prevents double-cancel); Stripe call outside transaction; no idempotency key means no safe retry | `dc13c7b0` — idempotency key `cancel-refund-${id}` added to Stripe call | 5 MM-05-B tests (B1–B3), exit 0 — `mm-05b-cancel-route.test.ts` | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-C | Concurrent admin transaction refund | HIGH | CONFIRMED | VERIFIED — `admin/transactions/[id]/refund` ~99: no atomic gate, no idempotency key; `transaction.status` check not atomic with Stripe call | `dc13c7b0` + hardened in follow-up — CAS `COMPLETED→REFUNDING`; idempotency key `admin-refund-${transactionId}`; `REFUND_ISSUED` now atomic inside `prisma.$transaction` via `tx.ledgerEntry.create`; revert on error | 7 MM-integrity tests, exit 0 | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-D | No app-level guard on 3DS/prepaid auto-refund (Site A) | LOW | CONFIRMED | VERIFIED — `webhook/route.ts` ~392: no idempotency key, no `recordWebhookEvent()` call on this path | This commit (corrected) — `stripe.refunds.create()` with `idempotencyKey=checkout-refund-block-{sessionId}` called FIRST; `recordWebhookEvent()` written AFTER Stripe confirms; Stripe failure throws (no WebhookEvent written, retry safe) | 7 MM-05-D tests (D1–D6 incl. I1/I2 invariants), exit 0 — `mm-05d-webhook-3ds-refund.test.ts` | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-E | WebhookEvent rolls back on expired-booking refund (Site B) | LOW | **SUPERSEDED** | VERIFIED — original claim "Stripe retries indefinitely" does not match production code. See revised finding MM-05-E-R and secondary finding MM-05-E-S below. | N/A | N/A | **SUPERSEDED → MM-05-E-R** | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-E-R | Expired-booking path leaves no WebhookEvent row — audit/observability gap | LOW | CONFIRMED | VERIFIED (cfadf3c9) — see full execution trace and consumer audit in Section 5.1 | This commit — `recordWebhookEvent(tx, ...)` written inside SERIALIZABLE `$transaction` **after** Stripe refund confirms; DuplicateWebhookEventError only swallowed **after** booking state verified correct | 11 MM-05-E tests (E1–E8 incl. all INV), exit 0 — `mm-05e-expired-booking-refund.test.ts` | ✅ FIX-VERIFIED | this commit |
| MM-05-E-S | `tx.booking.update(CANCELLED)` rolls back with transaction — booking stays EXPIRED | LOW | CONFIRMED | VERIFIED (cfadf3c9) — `tx.booking.update` inside rolled-back tx; booking stays EXPIRED after entire path | This commit — `prisma.booking.updateMany WHERE status='EXPIRED'` with CAS semantics outside the inner tx (in post-refund SERIALIZABLE tx); count=0 triggers state-verification branch: idempotent / repair / integrity-error / unexpected-status | 11 MM-05-E tests (E4–E6 directly verify state-verification branch), exit 0 | ✅ FIX-VERIFIED | this commit |

### 3.4 — MM-06 / MM-07 / MM-12 / MM-14 / MM-15

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-06 | Duplicate-charge auto-refund — missing idempotency key | MEDIUM | **SUPERSEDED** | VERIFIED — alleged production call site does not constitute a distinct finding. Source-verified `handleBookingPaymentFailed` contains no `stripe.refunds.create()` call. The only 3DS/prepaid auto-refund path in the webhook route is already tracked and remediated under MM-05-D. Two attributions found in audit documents, both unsupported as distinct from MM-05-D: (1) `handleBookingPaymentFailed` attribution in MONEY-MOVEMENT-INVENTORY.md is not corroborated by source; (2) investigation doc explicitly identifies MM-06 as "Site A, 3DS/prepaid" which is MM-05-D's exact path. `grep refunds.create` over entire route confirms exactly two call sites, both now fixed. | Subsumed by MM-05-D (`7f839694`) | MM-05-D targeted evidence, 7/7 exit 0 | **SUPERSEDED → MM-05-D** | `phase2/MM10-MM05-INVESTIGATION.md` (historical); source grep this commit |
| MM-07 | Refund ledger reconciliation defect | MEDIUM | CONFIRMED | VERIFIED — Sites C/D/E write no `REFUND_ISSUED` ledger entry; `handleChargeRefunded()` sees `alreadyRecordedRefund=0` → writes duplicate `REFUND_SYNCED`; no wallet double-credit; ledger `totalRefunded` systematically over-counted | `dc13c7b0` — both `approveCancellation()` and admin transaction refund now write `REFUND_ISSUED` atomically; `handleChargeRefunded()` guard already queries this type | 7 MM-integrity tests (T1/T3 directly verify guard), exit 0 | ✅ FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-09 | Subscription cancellation — no internal ownership guard | LOW | CONFIRMED | VERIFIED — `subscription-cancel.ts` takes `stripeSubId` from caller with no internal check | NOT-STARTED | PENDING | ⚠️ OPEN | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-12 | Admin wallet credit/debit — no idempotency | MEDIUM | CONFIRMED | VERIFIED — `add-credit/route.ts` no duplicate-submit protection | `638888f0` — `AdminWalletIdempotencyKey` table; claim-first `INSERT ON CONFLICT` inside `prisma.$transaction`; `SELECT FOR UPDATE` on deduction path | 10 MM-12-E HTTP tests (E1–E6 + E1-seq), exit 0 — `mm-12e-admin-wallet-idempotency-verification.test.ts` (2026-09-22) | ✅ READY FOR PRODUCTION VERIFICATION | `docs/audit/MM-12-E_EXECUTION_LOG.txt` |
| MM-14 | Dispute handling — `charge.refunded` double-count after lost dispute | MEDIUM | CONFIRMED | VERIFIED — `handleChargeRefunded()` type guard only checks `REFUND_ISSUED`/`REFUND_SYNCED`; `DISPUTE_LOST` entries not included; Stripe fires `charge.refunded` automatically after a lost chargeback; results in spurious `REFUND_SYNCED` written on top of existing `DISPUTE_LOST` | `dc13c7b0` — `DISPUTE_LOST` added to `type: { in: [...] }` filter in `handleChargeRefunded()` | 7 MM-integrity tests (T2 directly verifies DISPUTE_LOST guard), exit 0 | ✅ FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |
| MM-15-A | Late `transfer.failed` reverses a successfully-retried payout | MEDIUM | CONFIRMED | VERIFIED — `payout.updateMany WHERE status='PAID'` does NOT filter on `stripeTransferId`; late event for original failed transfer matches payout re-PAID via retry; reversal incorrectly applied to completed payout | `dc13c7b0` — `stripeTransferId: transferId` added to `payout.updateMany` WHERE clause in `handleTransferFailed()` | 7 MM-integrity tests (T4/T5 directly verify transferId guard), exit 0 | ✅ FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |
| MM-15-B | `handleTransferFailed()` non-atomic: idempotency key consumed before financial reversal | MEDIUM | CONFIRMED | VERIFIED — `recordWebhookEvent(prisma, ...)` called outside `$transaction`; if `appendLedgerEntry`/`incrementLedger` fail after webhook record is committed, idempotency key prevents retry but reversal never completes | `dc13c7b0` — `recordWebhookEvent(tx, ...)` now inside `withSerializableRetry(prisma.$transaction(...))` atomically with payout reversal and ledger ops | 7 MM-integrity tests (T6/T7 directly verify atomicity and concurrency), exit 0 | ✅ FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |

### 3.5 — Dead Code

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status |
|---|---|---|---|---|---|---|---|
| MM-02 | `StripeService.createPayout()` — unguarded, zero callers | MEDIUM | CONFIRMED | VERIFIED — grep confirms 0 callers; method has no ownership check, no idempotency, no ledger | Deleted from `lib/services/stripe.ts` | Post-deletion grep: 0 source references; TS build: 0 new errors | ✅ CLOSED |
| MM-17 | Same as MM-02 (duplicate inventory entry) | — | SUPERSEDED | — | — | — | SUPERSEDED → MM-02 |

### 3.6 — Minor Open

| ID | Title | Risk | Finding | Status |
|---|---|---|---|---|
| MM-03 | Customer payment intent — wallet top-up amount bounds | LOW | CONFIRMED | ⚠️ OPEN |

---

## Section 4 — Current Priority Queue

> Ordered by confirmed severity and P0/P1/P2 classification.  
> **No finding may enter FIX stage without VERIFIED status.**

### P0 — Fix before next release (all VERIFIED, awaiting fix)

> All P0 items have been fixed in `dc13c7b0`. Status updated below.

| # | ID | Title | Key risk | Status |
|---|---|---|---|---|
| 1 | MM-07 | Refund ledger reconciliation defect | Ledger `totalRefunded` over-counted on every admin cancellation | ✅ FIXED `dc13c7b0` |
| 2 | MM-05-A | Concurrent admin refund race in `approveCancellation()` | Two admins can double-refund same booking | ✅ FIXED `dc13c7b0` |
| 3 | MM-05-C | Concurrent admin transaction refund | Fully unprotected — no gate, no key | ✅ FIXED `dc13c7b0` + REFUND_ISSUED atomicity hardened in follow-up |
| 4 | MM-05-B | Lost-refund gap on public cancel route | Stripe failure after DB commit leaves booking cancelled but no refund issued | ✅ FIXED `dc13c7b0` (idempotency key added) — targeted test pending |

### P1 — Next sprint (all VERIFIED, awaiting fix)

| # | ID | Title | Status |
|---|---|---|---|
| 5 | MM-10-B | Concurrent checkout session creation — double-charge | ✅ FIXED this commit |
| 6 | MM-10-C | `applicationFeeAmount` always zero | ✅ FIXED this commit |
| 7 | MM-10-A | SaaS provider routing absent — no `transfer_data.destination` | SUPERSEDED — accepted as intentional PLATFORM-mode architecture |
| 8 | MM-05-D | 3DS/prepaid auto-refund idempotency key + `recordWebhookEvent()` | ✅ FIXED this commit |
| 9 | MM-05-E | Fix WebhookEvent rollback in expired-booking path | SUPERSEDED → MM-05-E-R (observability gap, FIX DECISION PENDING) |
| 10 | MM-15-A | Late `transfer.failed` reverses retried payout | ✅ FIXED `dc13c7b0` |
| 11 | MM-15-B | `handleTransferFailed()` non-atomic | ✅ FIXED `dc13c7b0` |
| 12 | PAY-H-01 / INT-M-01A | Stripe refund reconciliation cron | ✅ FIXED this commit (Path B + Check 5) |
| 13 | PAY-H-02 | Booking reschedule price recalculation | ✅ FIXED this commit |
| 14 | MM-14 | `charge.refunded` double-count after lost dispute | ✅ FIXED `dc13c7b0` |

### P2 — Follow-up

| # | ID | Title |
|---|---|---|
| 14 | MM-12 | Admin wallet credit idempotency | ✅ FIX-VERIFIED `638888f0` — READY FOR PRODUCTION VERIFICATION |
| 15 | MM-02 | Delete `StripeService.createPayout()` | ✅ CLOSED — deleted, 0 source references post-deletion |
| 16 | INT-M-03A | Encrypt OAuth tokens at rest |
| 17 | INT-M-03F | Revoke OAuth token on calendar disconnect |
| 18 | PAY-H-04 | SlotReservation unique constraint |
| 19 | DOC-EXP-01 | Block bookings with expired provider documents |
| 20 | DATA-EXP-01 | Remove phone from public instructor API |
| 21 | AUDIT-01/02/05 | Audit logging hardening |
| 22 | RBAC-M-02 | Replace role checks with permission checks in admin routes |

---

## Section 5 — Reconciliation Summary

### Findings with missing lifecycle evidence

| ID | Gap | Action required |
|---|---|---|
| MM-05-B | Fix present in `dc13c7b0`; targeted test added in follow-up commit | ✅ RESOLVED — `mm-05b-cancel-route.test.ts` 5/5 exit 0 |
| MM-05-D | Finding CONFIRMED, Verification VERIFIED — fix NOT-STARTED | ✅ RESOLVED — fixed this commit; `mm-05d-webhook-3ds-refund.test.ts` 7/7 exit 0 |
| MM-05-E | Finding CONFIRMED, Verification VERIFIED — fix NOT-STARTED | ✅ SUPERSEDED — original "Stripe retries indefinitely" claim refuted; revised as MM-05-E-R/MM-05-E-S; FIX DECISION PENDING |
| MM-05-E-R | New finding — no WebhookEvent row on expired-booking path | ✅ FIX-VERIFIED this commit — 11 tests E1–E8 exit 0 |
| MM-05-E-S | New finding — booking.status stays EXPIRED (not CANCELLED) after expired-booking path | ✅ FIX-VERIFIED this commit — 11 tests E1–E8 exit 0 |
| AUDIT-04 | Finding CONFIRMED but Verification UNVERIFIED | Read retention policy (or absence of one) before advancing |
| PAY-H-01 | Finding CONFIRMED, Verification VERIFIED — fix complete this commit | ✅ FIX-VERIFIED — Path B + Check 5; 15 tests exit 0 |
| PAY-H-02 | Finding CONFIRMED, Verification VERIFIED — fix complete `a2fa69fc` | ✅ FIX-VERIFIED — 35 tests exit 0; Vercel SUCCESS `a2fa69fc`. **Open note:** `Transaction.updateMany` logs a warning if count > 1 eligible BOOKING_PAYMENT row exists but does not treat it as an error. Transaction multiplicity is not independently proven to be impossible. Until the invariant is directly verified (e.g., via isolated-Postgres test), treat count > 1 as a gap to watch. |

**Resolved discrepancies (previously listed here):**

| ID | Previous gap | Resolution |
|---|---|---|
| MM-14 | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T2 |
| MM-15-A | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T4/T5 |
| MM-15-B | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T6/T7 |
| MM-05-A | Fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T1/T3 |
| MM-05-C | Fix not started; REFUND_ISSUED was non-fatal try/catch | Fixed in `dc13c7b0`; REFUND_ISSUED atomicity hardened post-commit (`tx.ledgerEntry.create` inside `prisma.$transaction`) |
| MM-07 | Fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T1/T3 |

### Findings with no targeted tests (closure not yet possible)

All OPEN findings have no targeted tests by definition — tests are part of FIX-VERIFIED stage.  
The following CLOSED findings have tests recorded:

| ID | Tests | Exit code | Commit |
|---|---|---|---|
| P0-01A | 12 (ownership + concurrent) | 0 | `b9c2f0ff` |
| P0-01B | 12 (ownership + concurrent) | 0 | `b9c2f0ff` |
| PAY-01 | 28 (7 unit + 5 service + 16 state) | 0 | `b9c2f0ff` |
| MM-05-A / MM-05-C / MM-07 / MM-14 / MM-15-A / MM-15-B | 7 (T1–T7 cross-path invariants in `mm-financial-integrity.test.ts`) | 0 | `dc13c7b0` (fix) + local hardening of MM-05-C |
| MM-05-B | 5 (B1–B3 idempotency/CAS/non-fatal in `mm-05b-cancel-route.test.ts`) | 0 | follow-up to `dc13c7b0` |
| MM-05-D | 7 (D1–D6 ordering/key/I1/I2/concurrent in `mm-05d-webhook-3ds-refund.test.ts`) | 0 | this commit (corrected) |
| MM-12 | 10 HTTP integration tests (E1–E6 + E1-seq in `mm-12e-admin-wallet-idempotency-verification.test.ts`) — real Next.js server, isolated PostgreSQL, real NextAuth session | 0 | `638888f0` (fix) + `788503b1` (evidence) |
| MM-10-B | 13 (S1–S10 + 2 advanceCheckoutGeneration unit tests in `mm-10b-checkout-session.test.ts`) | 0 | `6e3211c2` |
| MM-10-C | 13 (C1–C6 + data path in `mm-10c-commission-fee.test.ts`) | 0 | `9fd2893d` | `899929c4` ✅ Vercel SUCCESS |
| PAY-H-01 / INT-M-01A | 15 (PH-1–PH-10 + edge cases in `pay-h01-refund-reconciliation.test.ts`) | 0 | `71dc11ad` | `899929c4` ✅ Vercel SUCCESS |
| PAY-H-02 | 35 (F1–F9 pure + R1–R26 service in `pay-h02-reschedule-financials.test.ts`) | 0 | `a2fa69fc` | `a2fa69fc` ✅ Vercel SUCCESS |
| INT-M-03F | 18 (T1–T11 + variants in `int-m03f-oauth-revocation.test.ts`) | 0 | `14628e9d` + caller audit `e4488298` | `e4488298` ✅ Vercel SUCCESS |

All other CLOSED Phase 1 findings were closed by source verification without dedicated targeted tests. This is an acknowledged gap from Phase 1 methodology — fixing it is out of scope while open P0 items exist.

**Vercel deployment evidence:**

| Finding(s) | Fix commit | Vercel deployment commit | Vercel status |
|---|---|---|---|
| MM-10-B | `6e3211c2` | `6e3211c2` | ✅ SUCCESS (confirmed by independent review) |
| MM-10-C | `9fd2893d` | `899929c4` (TS fix: missing constructors) | ✅ SUCCESS — confirmed `899929c4` |
| PAY-H-01 / INT-M-01A | `71dc11ad` | `899929c4` (TS fix) | ✅ SUCCESS — confirmed `899929c4` |
| MM-05-D / MM-05-E-R/S / MM-05-A–C / MM-07 / MM-14 / MM-15 | various | — | ⏳ Pending isolated-Postgres direct-path execution |

---

## Section 5.1 — MM-05-E Investigation Evidence (this commit)

### Production execution trace — expired-booking webhook path

**File:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleBookingPaymentSuccess()` lines ~927–1190  
**Trigger:** Stripe delivers `payment_intent.succeeded` for a booking whose slot expired before Stripe confirmed payment.

```
withSerializableRetry(() =>
  prisma.$transaction(async (tx) => {           ← SERIALIZABLE transaction opens
    [L963] recordWebhookEvent(tx, ...)           ← INSERT WebhookEvent (uses tx)
    [L971] booking = tx.booking.findUnique(...)
    [L986] booking.status === 'EXPIRED':
      [L990]  tx.booking.update(EXPIRED→CANCELLED)  ← UPDATE booking (uses tx)
      [L998]  throw new ExpiredBookingError(...)     ← ROLLS BACK entire tx
  })                                            ← WebhookEvent INSERT rolled back
)                                               ← booking stays EXPIRED (update rolled back too)
                                                ← comment "mark as CANCELLED INSIDE tx" is incorrect
↓ ExpiredBookingError propagates out of withSerializableRetry
↓
catch (err) at line ~1133:
  [L1137] stripe.refunds.create({              ← OUTSIDE transaction
            idempotencyKey: `expired-booking-refund-${bookingId}-${paymentIntentId}`
          })
  → success: sendAlert (fire-and-forget), return
  → failure: throw → outer handler returns HTTP 500 → Stripe retries
↓
handleBookingPaymentSuccess() returns normally
↓
Top-level POST handler: return NextResponse.json({ received: true }) → HTTP 200
```

**HTTP status returned on each path:**

| Path | HTTP status | Stripe retries? |
|---|---|---|
| Normal (refund succeeds) | 200 | No |
| Refund fails transiently | 500 | Yes |
| Duplicate delivery (DuplicateWebhookEventError) | 200 | No — but this path is NOT reachable for expired-booking since no WebhookEvent row was ever written |

**On Stripe retry (refund previously failed):**
- `recordWebhookEvent(tx, ...)` attempts INSERT again — succeeds (no prior row, it was rolled back)
- Booking still `EXPIRED` — `ExpiredBookingError` thrown again
- Transaction rolls back again — WebhookEvent INSERT rolled back again
- `stripe.refunds.create()` called again with same deterministic idempotency key
- Stripe returns existing refund object (no new charge)
- Handler returns 200

**Stripe idempotency key:** `` `expired-booking-refund-${bookingId}-${paymentIntentId}` ``  
Deterministic per (booking, paymentIntent) pair. Stable across retries. Verified at line ~1137.

### Secondary finding MM-05-E-S

The comment at line ~990 says "Mark booking as cancelled INSIDE transaction", and `tx.booking.update(status → CANCELLED)` executes. But `throw new ExpiredBookingError()` immediately after causes the transaction to roll back entirely — **including the booking update**. The booking's status remains `EXPIRED` after the entire path completes, not `CANCELLED`. The comment is wrong; the intent is not achieved.

**Observable consequence:** The booking record in the DB provides no evidence that the expired-payment event was received and the refund was issued. The only durable side effects are:
- The Stripe refund (confirmed by Stripe's API)
- The `sendAlert()` calls (fire-and-forget, non-durable)
- The logger output (non-durable)

### WebhookEvent consumer audit — complete

**Files inspected:**
- `app/api/stripe/webhook/route.ts` — all `recordWebhookEvent` calls and `WebhookEvent` writes
- `app/admin/audit-log/page.tsx` + `app/api/admin/audit-log/route.ts` — admin UI
- `app/api/cron/reconcile-stripe/route.ts` — daily Stripe reconciliation
- `app/api/cron/reconciliation/route.ts` + `lib/cron/daily-reconciliation.ts` — financial reconciliation
- All 15 other cron routes — confirmed none read `WebhookEvent`
- `monitor-production-sub22.sql` — manual monitoring SQL
- `prisma/schema.prisma` — `WebhookEvent` model definition

**Consumer audit results:**

| Consumer | Reads WebhookEvent? | Impact if expired-booking row absent |
|---|---|---|
| Admin audit-log UI (`/admin/audit-log`) | No — reads `AuditLog` table | **None** |
| Reconcile-Stripe cron | No — uses Stripe API + `LedgerEntry`/`FinancialLedger` | **None** |
| Daily reconciliation cron | No — uses Stripe API + `Transaction`/`WalletTransaction` | **None** |
| `monitor-production-sub22.sql` (manual ops tool) | Yes — 6 SELECT queries | **Degraded visibility** — monitoring query shows no evidence expired-booking path ran; false-clean for this event type |
| Duplicate suppression | No pre-check — relies on DB unique constraint only | **Correct behaviour** — no row means retry can re-enter, Stripe idempotency key prevents duplicate refund |
| Test suite | Only in test teardown (`sub-22-concurrent.test.ts`) | Not a production concern |
| Recovery tooling | None found | **None** |
| Compliance/reporting | None found | **None** |

**`WebhookEvent` schema — confirmed no status/state field:**
```
id             String   @id @default(cuid())
idempotencyKey String   @unique
eventType      String
stripeEventId  String
metadata       Json?
processedAt    DateTime @default(now())
```
No `status`, `retriedAt`, `refundId`, or `retriable` field. Absence of a row is indistinguishable from "event never received".

### FIX DECISION REQUIRED

**Question for decision:** Is the degraded visibility in `monitor-production-sub22.sql` and the absence of a durable booking-status update (`CANCELLED` intent not achieved) sufficient reason to implement a fix?

**Options:**
1. **Accept as LOW / observability gap** — financial invariant is intact (Stripe idempotency key), no reconciliation or compliance consumer is affected. Add a `sendAlert` call with structured metadata as a lightweight compensating control.
2. **Fix** — write `recordWebhookEvent` and `booking.update(CANCELLED)` **outside** the transaction (after the refund succeeds at line ~1137), similar to the MM-05-D pattern. This would produce a permanent audit trail and correct the booking status.
3. **Supersede with new finding** — create MM-05-E-R as the authoritative finding, reclassify as LOW observability/correctness gap, and schedule the fix in a future sprint alongside audit hardening work (AUDIT-01/02).

**Do not implement a fix until a decision is made.**

---

### MM-10-A — Superseded; accepted as intentional architecture

**Evidence:** `lib/services/saas-payment.ts` (no `transfer_data` in `sessionParams`); `.kiro/steering/platform-model.md` (explicitly documents `PLATFORM` mode as default; `DIRECT` mode as Phase 2, runtime-blocked); `docs/newplan/PAYMENT-WHITE-LABEL.md` (lists every incomplete DIRECT-mode component as product roadmap).

**Rationale:** The original finding assumed `transfer_data.destination` was accidentally omitted. Investigation established it is deliberately absent. `PLATFORM` mode — where customer payments land on DriveBook's Stripe account and instructors are paid via weekly payout — is the single active production mode. `DIRECT` mode is implemented behind a hard 503 runtime guard and is not a currently active code path. The PAY-01 account-substitution threat model (attackers substituting `Provider.stripeAccountId` to redirect funds) does not apply to `saas-payment.ts` because `createCheckoutSession()` never reads that field.

**Remaining work:** All incomplete DIRECT-mode components (webhook DIRECT branch, admin activation UI, Connect onboarding gate, PREMIUM enforcement, refund handling, 503 guard removal) are product roadmap items tracked in `docs/newplan/PAYMENT-WHITE-LABEL.md`. They do not constitute audit remediation items.



Both findings are FIX-VERIFIED based on extracted-logic tests. Direct production-path verification requires `SUB22_TEST_DATABASE_URL` pointing to an isolated Postgres — not available in this environment.

**Infrastructure created this commit** (two new test files in `app/api/stripe/webhook/__tests__/`):

| File | Tests | Status |
|---|---|---|
| `mm-05d-direct-handler.test.ts` | D-P1–D-P6: prepaid/3DS-failed/Stripe-fail/duplicate/concurrent/non-blocked via real `POST` | ⏳ PENDING EXECUTION — requires isolated Postgres |
| `mm-05e-direct-handler.test.ts` | E-P1–E-P7: EXPIRED→CANCELLED/Stripe-fail/repair/duplicate/null-refundId/concurrent/CONFIRMED via real `POST` | ⏳ PENDING EXECUTION — requires isolated Postgres |

Both files use the real exported `POST` handler, real Stripe signature verification, real Prisma against the isolated DB, and mock only `stripe.refunds.create` + non-critical side-effect services. Skip guards throw `[MM-05-D SKIP]` / `[MM-05-E-R/S SKIP]` when `SUB22_TEST_DATABASE_URL` is absent.

**To advance MM-05-D and MM-05-E-R/S to CLOSED:**
1. Provision an isolated Postgres DB (not Supabase production).
2. Set `SUB22_TEST_DATABASE_URL=<isolated-url>` and `STRIPE_WEBHOOK_SECRET=<any-string>`.
3. Run both test files; record exit codes.
4. Update this tracker with the exit codes and advance status to CLOSED.

## Section 6 — Document Map

| Document | Role | Status |
|---|---|---|
| `AUDIT-MASTER-TRACKER.md` | **Authoritative lifecycle state machine** | Active — this file |
| `AUDIT-PROCESS.md` | Lifecycle rules and Kiro enforcement | Active |
| `MONEY-MOVEMENT-INVENTORY.md` | 17-path inventory (input to tracker) | Active — read-only reference |
| `PHASE1_REMEDIATION_REGISTER.md` | Frozen Phase 1 baseline (56 findings) | Read-only — do not edit |
| `PHASE1_COVERAGE_MAP.md` | 20-area coverage reconciliation | Read-only |
| `COMPLETE_AUDIT_VERIFICATION.md` | Source-level verification record | Read-only |
| `SECURITY_FINDINGS_TRACKER.md` | Old tracker — superseded by this file | **Read-only — do not update** |
| `VERIFICATION_FRAMEWORK.md` | Old verification methodology | Read-only reference |
| `VERIFICATION_OUTCOMES.md` | Old outcomes record | Read-only reference |
| `phase1/*.md` | Phase 1 evidence records (P0-01, SUB-*, C-1, F-*, AREA*) | Read-only evidence |
| `phase2/*.md` | Phase 2 evidence records (PAY-01, MM-10, MM-05) | Read-only evidence |
| `archive/*.md` | Historical session logs | Read-only |
