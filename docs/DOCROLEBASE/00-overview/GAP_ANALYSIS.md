# Gap Analysis — Documentation vs Reality

**Inspection date:** March 2026  
**Method:** Direct code read of all critical paths vs documentation claims  
**Scope:** Booking flow, payment flow, payout flow, cancellation, reconciliation, ABN, state machines, schema

Each gap is classified:

- `DOC_WRONG` — documentation says X, code does Y
- `DOC_MISSING` — code does something not documented anywhere
- `CODE_MISSING` — documentation describes something not yet implemented in code
- `SCHEMA_GAP` — Prisma schema does not match what code or docs claim
- `KNOWN_GAP` — already noted in CONTROL_GUARANTEES.md, listed here for completeness

---

## 1. Booking Creation Flow

### 1.1 DOC_WRONG — Booking does not start as PENDING_PAYMENT

**Docs say:** `POST /api/bookings → Booking created (PENDING_PAYMENT)`  
**Code does:** `app/api/bookings/route.ts` creates the booking with `status: 'CONFIRMED'` directly, inside the same atomic transaction that debits the wallet. There is no `PENDING_PAYMENT` state for instructor-created wallet bookings.

`PENDING_PAYMENT` only exists for Stripe payment flow (public booking via `/book/[instructorId]`). The instructor-created booking path skips it entirely.

**Impact:** `STATE_MACHINES.md` and `SYSTEM_FLOWS.md` flow 1 are wrong for the instructor booking path.

---

### 1.2 ~~DOC_WRONG~~ RESOLVED — Commission rate now dynamic from PlatformSettings

**Was:** Both booking routes hardcoded `commissionRate: 0.15` (15%) regardless of instructor tier.  
**Fixed (March 2026):** Both `app/api/bookings/route.ts` and `app/api/admin/bookings/route.ts` now call `getCommissionRate(instructor.subscriptionTier)` from `lib/services/platform-pricing.ts`. PRO = 12%, BUSINESS = 10%, BASIC = 15% (DB-configurable).

---

### 1.3 DOC_MISSING — Wallet balance check uses two different methods

**Docs say:** Wallet balance is `ClientWallet.balance`  
**Code does:** `app/api/bookings/route.ts` uses `getWalletBalance(client.userId)` which recomputes balance from `WalletTransaction` sum (not the stored `balance` field). Then inside the `$transaction`, it re-checks by summing `WalletTransaction` again.

`app/api/admin/bookings/route.ts` uses `wallet.balance` (stored field) directly.

**Impact:** Two different sources of truth for wallet balance depending on who creates the booking. The instructor path is more correct (transaction sum) but slower. The admin path uses the stored field. Neither is documented.

---

### 1.4 DOC_MISSING — No AuditLog entry on booking creation

**Docs say:** `AuditLog entries created: BOOKING_CREATED, BOOKING_CONFIRMED...`  
**Code does:** `app/api/bookings/route.ts` creates no `AuditLog` entry on booking creation. The cancel route does log via `logBookingAction`. The admin bookings PATCH does not log.

**Impact:** `SYSTEM_FLOWS.md` flow 1 lists `BOOKING_CREATED` as an audit event — it does not exist in the instructor booking path.

---

### 1.5 DOC_MISSING — Booking creation is instructor-only (not client-initiated)

**Docs say:** "Client creates booking"  
**Code does:** `POST /api/bookings` requires `session.user.instructorId` — only instructors can call this endpoint. Clients cannot create bookings directly. The public booking flow (`/book/[instructorId]`) goes through a different path (Stripe payment intent → webhook).

**Impact:** `SYSTEM_FLOWS.md` flow 1 step 1 is misleading. There are actually two separate booking creation paths that are not distinguished in the docs.

---

## 2. Payment Flow

### 2.1 DOC_WRONG — Webhook sets transaction to SETTLED, not COMPLETED

**Docs say:** `Transaction created (BOOKING_PAYMENT, COMPLETED)`  
**Code does:** `app/api/stripe/webhook/route.ts` `handleBookingPaymentSuccess` calls `transaction.updateMany` with `status: 'SETTLED'` (not COMPLETED). The transaction is created elsewhere (likely in the public booking route) and the webhook updates it to SETTLED.

**Impact:** `SYSTEM_FLOWS.md` flow 1 and `STATE_MACHINES.md` transaction states are wrong. `COMPLETED` is not a real transaction status in the payout flow — `SETTLED` is what makes a transaction payout-eligible.

---

### 2.2 DOC_MISSING — Webhook handles EXPIRED booking revival

**Code does:** If a booking is in `EXPIRED` status when `payment_intent.succeeded` fires, the webhook revives it to `CONFIRMED`. This is a critical edge case (race between slot expiry cron and payment capture).  
**Docs say:** Nothing about this. `FAILURE_HANDLING.md` mentions "Booking stays in PENDING_PAYMENT" but not the EXPIRED revival path.

