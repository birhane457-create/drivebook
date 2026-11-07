# WLA-005 — Wallet Ownership Architecture Decision

**Finding ID:** WLA-005  
**Category:** ARCHITECTURAL  
**Original finding:** "Wallet balance is currently user-wide, not provider-attributed; whether that is a defect depends on the approved white-label wallet contract."  
**Status:** OPEN — ARCHITECTURE DECISION REQUIRED  
**Authored:** 2026-11-06  
**Source inspected:** commit `7df9f946` (origin/main)

---

## 1. Current-State Source Evidence

### 1.1 Database schema (source-verified)

**ClientWallet** (`prisma/schema.prisma`):
- `userId String @unique` — one wallet per User (1:1)
- `balance Decimal @default(0)` — a **cached** balance, NOT authoritative
- `onDelete: Cascade` from User
- **No `providerId`** — the wallet is strictly per-user, not partitioned by provider

**WalletTransaction** (`prisma/schema.prisma`):
- `walletId`, `amount`, `type` (`CREDIT` | `DEBIT` | `PLATFORM_SUBSIDY`), `status` (`PENDING` | `CONFIRMED` | `EXPIRED`)
- `bookingId String?` — links to the booking that caused the debit
- **No `providerId`** — transactions are not attributed to any provider
- DB unique index on `metadata->>'stripePaymentIntentId'` (prevents concurrent double-credit, P0-01B fix)
- **No expiry date field** — wallet credits do not carry their own expiry; expiry is tracked on `Booking.packageExpiryDate` (parent package row only)

**No provider wallet exists.** Only `ClientWallet` (per-User). Providers are compensated through the `Payout`/Stripe Connect flow, tracked in `FinancialLedger` under `INSTRUCTOR_PAYABLE`/`INSTRUCTOR_PAID` accounts — completely separate from client wallets.

### 1.2 Where money is held

All wallet top-up and package payment flows use `new Stripe(process.env.STRIPE_SECRET_KEY!)` — DriveBook's **platform Stripe account**. Not the instructor's Connect account. Funds settle into DriveBook's Stripe balance.

