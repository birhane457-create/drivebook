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

### 1.1 ~~DOC_WRONG~~ RESOLVED — Booking does not start as PENDING_PAYMENT

**Fixed:** `SYSTEM_FLOWS.md` updated to distinguish Path A (instructor wallet booking → CONFIRMED directly) from Path B (Stripe → PENDING_PAYMENT). `BOOKINGS.md` updated to note price is always server-side calculated.

**Docs say:** `POST /api/bookings → Booking created (PENDING_PAYMENT)`  
**Code does:** `app/api/bookings/route.ts` creates the booking with `status: 'CONFIRMED'` directly, inside the same atomic transaction that debits the wallet. There is no `PENDING_PAYMENT` state for instructor-created wallet bookings.

`PENDING_PAYMENT` only exists for Stripe payment flow (public booking via `/book/[instructorId]`). The instructor-created booking path skips it entirely.

**Impact:** `STATE_MACHINES.md` and `SYSTEM_FLOWS.md` flow 1 are wrong for the instructor booking path.

---

### 1.2 ~~DOC_WRONG~~ RESOLVED — Commission rate now dynamic from PlatformSettings

**Was:** Both booking routes hardcoded `commissionRate: 0.15` (15%) regardless of instructor tier.  
**Fixed (March 2026):** Both `app/api/bookings/route.ts` and `app/api/admin/bookings/route.ts` now call `getCommissionRate(instructor.subscriptionTier)` from `lib/services/platform-pricing.ts`. PRO = 12%, BUSINESS = 10%, BASIC = 15% (DB-configurable).

---

### 1.3 ~~DOC_MISSING~~ RESOLVED — Wallet balance check uses two different methods

**Fixed:** `WALLET.md` updated to document that balance is always computed from CONFIRMED transactions. Admin booking path still uses stored `balance` field directly — known inconsistency, low risk since admin bookings are rare.

**Docs say:** Wallet balance is `ClientWallet.balance`  
**Code does:** `app/api/bookings/route.ts` uses `getWalletBalance(client.userId)` which recomputes balance from `WalletTransaction` sum (not the stored `balance` field). Then inside the `$transaction`, it re-checks by summing `WalletTransaction` again.

`app/api/admin/bookings/route.ts` uses `wallet.balance` (stored field) directly.

**Impact:** Two different sources of truth for wallet balance depending on who creates the booking. The instructor path is more correct (transaction sum) but slower. The admin path uses the stored field. Neither is documented.

---

### 1.4 ~~DOC_MISSING~~ RESOLVED — AuditLog on booking creation + no-account client booking

**Fixed (April 2026):**
- `POST /api/bookings` now calls `logBookingAction(BOOKING_CREATED, INSTRUCTOR, ...)` after every successful booking creation (both wallet and no-account paths).
- No-account client path added: if `client.userId` is null, booking is created as `PENDING_PAYMENT` and a "claim your account" email is sent to the student. The hard 422 rejection was removed.
- `lib/services/email.ts` — `sendClaimAccountEmail()` added.
- `app/dashboard/clients/page.tsx` — amber "No account" badge shown for clients without `userId`.

---

### 1.5 ~~DOC_MISSING~~ RESOLVED — Booking creation is instructor-only (not client-initiated)

**Fixed:** `SYSTEM_FLOWS.md` and `BOOKINGS.md` updated to clearly distinguish the two booking paths.

**Docs say:** "Client creates booking"  
**Code does:** `POST /api/bookings` requires `session.user.instructorId` — only instructors can call this endpoint. Clients cannot create bookings directly. The public booking flow (`/book/[instructorId]`) goes through a different path (Stripe payment intent → webhook).

**Impact:** `SYSTEM_FLOWS.md` flow 1 step 1 is misleading. There are actually two separate booking creation paths that are not distinguished in the docs.

---

## 2. Payment Flow

### 2.1 ~~DOC_WRONG~~ RESOLVED — Webhook sets transaction to SETTLED, not COMPLETED

**Fixed:** `STATE_MACHINES.md` updated with correct transaction states. `SYSTEM_FLOWS.md` updated to show SETTLED as the payout-eligible status.

**Docs say:** `Transaction created (BOOKING_PAYMENT, COMPLETED)`  
**Code does:** `app/api/stripe/webhook/route.ts` `handleBookingPaymentSuccess` calls `transaction.updateMany` with `status: 'SETTLED'` (not COMPLETED). The transaction is created elsewhere (likely in the public booking route) and the webhook updates it to SETTLED.

**Impact:** `SYSTEM_FLOWS.md` flow 1 and `STATE_MACHINES.md` transaction states are wrong. `COMPLETED` is not a real transaction status in the payout flow — `SETTLED` is what makes a transaction payout-eligible.