---

### 2.3 DOC_MISSING — Package payment creates wallet CREDIT + DEBIT in webhook

**Code does:** For package bookings, the webhook creates a wallet CREDIT for the full package amount and a DEBIT for the first lesson. This is the mechanism by which remaining package credits become available.  
**Docs say:** Nothing about this in `SYSTEM_FLOWS.md` or `FINANCIAL_DOCTRINE.md`.

---

### 2.4 DOC_MISSING — Ledger update is non-critical and outside the transaction

**Code does:** `recordPaymentCollected()` is called after the main `$transaction` block, wrapped in try/catch. If it fails, the booking is still confirmed but the ledger is not updated.

**Mitigation (March 2026):** Failure now logs `🚨 LEDGER UPDATE FAILED` with the bookingId — immediately visible in Vercel logs. The daily reconciliation cron (`/api/cron/reconcile-stripe`) detects missing `LedgerEntry(PAYMENT_COLLECTED)` records and flags them for admin review.

**Remaining risk:** The ledger can still silently miss a payment if `recordPaymentCollected` throws. A full fix would require refactoring `appendLedgerEntry` and `incrementLedger` to accept a Prisma transaction client (`tx`) so they can run inside the main `$transaction`. Deferred — reconciliation cron provides the safety net.

---

## 3. Cancellation Flow

### 3.1 DOC_WRONG — Transaction is set to CANCELLED, not REFUNDED

**Docs say:** `Transaction → REFUNDED`  
**Code does:** `app/api/bookings/[id]/cancel/route.ts` calls `transaction.updateMany` with `status: 'CANCELLED'`. The wallet is credited separately. There is no `REFUNDED` transaction status used here.

**Impact:** `STATE_MACHINES.md` transaction states show `COMPLETED → REFUNDED`. The actual path is `SETTLED → CANCELLED`.

---

### 3.2 DOC_MISSING — Refund uses originalStartTime anti-exploit logic

**Code does:** Refund policy is applied to `min(originalStartTime, currentStartTime)` to prevent the exploit: book far future → reschedule close → cancel for full refund.  
**Docs say:** `FINANCIAL_DOCTRINE.md` and `SYSTEM_FLOWS.md` describe refund tiers but do not mention this anti-exploit mechanism.

---

### 3.3 ~~DOC_MISSING~~ RESOLVED — Cancellation is now a single atomic transaction

**Was:** Wallet credit ran in one `$transaction`, booking/transaction status update ran in a second separate one. If the second failed, wallet was over-credited.

**Fixed (March 2026):** `app/api/bookings/[id]/cancel/route.ts` created (was missing — directory existed but file did not, causing every cancel button to 404). The new route wraps wallet credit + booking update + transaction update in a single `prisma.$transaction`. Also adds AuditLog on every cancellation, proper auth check, and anti-exploit refund policy.

---

## 4. Admin Booking Actions

### 4.1 DOC_WRONG — Admin marks COMPLETED via PATCH, not a dedicated endpoint

**Docs say:** `POST /api/admin/bookings → status: COMPLETED`  
**Code does:** `PATCH /api/admin/bookings` with `{ bookingId, status }`. The method is PATCH, not POST.

---

### 4.2 ~~DOC_MISSING~~ RESOLVED — AuditLog now created on admin booking status changes

**Fixed (March 2026):** `PATCH /api/admin/bookings` now creates an `AuditLog` entry for every status change — `BOOKING_COMPLETED`, `BOOKING_NO_SHOW`, `BOOKING_CANCELLED` — with the admin's ID and `noShowParty` if applicable.

---

### 4.3 ~~DOC_MISSING~~ RESOLVED — No-show party now stored in proper field

**Was:** No-show party was recorded by prepending `[CLIENT_NO_SHOW]`, `[INSTRUCTOR_NO_SHOW]`, or `[DISPUTED]` to the transaction `description` field. Dispute detection in payouts used `description CONTAINS 'dispute'` — fragile text match.

**Fixed (March 2026):**
- `noShowParty String?` field added to `Booking` model in schema
- `PATCH /api/admin/bookings` now writes `booking.noShowParty = 'instructor' | 'client' | 'both'`
- Description tag kept for backward compat with existing records
- Payouts dispute query now uses `booking.noShowParty = 'both'` instead of description string match
- `parseNoShowParty()` in admin payouts page prefers the proper field, falls back to description for legacy records

---

## 5. Payout Flow

### 5.1 ~~SCHEMA_GAP~~ RESOLVED — Prisma client regenerated (March 2026)

