# WLA-005 — Wallet Ownership Architecture Decision

**Finding ID:** WLA-005  
**Category:** ARCHITECTURAL  
**Original finding:** "Wallet balance is currently user-wide, not provider-attributed; whether that is a defect depends on the approved white-label wallet contract."  
**Status:** OPEN — SOURCE INVESTIGATION AND RECONCILIATION IN PROGRESS  
**Authored:** 2026-11-06  
**Last revised:** 2026-11-06 (reviewer corrections applied — false claims removed, incomplete traces marked)  
**Source inspected:** commit `cc22e8d8` (origin/main)

**Reviewer corrections applied this revision:**
1. Step 1: removed false claim that `packageExpiryDate` is set to 365 days in the webhook — no current purchase path writes this field
2. Step 2: corrected `lockedHourlyRate` framing — saved price provides booking-time amount; missing field is auditability concern, not repricing risk; removed "active callers" claim for `confirm-package-booking` — test suites are not production callers
3. Step 3: added synthetic `package-...` paymentIntentId failure case
4. Step 4: changed P0-01 from "dormant security check" to "user-facing integration mismatch" — wallet credits via webhook while customer-facing modal reports failure
5. Step 5: expanded ledger reconciliation table with all missing FinancialLedger calls
6. Step 6: corrected wording — no self-service deletion endpoint; cascade-delete is latent risk, not active defect; Terms of Service clause 22 promises refund but no workflow implements it
7. Architecture reframed: pooled wallet is intentional, not a defect; real problem is credit-lot tracking with per-purchase expiry

---

## 1. Current-State Source Evidence

### 1.1 Database schema (source-verified)

**ClientWallet** (`prisma/schema.prisma`):
- `userId String @unique` — one wallet per User (1:1)
- `balance Decimal @default(0)` — a **cached** balance, NOT authoritative
- `onDelete: Cascade` from User
- **No `providerId`** — the wallet is strictly per-user, pooled across all providers
- **No `providerId` is a deliberate design choice**, not a defect — see architecture section

**WalletTransaction** (`prisma/schema.prisma`):
- `walletId`, `amount`, `type` (`CREDIT` | `DEBIT` | `PLATFORM_SUBSIDY`), `status` (`PENDING` | `CONFIRMED` | `EXPIRED`)
- `bookingId String?` — links to the booking that caused the debit
- **No `providerId`** — transactions are not attributed to any provider
- **No expiry date field** — wallet credits do not carry their own expiry; no field exists for per-purchase expiry
- DB unique index on `metadata->>'stripePaymentIntentId'` (prevents concurrent double-credit, P0-01B fix)

**Booking package fields** (`prisma/schema.prisma`):
- `packageExpiryDate` exists on the `Booking` model (the parent package row)
- **No current purchase path writes this field** — confirmed by source inspection of `app/api/public/bookings/bulk/route.ts` and `app/api/stripe/webhook/route.ts`
- The field is READ by package listing, scheduling, and notification routes, but never WRITTEN

**No `walletCreditValidityMonths` setting exists** in `PlatformSettings`.

**No provider wallet exists.** Only `ClientWallet` (per-User). Providers are compensated through the `Payout`/Stripe Connect flow, tracked in `FinancialLedger` under `INSTRUCTOR_PAYABLE`/`INSTRUCTOR_PAID` accounts — completely separate from client wallets.

### 1.2 Where money is held

All wallet top-up and package payment flows use `new Stripe(process.env.STRIPE_SECRET_KEY!)` — DriveBook's **platform Stripe account**. Not the instructor's Connect account. Funds settle into DriveBook's Stripe balance.