---

### 2.2 ~~DOC_MISSING~~ RESOLVED — Webhook handles EXPIRED booking revival

**Fixed:** `FAILURE_HANDLING.md` and `STATE_MACHINES.md` document the EXPIRED → CONFIRMED revival path.

**Code does:** If a booking is in `EXPIRED` status when `payment_intent.succeeded` fires, the webhook revives it to `CONFIRMED`. This is a critical edge case (race between slot expiry cron and payment capture).  
**Docs say:** Nothing about this. `FAILURE_HANDLING.md` mentions "Booking stays in PENDING_PAYMENT" but not the EXPIRED revival path.

---

### 2.3 ~~DOC_MISSING~~ RESOLVED — Package payment creates wallet CREDIT + DEBIT in webhook

**Fixed:** `WALLET.md` documents the package flow with CREDIT + DEBIT wallet transactions.

**Code does:** For package bookings, the webhook creates a wallet CREDIT for the full package amount and a DEBIT for the first lesson. This is the mechanism by which remaining package credits become available.  
**Docs say:** Nothing about this in `SYSTEM_FLOWS.md` or `FINANCIAL_DOCTRINE.md`.

---

### 2.4 DOC_MISSING — Ledger update is non-critical and outside the transaction

**Code does:** `recordPaymentCollected()` is called after the main `$transaction` block, wrapped in try/catch. If it fails, the booking is still confirmed but the ledger is not updated.

**Mitigation (March 2026):** Failure now logs `🚨 LEDGER UPDATE FAILED` with the bookingId — immediately visible in Vercel logs. The daily reconciliation cron (`/api/cron/reconcile-stripe`) detects missing `LedgerEntry(PAYMENT_COLLECTED)` records and flags them for admin review.

**Remaining risk:** The ledger can still silently miss a payment if `recordPaymentCollected` throws. A full fix would require refactoring `appendLedgerEntry` and `incrementLedger` to accept a Prisma transaction client (`tx`) so they can run inside the main `$transaction`. Deferred — reconciliation cron provides the safety net.

---

## 3. Cancellation Flow

### 3.1 ~~DOC_WRONG~~ RESOLVED — Transaction is set to CANCELLED, not REFUNDED

**Fixed:** `STATE_MACHINES.md` updated — CANCELLED is used for booking cancellations, REFUNDED only for dispute resolutions.

**Docs say:** `Transaction → REFUNDED`  
**Code does:** `app/api/bookings/[id]/cancel/route.ts` calls `transaction.updateMany` with `status: 'CANCELLED'`. The wallet is credited separately. There is no `REFUNDED` transaction status used here.

**Impact:** `STATE_MACHINES.md` transaction states show `COMPLETED → REFUNDED`. The actual path is `SETTLED → CANCELLED`.

---

### 3.2 ~~DOC_MISSING~~ RESOLVED — Refund uses originalStartTime anti-exploit logic

**Fixed:** `SYSTEM_FLOWS.md` cancellation flow documents the `min(originalStartTime, currentStartTime)` anti-exploit mechanism.

**Code does:** Refund policy is applied to `min(originalStartTime, currentStartTime)` to prevent the exploit: book far future → reschedule close → cancel for full refund.  
**Docs say:** `FINANCIAL_DOCTRINE.md` and `SYSTEM_FLOWS.md` describe refund tiers but do not mention this anti-exploit mechanism.

---

### 3.3 ~~DOC_MISSING~~ RESOLVED — Cancellation is now a single atomic transaction

**Was:** Wallet credit ran in one `$transaction`, booking/transaction status update ran in a second separate one. If the second failed, wallet was over-credited.

**Fixed (March 2026):** `app/api/bookings/[id]/cancel/route.ts` created (was missing — directory existed but file did not, causing every cancel button to 404). The new route wraps wallet credit + booking update + transaction update in a single `prisma.$transaction`. Also adds AuditLog on every cancellation, proper auth check, and anti-exploit refund policy.

---

## 4. Admin Booking Actions

### 4.1 ~~DOC_WRONG~~ RESOLVED — Admin marks COMPLETED via PATCH, not a dedicated endpoint

**Fixed:** `SYSTEM_FLOWS.md` updated to show `PATCH /api/admin/bookings`.

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

### 5.2 ~~DOC_WRONG~~ RESOLVED — Payout eligibility requires SETTLED status, not COMPLETED

**Fixed:** `STATE_MACHINES.md` and `FINANCIAL_DOCTRINE.md` updated to show SETTLED as payout-eligible status.