**Was:** `payout-service.ts` had 15+ TypeScript errors because `prisma generate` had not been run after `Payout`, `PayoutTransaction`, `LedgerEntry`, `PlatformLedger`, `WebhookEvent`, `ReconciliationReport` models were added to `schema.prisma`.

**Fixed:** `prisma generate` run — all models now present in generated client at `node_modules/.prisma/client/index.d.ts`. Verified: `prisma.payout`, `prisma.payoutTransaction`, `Instructor.withholdingTaxRate`, `Instructor.gstRegistered`, `Instructor.payoutMethod` all resolve correctly.

**Note:** TS language server may show stale errors until restarted — the generated client is correct. Runtime is unaffected.

---

### 5.2 DOC_WRONG — Payout eligibility requires SETTLED status, not COMPLETED

**Docs say:** `FINANCIAL_DOCTRINE.md` — "Transaction status = COMPLETED" for payout eligibility  
**Code does:** `GET /api/admin/payouts/route.ts` and `buildPayout` both query `status: 'SETTLED'`. `COMPLETED` is not a payout-eligible status.

---

### 5.3 DOC_MISSING — ABN gate only blocks if ABN is present but unverified

**Code does:** `POST /api/admin/payouts/process` — payout is blocked only if `instructor.abn && !instructor.abnVerified`. If the instructor has no ABN at all, payout proceeds with 47% withholding.  
**Docs say:** `INSTRUCTOR_APPROVALS.md` says "verified ABN → 0%, unverified or no ABN → 47%". The gate behavior (block vs proceed with withholding) is not documented.

---

### 5.4 DOC_MISSING — Reconciliation stuck threshold is 10 minutes, not 24 hours

**Docs say:** `FAILURE_HANDLING.md` — "Payouts stuck in PROCESSING for >24h"  
**Code does:** `reconcile-stripe/route.ts` — `STUCK_THRESHOLD_MINUTES = 10`. Payouts stuck for >10 minutes are flagged.

---

### 5.5 DOC_MISSING — Reconciliation check 1 matches on LedgerEntry, not Transaction

**Docs say:** `SYSTEM_FLOWS.md` flow 5 — "Check 1: Completed bookings with no transaction record"  
**Code does:** Check 1 looks for Stripe `payment_intent.succeeded` events with no corresponding `LedgerEntry(PAYMENT_COLLECTED)`. It does not check for missing `Transaction` records.

---

## 6. ABN Flow

### 6.1 DOC_WRONG — recheck-abn is weekly, not daily

**Docs say:** `INSTRUCTOR_APPROVALS.md` — "Daily cron (GET /api/cron/recheck-abn)"  
**Code does:** The cron comment says "weekly" and the `vercel.json` schedule should be checked. The code itself does not enforce frequency — it runs whenever triggered.

---

### 6.2 DOC_MISSING — recheck-abn skips if ABR_GUID not configured

**Code does:** Returns `{ skipped: true, reason: 'ABR_GUID not configured' }` if `ABR_GUID` env var is empty.  
**Docs say:** Nothing about this skip condition. Given ABR_GUID is still pending (ref: ABNL26479), the cron is currently a no-op.

---

## 7. State Machines

### 7.1 DOC_WRONG — Transaction state machine is incomplete

**Docs say:** `PENDING → COMPLETED → SETTLED → REFUNDED / FAILED`  
**Code reality:**
- Instructor wallet booking: created as `COMPLETED` directly (no PENDING)
- Stripe booking: created in some state, webhook sets to `SETTLED`
- Cancel: `SETTLED → CANCELLED` (not REFUNDED)
- Dispute refund: `SETTLED → REFUNDED` (via resolve endpoint)
- Dispute void/charge: `SETTLED → CANCELLED`

The actual transaction status values in use: `COMPLETED`, `SETTLED`, `CANCELLED`, `REFUNDED`, `FAILED`. `PENDING` may not be used at all for transactions.

---

### 7.2 DOC_MISSING — EXPIRED is a real booking status

**Code does:** `app/api/stripe/webhook/route.ts` explicitly handles `booking.status === 'EXPIRED'` and revives it. The booking GET query in `app/api/bookings/route.ts` filters for `['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']` — EXPIRED is excluded.  
**Docs say:** `STATE_MACHINES.md` shows `PENDING_PAYMENT → EXPIRED` but does not show the revival path back to `CONFIRMED`.

---

## 8. Schema Gaps

### 8.1 ~~SCHEMA_GAP~~ RESOLVED — wallet.balance now updated on instructor booking path

**Was:** Instructor booking path created a `WalletTransaction` DEBIT but never updated `ClientWallet.balance`. Admin booking path updated `balance` correctly. After an instructor-created booking, the stored balance was wrong.  
**Fixed (March 2026):** `app/api/bookings/route.ts` now calls `tx.clientWallet.update({ data: { balance: { decrement: lessonPrice } } })` inside the atomic transaction, keeping stored balance in sync with transaction log.