The wallet balance is an **accounting liability** of DriveBook to the client — a contractual credit redeemable for lessons. It is **not** a segregated cash holding. It blends:
1. Real cash the client paid (held in DriveBook's Stripe balance)
2. DriveBook-funded promotional subsidy (the discount residual on packages — not backed by cash received)
3. Minus the non-refundable platform fee (already recognized as revenue via `PACKAGE_FEE` Transaction)

### 1.3 Contradictory expiry messaging (source-verified)

The codebase contains at least four different expiry policies, none of which is enforced:

| Source | Current statement |
|---|---|
| Terms of Service (`app/terms/page.tsx` clause 15.2, 21) | "expire after 12 months of account inactivity" — "no booking has been made and no wallet transaction has occurred within the preceding 12 months" |
| Privacy page (`app/privacy/page.tsx`) | "365 days of account inactivity" |
| Packages API (`app/api/packages/route.ts`) | "All packages expire 365 days from purchase" |
| Stripe Checkout description (`app/api/public/bookings/bulk/route.ts`) | "Credit valid for 12 months from last account activity" |
| Product owner's confirmed requirement | "12 calendar months from successful payment confirmation" |

**These are contradictory.** The Terms of Service says "account inactivity"; the packages API says "from purchase"; the product owner says "from successful payment confirmation." No code enforces any of them.

### 1.4 Confirmed product rules (Steps 1–2, 2026-11-06)

| Rule | Decision |
|---|---|
| Expiry period | 12 calendar months (not 365 days) |
| Expiry start | Successful payment confirmation only |
| Expiry type | Each purchase expires independently |
| Activity | Does not reset expiry |
| Cross-provider spending | Supported — pooled wallet, any instructor (intentional design) |
| Cron frequency | Daily acceptable on current hosting plan |
| Configuration | `walletCreditValidityMonths` in `PlatformSettings` |
| Rate changes | Do not change an already confirmed booking |
| Existing purchases on policy change | New policy affects new purchases only |
| Provider attribution | Pooled wallet is intentional — not a defect |

### 1.5 Wallet top-up flows

**Path A — Package purchase via Stripe Checkout (Book Later):**
- Client buys package → Stripe Checkout Session with `metadata.type='wallet_credit'`
- Creates a Stripe Checkout Session — does NOT create a parent Booking record at this stage
- On `checkout.session.completed` webhook: validates payment, credits wallet with face value, creates PLATFORM_SUBSIDY and PACKAGE_FEE records
- **No expiry date is saved** — neither `Booking.packageExpiryDate` nor any WalletTransaction field

**Path B — Package purchase via bulk route (Book Now):**
- `app/api/public/bookings/bulk/route.ts` creates a parent Booking record
- The inspected creation block does NOT set `packageExpiryDate`
- The successful-payment webhook also does NOT set this field
- **No expiry date is saved**

**Path C — Plain top-up via PaymentIntent:**
- `POST /api/client/wallet-topup-intent` creates a PENDING WalletTransaction, then a Stripe PaymentIntent
- On `payment_intent.succeeded` webhook: validates amount, flips PENDING → CONFIRMED
- **No expiry date** — plain top-ups never expire (no expiry mechanism at all)

**Path D — Client-pull confirmation via wallet-add:**
- `POST /api/client/wallet-add` re-fetches PaymentIntent from Stripe, enforces P0-01 ownership check
- **User-facing integration mismatch (see §1.8):** wallet-topup-intent does NOT pass `userId` to `createPaymentIntent`, so the P0-01 check in wallet-add fails-closed (403). The customer-facing modal (`AddCreditsModal.tsx`) calls wallet-add after payment succeeds, receives 403, and reports "adding credits failed" to the user — while the webhook has already successfully credited the wallet. The customer sees a failure message but the credit is applied.

### 1.6 Cross-provider booking (Step 2, source-verified)

`app/api/client/bookings/create-bulk/route.ts`:
1. Identifies student from authenticated session
2. Accepts multiple cart items, each with its own `providerId`
3. Fetches hourly rate for each instructor; recalculates price server-side
4. Loads one wallet using student's `userId` (pooled, cross-provider — intentional)
5. Checks combined booking cost against aggregate wallet balance
6. Creates individual bookings for each instructor inside a transaction
7. Creates **one aggregated wallet DEBIT** for the combined cost (no per-booking attribution, no per-purchase allocation)
8. `lockedHourlyRate` is **NOT populated** — but the route calculates and saves each booking's `price` using the instructor's current rate. The saved price provides a booking-time financial amount. The missing `lockedHourlyRate` field is an auditability and data-consistency concern; it does not prove the student will be repriced later.

**Cross-provider spending is confirmed at source.** The pooled wallet is an intentional design choice, not a defect.

**`confirm-package-booking` route:** The older package-child confirmation flow exists in the codebase and has test coverage, but test suites are not production callers. The current packages dashboard directs students to the standard booking screen. A genuine frontend/API caller trace is needed before classifying this route as active in production.

### 1.7 Booking cancellations and refunds (Step 3, source-verified)

Three entry points with materially different refund behavior:

**Entry point A — `POST /api/bookings/[id]/cancel` (authenticated, delegates to `cancelBooking()`):**
- Issues a **wallet CREDIT** for the refund amount
- Only if `booking.source === 'platform'` (offline bookings excluded)
- Uses `calculatePartialPackageRefund` for package bookings (tier-aware, capped at `totalPaid − platformFee`)
- Time policy: 48h+ = 100%, 24–48h = 50%, <24h = 0%
- **Wallet-funded bookings: wallet credit issued correctly** ✅

**Entry point B — `POST /api/public/bookings/[id]/cancel` (voice agent / self-service):**
- Cancels the booking atomically via `updateMany` status guard
- Issues **Stripe card refund** if `booking.isPaid && refundAmount > 0 && paymentIntentId`
- **Wallet-funded bookings: no refund** — two failure cases:
  1. `paymentIntentId` is null (wallet debit came from wallet, no card charge) → logs "No paymentIntentId — refund must be processed manually"
  2. `paymentIntentId` is a synthetic `package-...` value (older package-child confirmation path) → not a real Stripe PaymentIntent → `stripe.refunds.create` fails
- **No wallet credit is issued in either case** — the student receives nothing
- **Confirmed defect**

**Entry point C — `approveCancellation()` (admin-approved package cancellations):**
- Atomic CAS on `cancellationStatus: PENDING → APPROVING`
- Issues **Stripe card refund** first, then in a transaction creates a wallet **DEBIT** to reverse the face-value credit
- Requires real `booking.paymentIntentId` — throws "No payment intent found" if missing or synthetic

### 1.8 P0-01 ownership check — user-facing integration mismatch (Step 4 correction)

The normal wallet top-up flow has a **user-facing integration mismatch**, not merely a dormant security check:

1. `AddCreditsModal.tsx` calls `wallet-topup-intent` → creates PENDING WalletTransaction + Stripe PaymentIntent
2. `wallet-topup-intent` passes `transactionId` and `walletId` to `createPaymentIntent()` but NOT `userId`
3. `createPaymentIntent` only stamps `metadata.userId` if the caller supplies it — so this PaymentIntent has no `userId`
4. After payment succeeds, `AddCreditsModal.tsx` calls `wallet-add`
5. `wallet-add` requires `metadata.userId` to match `session.user.id` — returns **HTTP 403** because metadata is absent
6. **The customer sees "adding credits failed"** — but the Stripe webhook has already independently confirmed the pending transaction and credited the wallet

**Result:** the wallet is credited successfully (via webhook) while the customer-facing UI reports failure. This is an integration mismatch between the client-pull confirmation path and the webhook confirmation path. A cross-user exploitation scenario has not been demonstrated by this trace.

**Assessment needed:** either supply the authenticated user ID consistently to `wallet-topup-intent` (so `wallet-add` can serve as client-pull confirmation with ownership enforced), or remove the redundant client-pull path and rely on the webhook.

### 1.9 Ledger and financial reconciliation (Step 5, expanded)

The `FinancialLedger` double-entry table is written by `recordWalletCredit()`, `recordBookingPayment()`, `recordFullRefund()`, `recordPartialRefund()`, and `recordAdminWalletAdjustment()`. Coverage analysis:

| Flow | FinancialLedger call | Status |
|---|---|---|
| Plain PaymentIntent top-up webhook | `recordWalletCredit()` | ✅ Covered |
| Book Later Checkout package credit (webhook) | No `recordWalletCredit()` call | ❌ Missing |
| Book Now package credit (webhook) | No `recordWalletCredit()` call | ❌ Missing |
| Client multi-booking wallet debit (`create-bulk`) | No `recordBookingPayment()` call | ❌ Missing |
| Older package-child confirmation | No `recordBookingPayment()` call | ❌ Missing |
| Admin manual credit/debit | No `recordAdminWalletAdjustment()` call | ❌ Missing (function exists but never called) |
| `cancelBooking` wallet refund | `recordFullRefund()`/`recordPartialRefund()` | ✅ Covered (after tx, non-critical) |
| `approveCancellation` card refund | `REFUND_ISSUED` LedgerEntry | ✅ Covered |

**Five of eight wallet-affecting flows do not write to the FinancialLedger.** The double-entry ledger balance for `CLIENT_WALLET` will diverge from the `WalletTransaction`-derived balance after any of these flows execute. A complete reconciliation of expected entries against actual application writes is needed.

### 1.10 Expiry implementation status (Step 1 correction)

**No current purchase path writes an expiry date.** Specifically:
- `app/api/public/bookings/bulk/route.ts` does NOT set `packageExpiryDate` when creating the package Booking
- `app/api/stripe/webhook/route.ts` does NOT set `packageExpiryDate` in either the Book Later or Book Now package-credit handler
- `WalletTransaction` has no expiry field
- `PlatformSettings` has no `walletCreditValidityMonths` field

The `packageExpiryDate` field exists on `Booking` and is READ by package listing, scheduling, and notification routes — but no code WRITES it. Existing package records likely have `packageExpiryDate = null`.

**`getWalletBalance()` includes every confirmed credit regardless of purchase date.** No expiry check exists in the balance calculation or in the booking creation path.

### 1.11 Account closure (Step 6, corrected)

- **No self-service User deletion endpoint exists.** Account deletion requests go through support email and are not automatically processed.
- `ClientWallet`/`WalletTransaction` have `onDelete: Cascade` from User — a physical User deletion would hard-delete wallet data (latent data-loss risk, not an active customer-facing defect)
- **Terms of Service clause 22** promises: "Upon account closure, unused wallet balance will be refunded to the original payment method (minimum $10.00)"
- **No application settlement/refund workflow implements this promise**
- The cascade-delete is a latent risk that would destroy evidence and prevent settlement if triggered

### 1.12 Balance calculation

- Derived is authoritative: `getWalletBalance` sums CONFIRMED WalletTransactions (CREDIT − DEBIT)
- **Does not exclude expired credits** — no expiry check exists
- `ClientWallet.balance` stored field drifts (only updated by some paths)
- `reconcileWalletBalance` exists to correct drift but is not called automatically on every path

### 1.13 Spend-time expiry checks (Step 1 — source file 6, source-verified)

The reviewer asked whether any booking path independently blocks expired value despite `getWalletBalance()` not checking expiry. Source inspection of all spend paths:

| Route | Expiry check? | Details |
|---|---|---|
| `create-bulk` (main booking path) | **NO** | Checks aggregate wallet balance only; no expiry check of any kind |
| `schedule-package-hours` (older flow) | **YES, but dormant** | Checks `packageExpiryDate` — but since no purchase path writes this field, it is always null → the `if (packageExpiryDate && ...)` guard is always false → check never fires |
| `confirm-package-booking` (older flow) | **NO** | Only sets `packageStatus` to 'completed'/'active' based on hours consumed; no expiry check |
| `getWalletBalance()` (wallet helper) | **NO** | Sums all confirmed credits regardless of date |
| Package listing API (`client/packages/route.ts`) | Display only | Shows `isExpired` status to user but does not block spending |

**Conclusion: No booking path independently blocks expired value.** The one path with an expiry check (`schedule-package-hours`) can never fire because `packageExpiryDate` is never written by any purchase path. The main booking path (`create-bulk`) does not check expiry at all.

This means that even if a daily cron were to mark `packageStatus = 'expired'` on a `Booking` row, the student's wallet credit from that purchase would remain spendable through the `create-bulk` route, which neither checks `packageExpiryDate` nor `packageStatus`.

### 1.14 Step 1 consolidated result

The product rule is confirmed. The implementation does not support it. This is a source-level finding at commit `fea62e35`.

| Requirement | Source evidence | Result |
|---|---|---|
| Expiry starts at successful payment | Webhook identifies successful payment | Payment event exists |
| Expiry date saved per purchase | Neither package webhook creates it | **Missing** |
| Plain top-up expiry | PaymentIntent handler only confirms transaction | **Missing** |
| Expiry configurable centrally | PlatformSettings has no validity-month setting | **Missing** |
| Expired credit excluded from balance | `getWalletBalance()` includes all confirmed credits | **Missing** |
| Partial spending tracked per purchase | No credit-lot allocation relation | **Missing** |
| Expiry job removes unused value | Job only updates package status | **Missing** |
| Spend-time expiry enforcement | No booking path checks expiry | **Missing** |

**Step 1 status: source investigation complete.** The product rule is clear; the existing implementation does not support it at any stage — purchase, storage, balance calculation, or spend enforcement.

The appropriate design direction remains a pooled dollar wallet with independently expiring purchase lots. Do not implement yet: first settle how existing credits, partial spending, refunds and promotional credits are represented.

### 1.13 Confirmed gaps against product rules

| Product rule | Current code | Gap |
|---|---|---|
| Per-purchase expiry, 12 months from payment confirmation | No expiry field on `WalletTransaction`; `packageExpiryDate` never written by any purchase path | No expiry is persisted or enforced |
| `getWalletBalance` must exclude expired credits | Includes all CONFIRMED credits regardless of date | Expired credit remains spendable |
| Configurable expiry via `PlatformSettings` | No `walletCreditValidityMonths` setting | Hardcoded nowhere — expiry is entirely unimplemented |
| Each purchase expires independently | No per-purchase tracking on WalletTransaction | Cannot enforce per-purchase expiry |
| Debits allocated to specific purchase credits | One aggregated DEBIT, no per-purchase allocation | Cannot determine remaining value per purchase |
| `lockedHourlyRate` on bookings | Not populated in `create-bulk` route | Auditability gap (saved price provides booking-time amount) |
| Consistent expiry messaging | 4+ contradictory statements across Terms, API, UI | Customer-facing text conflicts with product rule |

---

## 2. Wallet Funds-Flow Diagram

### 2.1 Top-up / package purchase flow

```
Student ──pays──> DriveBook Stripe account (platform)
                   │
                   ▼ payment confirmed (webhook)
DriveBook credits ClientWallet
  ├── WalletTransaction(CREDIT, faceValue)     [spendable, NO expiry date]
  ├── WalletTransaction(PLATFORM_SUBSIDY)       [audit-only, non-spendable]
  └── Transaction(PACKAGE_FEE, platformFee)     [non-refundable revenue]
  
DriveBook now holds: cash (in Stripe balance)
DriveBook owes client: faceValue (wallet liability)
DriveBook's revenue: platformFee (retained)
DriveBook's subsidy cost: faceValue − amountPaid (promotional)
NO expiry date written anywhere
```

### 2.2 Wallet-funded booking flow

```
ClientWallet (aggregate balance)
  ├── create-bulk: checks aggregate balance ≥ total cost
  │   └── Inside transaction: creates individual bookings, one aggregated DEBIT
  │       (no per-booking attribution, no per-purchase allocation)
  │
  ├── FinancialLedger: NO recordBookingPayment() call (gap)
  │
  └── Provider does NOT receive funds from wallet
      Provider's earnings accrue in INSTRUCTOR_PAYABLE ledger account
      Provider is paid weekly via Stripe Connect Payout (separate from wallet)
```

### 2.3 Cancellation refund flows

```
Path A (authenticated cancel → cancelBooking):
  Wallet CREDIT back → student can re-use for other lessons ✅

Path B (public cancel — wallet-funded booking):
  Case 1: paymentIntentId = null → logs warning, NO refund ❌
  Case 2: paymentIntentId = synthetic "package-..." → Stripe refund fails ❌
  No wallet credit issued in either case

Path C (admin package cancel → approveCancellation):
  Card refund → student gets cash back
  Wallet DEBIT → reverses the face-value credit
  PACKAGE_FEE → retained (non-refundable)
```

---

## 3. Architecture Reframing

### 3.1 The pooled wallet is intentional, not a defect

The product owner has confirmed: a pooled student wallet is the intended marketplace design. Packages are provider-independent. Individual bookings identify their selected providers. The absence of `providerId` on `ClientWallet` or `WalletTransaction` is **not** a defect.

Provider-restricted wallets should not be treated as the marketplace baseline. Custody, legal obligations, and accounting are separate questions.

### 3.2 The real architecture problem: credit-lot tracking

The current code's aggregate calculation — all confirmed credits minus all confirmed debits — cannot independently establish remaining value for each purchase. The product rules require:

1. **Each purchase creates a credit lot** with its own expiry date (12 calendar months from payment confirmation)
2. **Debits must be allocated** to the relevant purchase credit and booking
3. **At expiry, DriveBook must determine how much of each purchase remains** and remove or forfeit it
4. **`getWalletBalance()` must exclude expired credits** at spend time, not just rely on a cron

This requires a **credit-lot model**:
- Each `WalletTransaction(CREDIT)` gets its own `expiryDate` field
- Each `WalletTransaction(DEBIT)` references the specific credit lot(s) it consumes
- `getWalletBalance()` sums only non-expired credit lots minus their allocated debits
- A daily cron marks expired credit lots and removes their remaining value from the spendable balance
- The application enforces expiry at spend time by checking each credit lot's `expiryDate` — not depending on the cron running at the exact expiry moment

### 3.3 Legal, regulatory, and accounting questions

These require professional assessment before the architecture is finalised:

1. Is the wallet a "stored value facility" under Australian law?
2. Does commingling wallet funds with platform revenue create a fiduciary breach?
3. What consumer protection obligations apply to forfeited/expired balances?
4. Is the "face-value crediting" model (crediting more than the customer paid) legally sound?
5. What happens to wallet funds if DriveBook becomes insolvent?
6. Are the contradictory expiry statements across Terms of Service, privacy page, API, and UI a consumer law violation?
7. Does Terms of Service clause 22 (refund on closure) require a settlement workflow?

---

## 4. Implementation Risks

| Risk | Description | Severity |
|---|---|---|
| R1 | Wallet-funded bookings cancelled via public route get no refund (null or synthetic paymentIntentId) | Medium — customer loses funds |
| R2 | Admin manual adjustments don't write to FinancialLedger | Medium — ledger drift, audit gap |
| R3 | 5 of 8 wallet flows don't write FinancialLedger entries | Medium — double-entry ledger unreliable |
| R4 | P0-01 integration mismatch: customer sees "failed" while wallet is credited | Medium — user-facing error |
| R5 | No expiry date written by any purchase path | High — product rule cannot be enforced |
| R6 | `getWalletBalance` includes all confirmed credits regardless of date | High — expired credit spendable |
| R7 | No account closure settlement flow (Terms clause 22 unimplemented) | Medium — legal promise without implementation |
| R8 | No per-purchase credit-lot tracking — debits not allocated to purchases | High — cannot determine per-purchase remaining value |
| R9 | `ClientWallet.balance` stored field drifts from authoritative aggregate | Low — all reads use aggregate |
| R10 | 4+ contradictory expiry statements across customer-facing surfaces | Medium — consumer law risk |

---

## 5. Acceptance Criteria

Before WLA-005 can be closed:

- [ ] Credit-lot model designed: each `WalletTransaction(CREDIT)` has its own `expiryDate`
- [ ] `getWalletBalance()` excludes expired credit lots at spend time
- [ ] `walletCreditValidityMonths` added to `PlatformSettings`
- [ ] Debits allocated to specific purchase credit lots
- [ ] Wallet-funded booking cancellation defect (Path B) fixed
- [ ] All 8 wallet flows write FinancialLedger entries
- [ ] P0-01 integration mismatch resolved (supply userId or remove client-pull path)
- [ ] Account closure settlement flow defined or Terms clause 22 revised
- [ ] Contradictory expiry messaging unified across all customer-facing surfaces
- [ ] Legal assessment of wallet fund ownership, custody, and regulatory status obtained
- [ ] `confirm-package-booking` production caller status determined (active or deprecated)
- [ ] SaaS/DIRECT wallet scope defined (after WLA-002 resolution)

---

## 6. Investigation Status

| Step | Subject | Status | Notes |
|---|---|---|---|
| 1 | Purchase and expiry | **Source investigation complete** | Product rule confirmed; implementation does not support it at any stage — purchase, storage, balance, or spend enforcement. 8 source files traced. |
| 2 | Cross-provider booking | **Partially verified** | Pooled wallet confirmed; `lockedHourlyRate` framing corrected; `confirm-package-booking` caller status unresolved |
| 3 | Refunds and cancellations | **Verified with qualifications** | Three paths traced; public cancel defect confirmed; synthetic paymentIntentId case added |
| 4 | Top-ups and ownership | **Verified; conclusion corrected** | P0-01 is a user-facing integration mismatch, not a dormant check |
| 5 | Ledger and reconciliation | **Further investigation needed** | 5 of 8 flows missing FinancialLedger calls; complete reconciliation required |
| 6 | Account closure | **Partially verified** | No self-service deletion; cascade is latent risk; Terms clause 22 unimplemented |
| 7 | Architecture decision | **Pending** | Credit-lot model proposed; legal assessment required |

**Next work:** Step 5 — reconcile the actual double-entry ledger. Complete the expected-vs-actual FinancialLedger entry analysis for all 8 wallet flows.

---

*This document is an architecture decision record. No code changes are implemented here. WLA-005 remains OPEN — SOURCE INVESTIGATION AND RECONCILIATION IN PROGRESS.*