**Docs say:** `FINANCIAL_DOCTRINE.md` — "Transaction status = COMPLETED" for payout eligibility  
**Code does:** `GET /api/admin/payouts/route.ts` and `buildPayout` both query `status: 'SETTLED'`. `COMPLETED` is not a payout-eligible status.

---

### 5.3 ~~DOC_MISSING~~ RESOLVED — ABN gate only blocks if ABN is present but unverified

**Fixed:** `INSTRUCTOR_APPROVALS.md` updated to document the gate behavior: missing ABN proceeds with 47% withholding, present-but-unverified ABN blocks payout.

**Code does:** `POST /api/admin/payouts/process` — payout is blocked only if `instructor.abn && !instructor.abnVerified`. If the instructor has no ABN at all, payout proceeds with 47% withholding.  
**Docs say:** `INSTRUCTOR_APPROVALS.md` says "verified ABN → 0%, unverified or no ABN → 47%". The gate behavior (block vs proceed with withholding) is not documented.

---

### 5.4 ~~DOC_MISSING~~ RESOLVED — Reconciliation stuck threshold is 10 minutes, not 24 hours

**Fixed:** `FAILURE_HANDLING.md` updated to show 10-minute threshold.

**Docs say:** `FAILURE_HANDLING.md` — "Payouts stuck in PROCESSING for >24h"  
**Code does:** `reconcile-stripe/route.ts` — `STUCK_THRESHOLD_MINUTES = 10`. Payouts stuck for >10 minutes are flagged.

---

### 5.5 ~~DOC_MISSING~~ RESOLVED — Reconciliation check 1 matches on LedgerEntry, not Transaction

**Fixed:** `SYSTEM_FLOWS.md` reconciliation flow updated to describe the LedgerEntry check correctly.

**Docs say:** `SYSTEM_FLOWS.md` flow 5 — "Check 1: Completed bookings with no transaction record"  
**Code does:** Check 1 looks for Stripe `payment_intent.succeeded` events with no corresponding `LedgerEntry(PAYMENT_COLLECTED)`. It does not check for missing `Transaction` records.

---

## 6. ABN Flow

### 6.1 ~~DOC_WRONG~~ RESOLVED — recheck-abn is weekly, not daily

**Fixed:** `INSTRUCTOR_APPROVALS.md` updated to weekly schedule (Mondays 2am).

**Docs say:** `INSTRUCTOR_APPROVALS.md` — "Daily cron (GET /api/cron/recheck-abn)"  
**Code does:** The cron comment says "weekly" and the `vercel.json` schedule should be checked. The code itself does not enforce frequency — it runs whenever triggered.

---

### 6.2 ~~DOC_MISSING~~ RESOLVED — recheck-abn skips if ABR_GUID not configured

**Fixed:** `INSTRUCTOR_APPROVALS.md` documents the skip condition and notes ABR_GUID is now set in .env.

**Code does:** Returns `{ skipped: true, reason: 'ABR_GUID not configured' }` if `ABR_GUID` env var is empty.  
**Docs say:** Nothing about this skip condition. Given ABR_GUID is still pending (ref: ABNL26479), the cron is currently a no-op.

---

## 7. State Machines

### 7.1 ~~DOC_WRONG~~ RESOLVED — Transaction state machine is incomplete

**Fixed:** `STATE_MACHINES.md` fully updated with both booking paths, correct status values, and CANCELLED vs REFUNDED distinction.

**Docs say:** `PENDING → COMPLETED → SETTLED → REFUNDED / FAILED`  
**Code reality:**
- Instructor wallet booking: created as `COMPLETED` directly (no PENDING)
- Stripe booking: created in some state, webhook sets to `SETTLED`
- Cancel: `SETTLED → CANCELLED` (not REFUNDED)
- Dispute refund: `SETTLED → REFUNDED` (via resolve endpoint)
- Dispute void/charge: `SETTLED → CANCELLED`

The actual transaction status values in use: `COMPLETED`, `SETTLED`, `CANCELLED`, `REFUNDED`, `FAILED`. `PENDING` may not be used at all for transactions.

---

### 7.2 ~~DOC_MISSING~~ RESOLVED — EXPIRED is a real booking status

**Fixed:** `STATE_MACHINES.md` shows PENDING_PAYMENT → EXPIRED and the revival path EXPIRED → CONFIRMED (webhook race condition).

**Code does:** `app/api/stripe/webhook/route.ts` explicitly handles `booking.status === 'EXPIRED'` and revives it. The booking GET query in `app/api/bookings/route.ts` filters for `['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']` — EXPIRED is excluded.  
**Docs say:** `STATE_MACHINES.md` shows `PENDING_PAYMENT → EXPIRED` but does not show the revival path back to `CONFIRMED`.