---

### 8.2 SCHEMA_GAP — WalletTransaction.status values are inconsistent

**Code does:** Uses both `'CONFIRMED'` and `'COMPLETED'` as status values in different places:
- `app/api/bookings/route.ts`: creates with `status: 'CONFIRMED'`
- `app/api/bookings/[id]/cancel/route.ts`: creates with `status: 'COMPLETED'`
- `app/api/admin/payouts/resolve/route.ts`: creates with `status: 'CONFIRMED'`

**Docs say:** Nothing about WalletTransaction status values.

---

## 9. Missing Implementations (CODE_MISSING)

| Feature | Documented | Status |
|---------|-----------|--------|
| `sendReminder` in compliance route | Logs intent only | No email sent — `console.log` only |
| Staff governance stats API `/api/admin/staff-governance/stats` | Documented in STAFF_GOVERNANCE.md | Endpoint does not exist |
| `STRIPE_WEBHOOK_SECRET` | ~~Placeholder~~ | **RESOLVED** — set in .env (test mode) |
| ABR_GUID | ~~Pending~~ | **RESOLVED** — set in .env; recheck-abn cron active (weekly, Mondays 2am) |
| Prisma client stale | ~~Not generated~~ | **RESOLVED** — `prisma generate` run March 2026 |
| Stripe Connect automated transfer | ~~Documented as "not yet configured"~~ | **RESOLVED** — `payout-service.ts` fully implements Stripe Connect path (`payoutMethod === 'stripe_connect'`). Instructors need `stripeAccountId` set to use it. |
| AuditLog on booking creation | Documented in SYSTEM_FLOWS.md | Not implemented — `POST /api/bookings` creates no AuditLog |
| AuditLog on admin booking status change | Documented in SYSTEM_FLOWS.md | Not implemented — `PATCH /api/admin/bookings` creates no AuditLog |
| Google Calendar fields missing from schema | Was causing crash on every booking | **RESOLVED** — `googleAccessToken`, `googleRefreshToken`, `googleCalendarId` added to schema March 2026 |
| Commission hardcoded | Was 15% regardless of tier | **RESOLVED** — both booking routes now use `getCommissionRate(tier)` |
| Wallet balance drift | Instructor path didn't update stored balance | **RESOLVED** — atomic decrement added March 2026 |

---

## 10. Summary Table

| Area | Gap Count | Severity |
|------|-----------|----------|
| Booking creation flow | 5 | High — docs describe wrong path |
| Payment/webhook flow | 4 | High — ledger can silently fail |
| Cancellation flow | 3 | Medium — split transaction risk |
| Admin booking actions | 3 | Medium — no audit trail |
| Payout flow | 5 | Critical — schema gaps = runtime failure |
| ABN flow | 2 | Medium — cron is no-op until ABR_GUID |
| State machines | 2 | Medium — wrong status values documented |
| Schema consistency | 2 | High — wallet balance can drift |
| Missing implementations | 7 | Mixed |

---

## Priority Actions — Remaining Open Gaps

### Production-blocking (fix before go-live)
1. **Replace test Stripe webhook secret** — `STRIPE_WEBHOOK_SECRET` in Vercel env vars must be the production webhook secret, not the test one
2. **Rotate all secrets** — DB password, Stripe keys, Twilio token were in git history — rotate before launch

### Medium priority (docs only — no code impact)
3. ~~Update `STATE_MACHINES.md`~~ — **DONE** — transaction states corrected: `SETTLED` not `COMPLETED`, `CANCELLED` not `REFUNDED`, two-path model documented, `noShowParty` field added
4. ~~Update `SYSTEM_FLOWS.md`~~ — **DONE** — instructor-created vs Stripe booking paths distinguished, transaction statuses corrected, no-show flow updated to use `noShowParty` field, reconciliation check descriptions corrected, ABN recheck corrected to weekly
5. Document `sendReminder` as not yet implemented (currently a no-op `console.log`) — low priority, no user impact
6. Document staff governance stats endpoint as missing — low priority, page still renders without it

### Resolved this session (March 2026)
- ~~Cancel route missing~~ — created `app/api/bookings/[id]/cancel/route.ts` with single atomic transaction
- ~~Cancellation split-transaction~~ — wallet + booking + transaction now atomic
- ~~No AuditLog on admin booking PATCH~~ — BOOKING_COMPLETED, BOOKING_NO_SHOW, BOOKING_CANCELLED now logged
- ~~No-show tagging via description string~~ — `noShowParty` field added to Booking schema; dispute query uses proper field
- ~~Ledger silent failure~~ — failure now logs 🚨 with bookingId; reconciliation cron provides safety net