The wallet balance is an **accounting liability** of DriveBook to the client — a contractual credit redeemable for lessons. It is **not** a segregated cash holding. It blends:
1. Real cash the client paid (held in DriveBook's Stripe balance)
2. DriveBook-funded promotional subsidy (the discount residual on packages — not backed by cash received)
3. Minus the non-refundable platform fee (already recognized as revenue via `PACKAGE_FEE` Transaction)

### 1.3 Wallet top-up flows

**Path A — Package purchase via Stripe Checkout (primary):**
- Client buys package → Stripe Checkout Session with `metadata.type='wallet_credit'`
- On `checkout.session.completed` webhook: validates payment, then inside SERIALIZABLE transaction credits wallet with **face value** (undiscounted total, e.g. $700 for 10h@$70 even if customer paid $630)
- Creates three records atomically:
  1. `WalletTransaction(CREDIT, faceValue, CONFIRMED)` — spendable; **no expiry date field**
  2. `WalletTransaction(PLATFORM_SUBSIDY, faceValue − amountPaid)` — audit-only, non-spendable
  3. `Transaction(PACKAGE_FEE, platformFee, SETTLED)` — non-refundable platform revenue
- **Expiry date stored on the parent `Booking` row** (`packageExpiryDate = purchase_date + 365 days`), not on the `WalletTransaction`

**Path B — Plain top-up via PaymentIntent:**
- `POST /api/client/wallet-topup-intent` creates a PENDING WalletTransaction, then a Stripe PaymentIntent
- On `payment_intent.succeeded` webhook: validates amount, flips PENDING → CONFIRMED
- **No expiry date** — plain top-ups never expire (no `packageExpiryDate` equivalent for top-ups)

**Path C — Client-pull confirmation via wallet-add:**
- `POST /api/client/wallet-add` re-fetches PaymentIntent from Stripe, enforces P0-01 ownership check
- P0-01 gap: `wallet-topup-intent` does NOT pass `userId` to `createPaymentIntent`, so the ownership check fails-closed for plain top-ups; plain top-ups confirmed through the webhook

### 1.4 Confirmed product rules (Steps 1–2, 2026-11-06)

| Rule | Decision |
|---|---|
| Expiry period | 12 calendar months (not 365 days) |
| Expiry start | Successful payment confirmation only |
| Expiry type | Each purchase expires independently |
| Activity | Does not reset expiry |
| Cross-provider spending | Supported — pooled wallet, any instructor |
| Cron frequency | Daily acceptable on current hosting plan |
| Configuration | `walletCreditValidityMonths` in `PlatformSettings` |
| Rate changes | Do not change an already confirmed booking |
| Existing purchases on policy change | New policy affects new purchases only |

### 1.5 Wallet-funded bookings (`create-bulk` route, source-verified)

`app/api/client/bookings/create-bulk/route.ts` (Step 2 source inspection):
1. Identifies student from authenticated session
2. Accepts multiple cart items, each with its own `providerId`
3. Fetches hourly rate for each instructor; recalculates price server-side
4. Loads one wallet using student's `userId` (pooled, cross-provider)
5. Checks combined booking cost against aggregate wallet balance
6. Creates individual bookings for each instructor inside a transaction
7. Creates **one aggregated wallet DEBIT** for the combined cost (no per-booking breakdown, no per-purchase allocation)
8. `lockedHourlyRate` is **NOT populated** in the `create-bulk` route — `booking.price` is stored but not the locked rate field

**Cross-provider spending is confirmed at source.** A student can spend wallet credit on different instructors in the same transaction.

**Balance check does not exclude expired credit** — `getWalletBalance` sums all CONFIRMED credits regardless of purchase date.

### 1.6 Package lesson confirmation (`confirm-package-booking` route)

`app/api/client/confirm-package-booking/route.ts` — **has active callers** (referenced in test suites `h02-child-booking-pricing.test.ts`, `h02b-confirm-package-booking.test.ts`, and mentioned in mobile route).

This route uses the **older package-child confirmation flow** with hour counters as an additional limit, separate from the bulk-booking flow. It is a separate mechanism that still exists and is used.

### 1.7 Booking cancellations and refunds (Step 3, source-verified)

Three entry points with materially different refund behavior:

**Entry point A — `POST /api/bookings/[id]/cancel` (authenticated, delegates to `cancelBooking()`):**
- `cancelBooking` (booking-service.ts) issues a **wallet CREDIT** for the refund amount
- SECURITY: only issues credit if `booking.source === 'platform'` (offline bookings excluded)
- Uses `calculatePartialPackageRefund` for package bookings (tier-aware, capped at `totalPaid − platformFee`)
- Time policy: 48h+ = 100%, 24–48h = 50%, <24h = 0%
- **Wallet-funded bookings: wallet credit issued correctly**
- Creates `REFUND_APPROVAL_TASK` for post-payout refunds > 24h
- FinancialLedger `recordFullRefund`/`recordPartialRefund` runs after the transaction (non-critical)

**Entry point B — `POST /api/public/bookings/[id]/cancel` (voice agent / self-service):**
- Cancels the booking atomically via `updateMany` status guard
- Issues **Stripe card refund** if `booking.isPaid && refundAmount > 0 && paymentIntentId`
- **Wallet-funded bookings: no refund** — `console.warn("No paymentIntentId — refund must be processed manually")` — no wallet credit, no Stripe refund
- **Source-confirmed defect:** a student who booked using wallet credit and cancels via the public/voice route receives nothing

**Entry point C — `approveCancellation()` (admin-approved package cancellations):**
- Atomic CAS on `cancellationStatus: PENDING → APPROVING` prevents concurrent admin approvals
- Issues **Stripe card refund** first, then in a transaction creates a wallet **DEBIT** to reverse the face-value credit
- Requires `booking.paymentIntentId` — throws "No payment intent found - cannot issue Stripe refund" if missing
- `PACKAGE_FEE` Transaction is retained (non-refundable)

### 1.8 Administrative credits and adjustments

- Admin routes require RBAC `FINANCE_CREDITS_MANAGE` permission and `Idempotency-Key` header
- Claim-first idempotency via `AdminWalletIdempotencyKey`
- Audit trail: `AuditLog` row + receipt email + `WalletTransaction`
- **Gap:** admin routes do NOT call `recordAdminWalletAdjustment` — no `FinancialLedger` double-entry

### 1.9 Expiry and account closure

**Package expiry (source-verified):**
- `packageExpiryDate` stored on `Booking` (parent package row), set to `purchaseDate + 365 days` — hardcoded, not from `PlatformSettings`
- `packageExpiryAlerts.ts` sends notifications saying "unused wallet credit has been forfeited"
- **No financial action taken.** The wallet `WalletTransaction` credit remains CONFIRMED and spendable
- Scheduling new lessons from an expired package is blocked; dollar balance is not removed
- The notification overstates what the code actually does — misleading

**Account closure / provider suspension:**
- No code debits/settles wallet balances on closure
- `onDelete: Cascade` from User — hard-deletes wallet and all transactions (data loss, no settlement)

### 1.10 Balance calculation and ledger coverage

- Derived is authoritative: `getWalletBalance` sums CONFIRMED WalletTransactions (CREDIT − DEBIT)
- **Does not exclude expired credits** — no expiry check in `getWalletBalance`
- `ClientWallet.balance` stored field drifts (only updated by some paths)
- Admin manual adjustments do not write to `FinancialLedger` (gap)

### 1.11 Confirmed gaps against product rules (Steps 1–2)

| Product rule | Current code | Gap |
|---|---|---|
| Expiry per purchase, 12 calendar months from payment confirmation | Expiry on parent `Booking` row only, 365 days hardcoded, no per-WalletTransaction expiry | WalletTransaction has no expiry date; plain top-ups never expire |
| `getWalletBalance` must exclude expired credits | `getWalletBalance` includes all CONFIRMED credits regardless of date | Expired credit remains spendable |
| Configurable expiry via `PlatformSettings` | `packageExpiryDate = +365 days` hardcoded in webhook | No `walletCreditValidityMonths` setting exists |
| Each purchase expires independently | No per-purchase expiry field on WalletTransaction | Cannot enforce per-purchase expiry |
| `lockedHourlyRate` on bookings | Not populated in `create-bulk` route | Rate-lock requirement partially unmet |
| Expiry starts at payment confirmation | `packageExpiryDate` set in webhook `checkout.session.completed` (correct path) | Correct for packages; plain top-ups have no expiry at all |

---

## 2. Wallet Funds-Flow Diagram

### 2.1 Top-up / package purchase flow

```
Student ──pays──> DriveBook Stripe account (platform)
                   │
                   ▼ payment confirmed (webhook)
DriveBook credits ClientWallet
  ├── WalletTransaction(CREDIT, faceValue)     [spendable]
  ├── WalletTransaction(PLATFORM_SUBSIDY)       [audit-only, non-spendable]
  └── Transaction(PACKAGE_FEE, platformFee)     [non-refundable revenue]
  
DriveBook now holds: cash (in Stripe balance)
DriveBook owes client: faceValue (wallet liability)
DriveBook's revenue: platformFee (retained)
DriveBook's subsidy cost: faceValue − amountPaid (promotional)
```

### 2.2 Wallet-funded booking flow

```
ClientWallet (balance $700)
  ├── createBooking: checks aggregate balance ≥ price
  │   └── Inside $transaction: re-verifies, creates DEBIT WalletTransaction
  │       (ClientWallet.balance stored field NOT updated — drifts)
  │
  ├── FinancialLedger: CLIENT_WALLET → PLATFORM_ESCROW → PLATFORM_REVENUE + INSTRUCTOR_PAYABLE
  │
  └── Provider does NOT receive funds from wallet
      Provider's earnings accrue in INSTRUCTOR_PAYABLE ledger account
      Provider is paid weekly via Stripe Connect Payout (separate from wallet)
```

### 2.3 Cancellation refund flows

```
Path A (cancelBooking):
  Wallet CREDIT back → student can re-use for other lessons
  FinancialLedger: reverses CLIENT_WALLET → ESCROW entries

Path B (public cancel — wallet-funded booking):
  ❌ NO automatic refund (no paymentIntentId to refund to card)
  Logs "refund must be processed manually"

Path C (admin package cancel):
  Card refund → student gets cash back
  Wallet DEBIT → reverses the face-value credit
  PACKAGE_FEE → retained (non-refundable)
```

---

## 3. Ownership and Responsibility Analysis

### 3.1 Who owns the wallet funds?

**Current state:** DriveBook owns and holds all wallet funds. The client has a contractual credit (a liability DriveBook owes them), not a segregated cash holding. The funds are commingled in DriveBook's Stripe balance with platform revenue.

| Question | Current answer |
|---|---|
| Who legally owns the wallet funds? | **Undetermined** — DriveBook holds the cash, but legal ownership depends on the terms of service and Australian consumer law |
| Who holds the funds? | DriveBook's Stripe platform account |
| Who controls credits? | DriveBook (via webhooks for Stripe payments; via admin routes for manual adjustments) |
| Who controls debits? | DriveBook (via booking creation and package confirmation routes) |
| Who bears refund responsibility? | DriveBook (for wallet credit refunds) or the student's card (for card refunds) |
| Who bears reconciliation responsibility? | DriveBook (via FinancialLedger double-entry, but coverage is partial) |
| Is the wallet provider-attributed? | **No** — one wallet per user, pooled across all instructors |
| Is the wallet balance segregated cash? | **No** — commingled in DriveBook's Stripe balance |

### 3.2 Legal and regulatory questions requiring professional confirmation

1. **Is the wallet a "stored value facility" under Australian law?** If DriveBook holds customer prepaid funds, it may be subject to AUSTRAC reporting, e-money regulation, or financial services licensing requirements.
2. **Does commingling wallet funds with platform revenue create a fiduciary breach?** If wallet funds are not segregated, DriveBook may be using customer prepaid money to fund operations, which may be legally problematic.
3. **What are the consumer protection obligations for forfeited balances?** The `WALLET_TERMS.md` says balances "may be forfeited" on closure, but Australian Consumer Law may override this for services not delivered.
4. **Is the "face-value crediting" model legally sound?** The wallet is credited with more than the customer paid (face value > discounted price), and the promotional subsidy is non-refundable. This is a creative accounting approach that may have legal implications.
5. **What happens to wallet funds if DriveBook becomes insolvent?** If funds are commingled, customers may lose their prepaid balances.
6. **Is the package-expiry notification ("forfeited") misleading under Australian Consumer Law?** The code says "forfeited" but doesn't actually forfeit the balance — this is a gap between communicated and actual behavior.

---

## 4. Risks and Unresolved Assumptions

### 4.1 Implementation risks

| Risk | Description | Severity |
|---|---|---|
| R1 | Wallet-funded bookings cancelled via public route get no refund | Medium — customer may lose funds |
| R2 | Admin manual adjustments don't write to FinancialLedger | Medium — ledger drift, audit trail gap |
| R3 | Package expiry notification says "forfeited" but balance remains spendable | Low — misleading but not financially harmful to customer |
| R4 | P0-01 ownership check dormant for plain top-ups | Medium — security gap mitigated by server-side walletId |
| R5 | No account closure settlement flow | Medium — cascade-delete loses wallet data without settlement |
| R6 | `ClientWallet.balance` stored field drifts from authoritative aggregate | Low — all reads use aggregate, but direct reads of stored field are wrong |
| R7 | No provider attribution on wallet transactions | Architectural — current design is user-wide, not per-provider |

### 4.2 Unresolved assumptions

1. **Legal ownership of wallet funds** — not determined; requires legal/tax assessment
2. **Whether the wallet is a regulated stored-value facility** — requires AUSTRAC/legal assessment
3. **Whether wallet funds must be segregated** — requires legal assessment
4. **Whether the face-value crediting model is legally sound** — requires legal assessment
5. **Whether WLA-002's DIRECT payment model affects wallet ownership** — SaaS/DIRECT wallet functionality is out of scope until WLA-002 is resolved
6. **Whether providers should have visibility into their clients' wallet balances** — current design: no provider attribution

---

## 5. Architecture Options

### Option 1 — Maintain current user-wide wallet (status quo)

The wallet remains per-user, pooled across all instructors. DriveBook holds all funds in its platform Stripe account. The wallet is a contractual credit, not segregated cash.

**Advantages:** Simple; no schema changes; existing code works; familiar to users (like a store credit).
**Disadvantages:** No provider attribution; DriveBook bears all custody risk; commingled funds; legal questions about stored-value regulation; wallet-funded booking cancellation gap (Path B).

### Option 2 — Provider-attributed wallet balances

Wallet remains per-user but transactions carry a `providerId`. The balance is partitioned by provider — a client's $700 wallet shows "$400 with Instructor A, $300 with Instructor B."

**Advantages:** Provider can see their clients' prepaid balances; clearer attribution for refunds; supports future SaaS/DIRECT model where provider manages their own clients.
**Disadvantages:** Complex schema migration; breaks the "any instructor, any lesson" flexibility; requires partitioning logic in every wallet read; doesn't solve the custody or legal questions.

### Option 3 — Segregated client funds (trust account model)

Wallet funds are held in a separate Stripe account or trust account, not commingled with DriveBook's operational revenue. The wallet represents actual cash held in trust for the client.

**Advantages:** Clearer legal separation; addresses commingling risk; may satisfy regulatory requirements for stored-value facilities.
**Disadvantages:** Requires a separate Stripe account or trust structure; complex fund movement (separate account → instructor payout); requires legal and tax assessment; Stripe may not support this directly without a custom integration.

### Option 4 — No wallet; direct payment per booking (remove prepaid model)

Eliminate the wallet entirely. Every booking is paid by card at booking time. Packages become pre-paid lesson credits tracked as hours, not as dollar balances.

**Advantages:** Eliminates all custody, commingling, and stored-value regulatory questions; simplest fund flow; each payment goes directly to the booking.
**Disadvantages:** Major schema and code changes; loses the "prepaid convenience" feature; package discount model would need restructuring; existing users would need wallet balances refunded.

---

## 6. Recommended Next Steps

1. **Do not change current PLATFORM wallet behaviour** until an approved architecture decision is made
2. **Obtain legal/tax assessment** on questions in section 3.2 before choosing an option
3. **Fix the wallet-funded booking cancellation gap** (Path B) regardless of architecture decision — this is a defect, not an architecture question
4. **Fix the admin adjustment FinancialLedger gap** — admin credits/debits should write double-entry entries
5. **Fix the package expiry notification** — either implement actual forfeiture or change the notification wording
6. **Keep SaaS/DIRECT wallet functionality out of scope** until WLA-002 is resolved
7. **Document the wallet terms** accurately — the current `WALLET_TERMS.md` must match the actual implementation

---

## 7. Acceptance Criteria

Before WLA-005 can be closed:

- [ ] Legal assessment of wallet fund ownership, custody, and regulatory status obtained
- [ ] Architecture option selected and approved by product owner
- [ ] Wallet-funded booking cancellation gap (Path B) fixed or documented as accepted limitation
- [ ] Admin adjustment FinancialLedger gap fixed or documented as accepted limitation
- [ ] Package expiry notification aligned with actual behavior
- [ ] Account closure settlement flow defined or explicitly deferred
- [ ] SaaS/DIRECT wallet scope defined (after WLA-002 resolution)
- [ ] Wallet terms of service reviewed by legal counsel

---

*This document is an architecture decision record. No code changes are implemented here. WLA-005 remains OPEN — ARCHITECTURE DECISION REQUIRED.*