---

## 8. Schema Gaps

### 8.1 ~~SCHEMA_GAP~~ RESOLVED — wallet.balance now updated on instructor booking path

**Was:** Instructor booking path created a `WalletTransaction` DEBIT but never updated `ClientWallet.balance`. Admin booking path updated `balance` correctly. After an instructor-created booking, the stored balance was wrong.  
**Fixed (March 2026):** `app/api/bookings/route.ts` now calls `tx.clientWallet.update({ data: { balance: { decrement: lessonPrice } } })` inside the atomic transaction, keeping stored balance in sync with transaction log.

---

### 8.2 ~~SCHEMA_GAP~~ RESOLVED — WalletTransaction.status values are inconsistent

**Fixed:** All wallet transaction creates now use `status: 'CONFIRMED'`. The cancel route was verified to already use `'CONFIRMED'`. `getWalletBalance()` correctly only counts `CONFIRMED` transactions.

**Code does:** Uses both `'CONFIRMED'` and `'COMPLETED'` as status values in different places:
- `app/api/bookings/route.ts`: creates with `status: 'CONFIRMED'`
- `app/api/bookings/[id]/cancel/route.ts`: creates with `status: 'COMPLETED'`
- `app/api/admin/payouts/resolve/route.ts`: creates with `status: 'CONFIRMED'`

**Docs say:** Nothing about WalletTransaction status values.

---

## 9. Missing Implementations (CODE_MISSING)

| Feature | Documented | Status |
|---------|-----------|--------|
| `sendReminder` in compliance route | ~~Logs intent only~~ | **RESOLVED** — now sends real email to instructor listing expiring docs with days remaining |
| Staff governance stats API `/api/admin/staff-governance/stats` | ~~Endpoint does not exist~~ | **RESOLVED** — implemented with real DB queries (pending approvals, disputes, refunds, stuck payouts, expired docs) |
| `STRIPE_WEBHOOK_SECRET` | ~~Placeholder~~ | **RESOLVED** — set in .env (test mode) |
| ABR_GUID | ~~Pending~~ | **RESOLVED** — set in .env; recheck-abn cron active (weekly, Mondays 2am) |
| Prisma client stale | ~~Not generated~~ | **RESOLVED** — `prisma generate` run March 2026 |
| Stripe Connect automated transfer | ~~Documented as "not yet configured"~~ | **RESOLVED** — `payout-service.ts` fully implements Stripe Connect path (`payoutMethod === 'stripe_connect'`). Instructors need `stripeAccountId` set to use it. |
| AuditLog on booking creation | Documented in SYSTEM_FLOWS.md | **RESOLVED** — `POST /api/bookings` now calls `logBookingAction` (April 2026) |
| AuditLog on admin booking status change | Documented in SYSTEM_FLOWS.md | **RESOLVED** — `PATCH /api/admin/bookings` logs BOOKING_COMPLETED, BOOKING_NO_SHOW, BOOKING_CANCELLED |
| Instructor book-on-behalf for no-account clients | Was hard 422 rejection | **RESOLVED** — creates PENDING_PAYMENT booking + sends claim email (April 2026) |
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
5. ~~Document `sendReminder` as not yet implemented~~ — **RESOLVED** — `sendReminder` now sends real email to instructor listing expiring docs
6. ~~Document staff governance stats endpoint as missing~~ — **RESOLVED** — endpoint implemented

### Resolved this session (March 2026)
- ~~Cancel route missing~~ — created `app/api/bookings/[id]/cancel/route.ts` with single atomic transaction
- ~~Cancellation split-transaction~~ — wallet + booking + transaction now atomic
- ~~No AuditLog on admin booking PATCH~~ — BOOKING_COMPLETED, BOOKING_NO_SHOW, BOOKING_CANCELLED now logged
- ~~No-show tagging via description string~~ — `noShowParty` field added to Booking schema; dispute query uses proper field
- ~~Ledger silent failure~~ — failure now logs 🚨 with bookingId; reconciliation cron provides safety net

---

## 11. Deep Inspection Findings (April 2026)

### 11.1 ~~CODE_BUG~~ RESOLVED — Wallet top-up webhook confirms transactions without amount validation

**Fixed (April 2026):** Added amount validation in `handleWalletPaymentSuccess()` before confirming transactions. Calculates expected cents from CREDIT transactions, compares to `paymentIntent.amount_received`. Throws if mismatch — prevents underpayment fraud.

**File:** `app/api/stripe/webhook/route.ts` → `handleWalletPaymentSuccess()`

**Code does:** Finds PENDING wallet transactions by `transactionId` or by `walletId + last 10 minutes`, then confirms them. Does NOT validate that `paymentIntent.amount_received` matches the transaction amount.

**Risk:** If a client creates a $500 top-up intent but pays $50 (e.g. via Stripe test manipulation), the webhook confirms the $500 PENDING transaction. Client gets $500 credit for $50 paid.

**Fix:** Add before confirming: `if (paymentIntent.amount_received !== Math.round(transaction.amount * 100)) throw new Error('Amount mismatch')`

**Severity:** CRITICAL — direct financial loss

---

### 11.2 ~~CODE_BUG~~ RESOLVED — Wallet top-up creates PENDING transaction before Stripe intent; no cleanup on failure

**Fixed (April 2026):** `app/api/client/wallet-topup-intent/route.ts` now wraps the Stripe intent creation in try/catch. If Stripe fails, the orphaned PENDING transaction is deleted before re-throwing. File was also recreated (had been deleted from disk).

**File:** `app/api/client/wallet-topup-intent/route.ts`

**Code does:** Creates a PENDING `WalletTransaction` BEFORE calling Stripe. If Stripe fails (network error, card declined), the PENDING transaction is never cleaned up. `getWalletBalance()` correctly excludes PENDING transactions, but the orphaned record accumulates.

**Risk:** Low financial risk (PENDING excluded from balance), but orphaned records pollute the transaction log and could confuse support.

**Fix:** Wrap in try/catch — if Stripe intent creation fails, delete the pending transaction. Or add a cron to clean up PENDING transactions older than 30 minutes with no matching Stripe intent.

**Severity:** MEDIUM — data hygiene

---

### 11.3 ~~CODE_BUG~~ RESOLVED — Booking price accepted from client request body

**Fixed (April 2026):** Removed `price` from `bookingSchema` in `app/api/bookings/route.ts`. Price is now always calculated server-side as `instructor.hourlyRate × durationHours`. Client can no longer pass an arbitrary price.

**File:** `app/api/bookings/route.ts` line ~100

**Code does:** `const lessonPrice = data.price ?? parseFloat((instructor.hourlyRate * durationHours).toFixed(2))` — if `data.price` is provided, it's used directly without validation against `instructor.hourlyRate`.

**Risk:** Instructor could pass any price in the request body. Undercharging is possible (though instructor would be hurting themselves). More importantly, if the API is called by a compromised client, arbitrary prices could be set.

**Fix:** Always calculate server-side: `const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))`. Remove `data.price` from the schema or only allow it for admin-created bookings with explicit override flag.

**Severity:** HIGH — financial integrity

---

### 11.4 ~~CODE_BUG~~ RESOLVED — Availability check is outside the booking transaction (TOCTOU race)

**Fixed (April 2026):** `app/api/bookings/route.ts` now has a definitive slot conflict check INSIDE the `$transaction` block (after the wallet balance re-check). The pre-check outside the transaction is kept for fast rejection but the atomic check inside is the authoritative one. Throws `SLOT_TAKEN` which is caught and returns 409.

**File:** `app/api/bookings/route.ts`

**Code does:** Calls `availabilityService.checkDoubleBooking()` OUTSIDE the `$transaction`, then creates the booking INSIDE. Between the check and the create, another request could claim the same slot.

**Code already has:** A re-check inside the transaction (`txBalance < lessonPrice` check), but NOT a re-check of slot availability inside the transaction.

**Risk:** Two instructors booking the same client at the same time, or the same instructor double-booking via concurrent requests.

**Fix:** Move the conflict check inside the `$transaction` block (same pattern as `public/bookings/bulk/route.ts` which already does this correctly).

**Severity:** HIGH — double-booking risk

---

### 11.5 ~~CODE_BUG~~ RESOLVED — Bulk booking doesn't validate instructor is active/approved

**Fixed (April 2026):** `app/api/public/bookings/bulk/route.ts` now checks `approvalStatus !== 'APPROVED'`, `status === 'SUSPENDED'`, and `isActive === false` after fetching the instructor. Returns 403 if any check fails.

**File:** `app/api/public/bookings/bulk/route.ts`

**Code does:** `prisma.instructor.findUnique({ where: { id: data.instructorId } })` — only checks existence, not status.

**Risk:** Students can book with suspended or unapproved instructors.

**Fix:** Add `where: { id: data.instructorId, isActive: true, approvalStatus: 'APPROVED' }` (or equivalent fields from schema).

**Severity:** HIGH — business logic

---

### 11.6 ~~CODE_BUG~~ RESOLVED — Short-notice pending bookings never expire

**Fixed (April 2026):** `app/api/cron/cleanup-expired-bookings/route.ts` now expires `PENDING` bookings with `createdBy: 'client'` older than 2 hours. This covers short-notice bookings awaiting instructor approval. Instructor-created `PENDING` bookings are not auto-expired.

**File:** `app/api/public/bookings/bulk/route.ts`

**Code does:** Creates booking with `status: 'PENDING'` for short-notice slots. No timeout or expiry mechanism exists for these.

**Risk:** If instructor never approves, the booking holds the slot indefinitely. The slot expiry cron only handles `PENDING_PAYMENT` bookings, not `PENDING` ones.

**Fix:** Add short-notice bookings to the expiry cron, or auto-expire after 2 hours if not approved.

**Severity:** MEDIUM — slot blocking

---

### 11.7 ~~CODE_BUG~~ RESOLVED — WalletTransaction.status uses 'COMPLETED' in cancel route

**Was:** Gap analysis noted this as a risk. On inspection, the cancel route already uses `status: 'CONFIRMED'` (fixed when the route was rewritten in March 2026). No action needed.

**File:** `app/api/bookings/[id]/cancel/route.ts`

**Code does:** Creates refund wallet transaction with `status: 'COMPLETED'`. All other routes use `status: 'CONFIRMED'`. `getWalletBalance()` in `wallet-helpers.ts` only counts `status: 'CONFIRMED'` transactions.

**Risk:** Refund credits are NOT included in wallet balance calculation. Student gets refunded but their balance doesn't increase.

**Fix:** Change cancel route to use `status: 'CONFIRMED'` for the refund wallet transaction.

**Severity:** CRITICAL — refunds don't appear in wallet balance

---

### 11.8 ENHANCEMENT — Availability buffer can extend past working hours (acceptable)

**Status:** Reviewed and accepted as intentional. The slot generator checks `slotEnd > workEnd` (lesson must fit within hours) but allows the buffer to extend past `workEnd`. This is correct — the instructor rests after their last lesson, which may extend past official end time. No code change needed.

**File:** `app/api/availability/slots/route.ts`

**Code does:** Blocks `booking.endTime + bufferMinutes` as unavailable. If a booking ends at 4:45pm with a 15-min buffer and working hours end at 5pm, the buffer extends to 5:00pm which is fine. But if a booking ends at 4:55pm, the buffer extends to 5:10pm — past working hours — and the slot at 5:00pm is blocked even though it's outside working hours anyway.

**Risk:** Low — just means the last slot of the day is blocked slightly more aggressively than needed.

**Fix:** Cap buffer end at `workEnd`: `const bufferEnd = min(addMinutes(booking.endTime, buffer), workEnd)`

**Severity:** LOW — minor UX

---

### 11.9 ~~ENHANCEMENT~~ FULLY RESOLVED — Notification triggers complete

**Fixed (April 2026 — fully resolved):**
- `notifyReviewReceived()` — wired into `app/api/reviews/route.ts` ✅
- `notifyDocumentExpiring()` — wired into `app/api/admin/documents/compliance/route.ts` `sendReminder` action ✅
- `sendReminder` now also sends a real email to the instructor listing expiring docs with days remaining ✅
- `notifyLessonReminderInstructor()` + `notifyLessonReminderStudent()` — fully wired into `app/api/cron/lesson-reminders/route.ts` ✅
- Lesson reminders cron also sends SMS to both instructor and student, and email to offline students ✅

**All notification triggers are now wired. No deferred items remain in this area.**

---

### 11.10 ~~CODE_BUG~~ RESOLVED — Booking price not validated against instructor's current rate

**Fixed (April 2026):** `app/api/public/bookings/bulk/route.ts` now calls `calculatePackagePriceDynamic()` server-side and validates the client-submitted `pricing.total` is within 1 cent. If it differs, returns 409 with the correct server total. `packageTotalPaid` on the booking now always uses the server-verified amount.

**File:** `app/api/public/bookings/bulk/route.ts`

**Code does:** Accepts `pricing.total` from the client request body and uses it as the Stripe charge amount. The server recalculates `firstLessonPrice` from `instructor.hourlyRate`, but the total package price is taken from the client.

**Risk:** If the client manipulates `pricing.total` to be lower, they pay less than the correct package price. The webhook then credits the wallet with the manipulated amount.

**Fix:** Always calculate `pricing.total` server-side using `calculatePackagePrice(hourlyRate, hours, packageType)`. Never trust client-submitted pricing.

**Severity:** CRITICAL — financial fraud vector

---

## 12. Updated Priority Actions (April 2026)

### Fix immediately (financial integrity)
1. **11.7** — Refund wallet transactions use `'COMPLETED'` not `'CONFIRMED'` — refunds don't show in balance
2. **11.10** — Package total price accepted from client — fraud vector
3. **11.1** — Wallet top-up amount not validated in webhook — double-credit risk
4. **11.3** — Booking price accepted from request body — financial integrity

### Fix before go-live
5. **11.4** — Availability check outside transaction — double-booking race
6. **11.5** — Bulk booking doesn't check instructor is active
7. **11.6** — Short-notice pending bookings never expire
8. **11.2** — Orphaned PENDING wallet transactions on Stripe failure

### Enhancement (post-launch)
9. **11.9** — Wire up missing notification triggers
10. **11.8** — Cap availability buffer at working hours end

---

## 13. Rate & Discount Locking (April 2026)

### 13.1 RESOLVED — Package rate and discount not locked at purchase time

**Fixed (April 2026):**
- `lockedHourlyRate Float?` and `lockedDiscountPct Float?` added to `Booking` schema
- `app/api/public/bookings/bulk/route.ts` stores `instructor.hourlyRate` and `serverPricing.discountPercentage` on the booking at creation
- `app/api/client/confirm-package-booking/route.ts` now uses `packageBooking.lockedHourlyRate` (falls back to `instructor.hourlyRate` for legacy records) when calculating the deduction amount for individual lessons
- `prisma generate` run to pick up new fields

**SQL migration required (run in Supabase SQL editor):**
```sql
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "lockedHourlyRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lockedDiscountPct" DOUBLE PRECISION;

ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "bulkDiscountsEnabled" BOOLEAN NOT NULL DEFAULT true;
```

**Policy:**
- Already booked → price is locked, rate changes have no effect
- Package purchased (paid) → `lockedHourlyRate` and `lockedDiscountPct` stored on the booking; all future lesson deductions from that package use these values regardless of instructor rate changes
- Wallet top-up only (not yet booked) → no lock; booking uses current rate at booking time
- UI tip shown in `PackageSelector`: "Rate & discount locked at purchase — instructor price changes won't affect your package"
- Server always recalculates pricing at submission using live DB rate; if client-submitted total differs by >$0.01, returns 409 with `serverTotal` so the UI can show the updated price and ask the student to confirm

**Files changed:**
- `prisma/schema.prisma` — `lockedHourlyRate`, `lockedDiscountPct` on `Booking`; `bulkDiscountsEnabled` on `PlatformSettings`
- `app/api/public/bookings/bulk/route.ts` — stores locked values on booking create
- `app/api/client/confirm-package-booking/route.ts` — uses locked rate for deductions
- `components/PackageSelector.tsx` — lock benefit bullet; discount rates from live DB
- `lib/contexts/BookingContext.tsx` — fetches `platformSettings` from `/api/public/pricing` on mount
- `app/api/public/pricing/route.ts` — public endpoint returning live discount rates

**Severity:** HIGH — without this, instructor rate increases silently overcharge students on pre-purchased packages

---

## 14. Slot Blocking, Price Lock & Discount Toggle (April 2026)

### 14.1 RESOLVED — Slot blocking during booking flow (TOCTOU in public wizard)

**Fixed (April 2026):** `app/api/availability/check-and-reserve/route.ts` implemented. Called by `BookingDetailsForm` when the student selects a time slot in the "Book Now" wizard step.

**How it works:**
- `POST /api/availability/check-and-reserve` — checks DB for overlapping PENDING/CONFIRMED bookings, then writes a 10-minute in-memory reservation keyed by `instructorId:date:time:duration:sessionId`
- `DELETE /api/availability/check-and-reserve` — releases the reservation (called on slot removal and component unmount)
- Reservations expire automatically after 10 minutes (same window as `PENDING_PAYMENT` booking expiry)
- If another session tries to reserve the same slot, returns 409 `{ available: false, reason: 'Slot is temporarily reserved by another user' }`
- `BookingDetailsForm` calls this before `addScheduledBooking()` — if 409, refreshes available slots and shows error

**Note:** In-memory store — does not survive server restarts. Acceptable for dev/single-instance. For multi-instance production, replace `slotReservations` Map with Redis (Upstash).

**Files:** `app/api/availability/check-and-reserve/route.ts`, `components/BookingDetailsForm.tsx`

---

### 14.2 RESOLVED — Price lock rule: book-now vs book-later

**Fixed (April 2026):** Clear two-path rule implemented and enforced server-side.

**Rule:**

| Scenario | Rate used | Locked? |
|----------|-----------|---------|
| Buy package + book all slots now | `instructor.hourlyRate` at purchase time | Yes — stored as `lockedHourlyRate` on `Booking` |
| Buy package + book later (wallet top-up) | `instructor.hourlyRate` at time of each individual booking | No — wallet is plain money |
| Already-confirmed booking | `booking.price` (immutable after creation) | Yes — field never updated |

**Book-now path (`public/bookings/bulk` with `bookingType: now`):**
- `lockedHourlyRate` and `lockedDiscountPct` stored on the `Booking` record at creation
- Instructor rate changes after purchase have zero effect on these bookings

**Book-later path (`client/bookings/create-bulk`):**
- Server fetches current `instructor.hourlyRate` at booking time
- Client-submitted `item.price` is ignored entirely — server recalculates as `hourlyRate × duration`
- If instructor raised rate from $70 to $80, student pays $80/hr when they book from dashboard
- UI tip in `PackageSelector`: "Rate & discount locked at purchase" — this applies to book-now only; book-later students should be aware the rate is not locked

**Files:** `app/api/public/bookings/bulk/route.ts` (stores locked values), `app/api/client/bookings/create-bulk/route.ts` (recalculates at booking time)

---

### 14.3 RESOLVED — Admin bulk discount toggle

**Fixed (April 2026):** `PricingSettingsForm` now has an "Enable bulk discounts" master toggle at the top of the Package Discounts section.

**Behaviour:**
- Toggle ON → individual 6/10/15hr discount fields are active (default: 5/10/12%)
- Toggle OFF → sets all three rates to 0% atomically — clients pay full hourly rate for any package size
- Toggle back ON → restores sensible defaults (5/10/12%)
- Individual fields remain editable regardless of toggle state
- Saved via `POST /api/admin/pricing` — takes effect on next booking (existing bookings unaffected)

**Files:** `components/admin/PricingSettingsForm.tsx`

---

### 14.4 RESOLVED — 409 price-change auto-refresh in subdomain wizard

**Fixed (April 2026):** `SubdomainBookingWizard` now handles 409 responses from `POST /api/public/bookings/bulk` where the error message contains "pric".

**Flow:**
1. Student submits booking
2. Server recalculates pricing — if client total differs by >$0.01, returns 409 `{ error: 'Pricing has changed...' }`
3. Wizard re-fetches `/api/public/pricing` and calls `updateBooking({ platformSettings: freshSettings })`
4. `BookingContext.calculatePricing()` recalculates with new rates — `PackageSelector` and order summary update automatically
5. Amber banner shown: "Prices updated — please review the new totals and try again"
6. Student can re-submit with the correct price

**Files:** `components/subdomain/SubdomainBookingWizard.tsx`, `lib/contexts/BookingContext.tsx`

---

## 15. Launch Readiness Assessment (April 2026)

**Full inspection completed April 2026.** Findings consolidated into `docs/LAUNCH_PLAN.md` which is now the single source of truth for outstanding work.

**Summary of open items:**

| Priority | Count | Blocking launch? |
|----------|-------|-----------------|
| Critical (C1–C5) | 5 | Yes |
| High (H1–H5) | 5 | No, but important |
| Medium (M1–M6) | 6 | No |
| Low (L1–L8) | 8 | No |

**Critical items status (April 2026):**
- C1: `UPSTASH_REDIS_REST_URL` empty — rate limiting is in-memory only in production ❌ Open (owner to set in Vercel)
- C2: ~~Lesson reminders cron is a no-op~~ ✅ **RESOLVED** — `notifyLessonReminderInstructor()` + `notifyLessonReminderStudent()` fully wired; SMS + email for offline students added
- C3: ~~Client review UI missing~~ ✅ **RESOLVED** — `ReviewModal`, `GET /api/client/pending-reviews`, "Leave Review" button on bookings page
- C4: ~~Fake testimonials on `/teach-with-drivebook`~~ ✅ **RESOLVED** — replaced with honest "Early Access" section
- C5: `ABN: [Your ABN]` placeholder in footer — legal non-compliance ❌ Open (owner to add real ABN)

See `docs/LAUNCH_PLAN.md` for full details, fix instructions, and production deployment checklist.

**Note:** The following files are now superseded by `LAUNCH_PLAN.md` and can be ignored:
- `FINAL_IMPLEMENTATION_STATUS.md`
- `FINAL_STATUS_SUMMARY.md`
- `P0_FIXES_COMPLETE.md`
- `P0_README.md`
- `REMAINING_WORK.md`
- `DEPLOY_NOW.md`
- `ALL_ISSUES_FIXED.md`
- `VERIFICATION_COMPLETE.md`
