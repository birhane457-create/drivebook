# WLA-002 — Provider Settlement Semantics: Architecture Decision Record

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary whose absence will become a code defect when DIRECT mode is activated.  
**Status:** ARCHITECTURE DECISION DEFINED — pending reviewer acceptance  
**Authored:** 2026-11-06  
**Source inspected:**  
- `lib/utils/account.ts` — `assertPlatformPaymentMode()`, `getAccountFeatures()`  
- `lib/services/payout-service.ts` — `buildPayout()`, `executePayout()`, `recordPaymentCollected()`, `recordRefundIssued()`  
- `lib/services/ledger-service.ts` — `LedgerEntryType`, `PlatformLedger`, `availableBalance`  
- `lib/services/saas-payment.ts` — `createCheckoutSession()`, `applicationFeeAmount`  
- `lib/services/platform-pricing.ts` — `getCommissionRate()`, `getPlatformFeeRate()`  
- `lib/services/chargebackAutomation.ts` — dispute webhook handlers  
- `app/api/stripe/webhook/route.ts` — `payment_intent.succeeded`, `charge.refunded`  
- `app/api/payments/create-intent/route.ts` — PLATFORM PaymentIntent, inline DIRECT guard  
- `app/api/public/bookings/bulk/route.ts` — inline DIRECT guard  
- `app/api/client/quotes/[id]/accept/route.ts` — inline DIRECT guard  
- `docs/newplan/PAYMENT-WHITE-LABEL.md` — DIRECT mode design spec  
- `docs/DOCROLEBASE/06-payments/PAYMENT_MODES.md` — current mode documentation  
- `docs/audit/MONEY-MOVEMENT-INVENTORY.md` — MM-10-A, MM-10-B, MM-10-C  
- `prisma/schema.prisma` — Provider, Booking, Transaction, LedgerEntry, PlatformLedger, PlatformSettings  

---

## 1. Original Finding

> "Provider-settlement requirements for the proposed white-label mode are not yet specified.
> Existing SaaS quote charges settle to the DriveBook platform by design; this overlaps
> historical MM-10-A and is not, by itself, a confirmed defect in the current PLATFORM
> architecture."
>
> *Resolution guidance: Reconcile against MM-10-A and the approved white-label product
> contract. Define whether and when provider settlement is required; do not duplicate MM-10-A
> or change current PLATFORM behaviour without a separate approved design.*
>
> — `docs/audit/WLA-FINDINGS-BRANCH.md`, WLA-002 row

MM-10-A (SUPERSEDED/closed in tracker) confirmed that SaaS money landing on the platform
account is intentional current architecture, not a security defect. This decision record
extends that by specifying the boundary rules that must hold when DIRECT mode is eventually
activated.

---

## 2. Current PLATFORM Settlement — Source-Verified State

### 2.1 Fund Flow (PLATFORM mode, driving bookings)

```
Student pays
  → DriveBook Stripe account (PaymentIntent, AUD)
  → payment_intent.succeeded webhook
      → PlatformLedger.totalCollected += fullAmount
      → PlatformLedger.totalReserved  += fullAmount
      → Booking.status = CONFIRMED
      → Transaction.status = SETTLED

After lesson + dispute buffer (48h default, 2 × lateCancellationWindowHours):
  → buildPayout()
      → grossAmount = Σ(Transaction.providerPayout)        [already net of commission]
      → ADJUSTMENT deductions for any post-payout refunds
      → withholdingTax = grossAmount × Provider.withholdingTaxRate
      → netAmount = grossAmount − withholdingTax
      → Payout record created (ELIGIBLE)

executePayout():
  → assertSufficientBalance(netAmount)
  → verifyPayoutDestinationOwnership()                    [PAY-01 fix]
  → stripe.transfers.create({ destination: verifiedAccountId, amount: netAmount })
  → Payout.status = PAID
  → PlatformLedger.totalPaidOut      += netAmount
  → PlatformLedger.totalReserved     -= grossAmount
  → PlatformLedger.totalTaxWithheld  += withholdingTax
  → LedgerEntry: PAYOUT_PAID (negative, provider-scoped)
```

### 2.2 Fee Structure (PLATFORM mode, example: BASIC tier, $75 lesson)

| Field | Amount | Source |
|---|---|---|
| Student pays | $75.00 | Full lesson price |
| `platformFeeRate` (3.6%) | $2.70 | `PlatformSettings.platformFeePercentage` — Stripe processing surcharge, collected from student, net to DriveBook |
| `commissionRate` (15% BASIC) | $11.25 | `PlatformSettings.basicCommissionRate` — DriveBook marketplace commission |
| `providerPayout` | $63.75 | Stored on `Booking` and `Transaction` |
| Withholding tax (47% default) | $29.96 | Applied at payout time on providerPayout |
| Net transfer to instructor | $33.79 | Stripe Connect transfer |

**Naming note:** `Booking.platformFee` stores the 3.6% processing surcharge amount, not the
commission. `Booking.commissionRate` stores the tier-based DriveBook commission percentage.
`Booking.providerPayout` is the net amount after commission only (withholding tax applied
later at payout time, not booking time).

### 2.3 Merchant of Record

In PLATFORM mode, **DriveBook is the merchant of record** for every transaction:
- Student's card statement: `DRIVEBOOK.COM.AU`
- Stripe receipt: from DriveBook
- Refund authority: DriveBook
- Chargeback liability: DriveBook (Stripe deducts from DriveBook's account)
- GST/BAS: DriveBook's tax obligation
- Payout to instructor: via Stripe Connect transfer (DriveBook → instructor)

---

## 3. Current SaaS Settlement (quote-based, non-driving)

SaaS bookings use `lib/services/saas-payment.ts` → `createCheckoutSession()`. As confirmed
by MM-10-A and the current source:
- Stripe Checkout session created **on DriveBook's platform account** (no `transfer_data.destination`)
- Money lands on DriveBook's Stripe account
- `applicationFeeAmount = commissionPercent × totalAmountInCents` (per `BusinessSettings.commissionRate`)
- No weekly payout to the provider from this path
- `BusinessConfig.capabilities.commission = false` for `paymentModel === 'saas'`

**Current SaaS settlement is functionally identical to PLATFORM mode** — DriveBook holds
the money, no Stripe Connect transfer occurs. The distinction is that SaaS uses a
Checkout session (not a PaymentIntent) and per-business commission rates rather than
tier-based global rates.

---

## 4. Planned DIRECT Mode — Settlement Contract

This section defines the settlement semantics that MUST govern any DIRECT mode
implementation. No code changes are made here — this is the decision boundary.

### 4.1 Who Receives Funds

| Event | PLATFORM | DIRECT |
|---|---|---|
| Student pays | DriveBook Stripe account | Instructor's Stripe Connect account |
| Funds available to instructor | After weekly payout | Immediately (Stripe Connect transfer-data) |
| DriveBook's Stripe account balance change | +fullAmount | ±zero (on_behalf_of; amount in = amount transferred out) |
| Bank statement shown to student | "DRIVEBOOK.COM.AU" | Instructor's Stripe statement descriptor |

In DIRECT mode, DriveBook uses Stripe's `on_behalf_of` + `transfer_data.destination` pattern:
the charge is created on DriveBook's account but funds flow immediately to the instructor's
connected account. DriveBook retains only the `application_fee_amount`.

### 4.2 Who Bears Fees

| Fee | PLATFORM | DIRECT |
|---|---|---|
| Stripe processing cost (~1.75% + $0.30) | Absorbed by DriveBook from commission | Deducted by Stripe from DriveBook's `application_fee_amount` |
| DriveBook commission | % per lesson (tier-based, 10–15%) | Zero |
| DriveBook `application_fee_amount` | Implicit (platform revenue = fullAmount − providerPayout) | Explicit: 2.5% of lesson price |
| Platform fee surcharge to student | 3.6% (collected from student) | Not applicable — no surcharge (DriveBook earns via subscription only) |
| Withholding tax | Applied by DriveBook at payout time | Not applicable — instructor receives funds directly; their own tax obligation |

**Decision: 2.5% is the defined `application_fee_amount` rate for DIRECT mode.**  
Rationale: 2.5% covers Stripe's ~1.75% + $0.30 processing cost with a narrow $0.27/lesson
margin for DriveBook's fraud protection and dispute handling services. This is proportionate
for DIRECT mode where DriveBook does not manage the payment lifecycle. (Source:
`docs/newplan/PAYMENT-WHITE-LABEL.md` — rate analysis confirmed.)

### 4.3 Refund Semantics

| Scenario | PLATFORM | DIRECT |
|---|---|---|
| Refund authority | DriveBook (issues refund from platform Stripe account) | Stripe auto-deducts from instructor's account; DriveBook must also issue `applicationFeeRefunds.create()` to return profit margin |
| Where refund goes (default policy) | Client's DriveBook wallet (not back to card) | Back to student's card (Stripe handles automatically) |
| LedgerEntry on refund | `REFUND_ISSUED` + `PlatformLedger.totalRefunded++` | No `PlatformLedger` change (DriveBook never held the money) |
| Post-payout instructor deduction | `ADJUSTMENT` LedgerEntry on next payout | Not applicable — instructor already holds funds; Stripe auto-deducts |
| Stripe sunk cost | Non-refundable; absorbed from DriveBook margin | Non-refundable; absorbed from DriveBook's `application_fee_amount` |

**Decision: DIRECT mode refunds require two Stripe API calls:**
1. `stripe.refunds.create({ charge: chargeId, refund_application_fee: false })` — full student refund
2. `stripe.applicationFeeRefunds.create(applicationFeeId, { amount: driveBookProfitCents })` — return DriveBook's profit margin only (keep Stripe's sunk cost)

This requires storing `directApplicationFeeId String?` on the `Booking` schema. This field
does not exist in the current schema and must be added before DIRECT mode is activated.

### 4.4 Dispute and Chargeback Semantics

| Scenario | PLATFORM | DIRECT |
|---|---|---|
| Chargeback liability | DriveBook (funds in DriveBook's account) | Instructor's Stripe account (Stripe deducts directly) |
| DriveBook's exposure | Full booking amount | Only `application_fee_amount` (2.5%) |
| Webhook: `charge.dispute.created` | Freeze instructor payout, create PAYMENT_DISPUTE task | Do NOT freeze payout (instructor already has funds); alert only |
| Webhook: `charge.refunded` (chargeback-driven) | `DISPUTE_LOST` LedgerEntry, `totalCollected -= amount` | Do NOT write negative LedgerEntry (DriveBook never collected `totalCollected` for this booking) |
| `PlatformLedger` impact on chargeback | `totalCollected -= fullAmount`, `totalReserved -= fullAmount` | No LedgerEntry change for the booking amount; `application_fee` recovery handled separately if needed |

**Decision: The dispute webhook handler MUST check `paymentMode` before writing any
LedgerEntry.** Writing a `DISPUTE_LOST` entry against `PlatformLedger.totalCollected` for a
DIRECT booking would corrupt the available balance formula:
`availableBalance = totalCollected − totalPaidOut − totalRefunded`
because `totalCollected` was never incremented for DIRECT bookings.

### 4.5 Ledger Invariants — What Must NOT Change for DIRECT Bookings

The following `PlatformLedger` fields and `LedgerEntry` types are defined only for
**PLATFORM money** (funds that passed through DriveBook's Stripe account):

| Field / Entry | PLATFORM | DIRECT |
|---|---|---|
| `PlatformLedger.totalCollected` | Increment on `payment_intent.succeeded` | **DO NOT INCREMENT** |
| `PlatformLedger.totalReserved` | Increment on collect; decrement on payout | **DO NOT TOUCH** |
| `PlatformLedger.totalPaidOut` | Increment on payout transfer | **DO NOT INCREMENT** (no payout) |
| `PlatformLedger.totalRefunded` | Increment on `REFUND_ISSUED` | **DO NOT INCREMENT** |
| `LedgerEntry.PAYMENT_COLLECTED` | Created on booking confirmation | **DO NOT CREATE** |
| `LedgerEntry.PAYOUT_PAID` | Created on Stripe transfer | **DO NOT CREATE** |
| `LedgerEntry.REFUND_ISSUED` | Created on refund | **DO NOT CREATE** |
| `LedgerEntry.DISPUTE_LOST` | Created on lost chargeback | **DO NOT CREATE** for booking amount |

**Allowed for DIRECT bookings:** An `applicationFee` sub-ledger (not yet defined) tracking
DriveBook's 2.5% `application_fee_amount` per DIRECT booking, and a corresponding
`applicationFeeRefund` entry on refund. These do not exist in the current schema and must
be designed before DIRECT mode is activated.

### 4.6 Merchant of Record in DIRECT Mode

In DIRECT mode, **the instructor is the merchant of record**, not DriveBook:
- Student's card statement: instructor's Stripe business name
- Stripe receipt: from instructor's Stripe account
- Refund initiated: by DriveBook UI but executed on instructor's Stripe account
- Chargeback liability: instructor (Stripe deducts from their account)
- GST/BAS: instructor's tax obligation for the lesson amount; DriveBook's obligation only for the 2.5% application fee
- No weekly payout: funds arrive immediately to instructor's Stripe balance

---

## 5. Mode Separation Rules — Boundary Constraints

These rules must hold permanently, regardless of implementation phase:

### Rule S-01: Ledger writes must be conditioned on paymentMode
Every `LedgerEntry` write and `PlatformLedger` mutation must check `booking.paymentMode`
(or `paymentIntent.metadata.paymentMode`) before executing. DIRECT bookings must never
increment `totalCollected`, `totalReserved`, or `totalPaidOut`.

### Rule S-02: assertPlatformPaymentMode() must be the single DIRECT block
The current four separate inline guards (`create-intent`, `bookings/bulk`, `quotes/accept`,
`register`) must be consolidated to call `assertPlatformPaymentMode()`. The inline guards
may remain as belt-and-suspenders, but `assertPlatformPaymentMode()` must be called from
every payment entry point so that removing an inline guard does not silently open DIRECT mode.

**Note:** The design doc (`PAYMENT-WHITE-LABEL.md`) states `createDirectPaymentIntent()` is
complete at `lib/services/stripe.ts:110`. Source inspection found no such function in the
current `stripe.ts`. This discrepancy must be resolved before DIRECT implementation begins —
either the function was removed or the design doc is aspirational. Do not treat the design
doc's "What IS built" table as current source truth.

### Rule S-03: SaaS and PLATFORM must not share commission config
SaaS path uses `BusinessSettings.commissionRate` → `BusinessConfig.commissionPercent`.
PLATFORM path uses `PlatformSettings.basicCommissionRate / proCommissionRate / studioCommissionRate / businessCommissionRate`.
DIRECT path must use a separate `directApplicationFeeRate` config (recommended: 2.5%).
These three stores must not be aliased or collapsed — they govern different revenue models.

### Rule S-04: DIRECT mode requires PREMIUM subscription
`getAccountFeatures().directPayments` is currently hardcoded `false`. When DIRECT is
activated, the gate must enforce: `subscriptionTier === 'PREMIUM'` AND
`provider.chargesEnabled === true` (Stripe Connect onboarding complete). No other tier
grants DIRECT mode. This gate belongs in both the settings-write API and the
`getAccountFeatures()` function.

### Rule S-05: No payoutQueue entry for DIRECT bookings
`buildPayout()` must exclude `Transaction` records where `booking.paymentMode === 'DIRECT'`.
Including them would create a Stripe transfer for money that never arrived in DriveBook's
account, resulting in a negative available balance and a failed `assertSufficientBalance()`
check.

### Rule S-06: directApplicationFeeId must be stored before refunds are possible
DIRECT mode refunds require `stripe.applicationFeeRefunds.create(applicationFeeId, ...)`.
The `applicationFeeId` is only available from the Stripe PaymentIntent after charge
confirmation. It must be stored on `Booking.directApplicationFeeId` in the
`payment_intent.succeeded` webhook handler for DIRECT bookings. DIRECT mode must not be
activatable until this field exists in the schema.

---

## 6. What Must Not Change About Current PLATFORM Behaviour

This decision record must not be read as justification to change any current PLATFORM code.
The following are verified and must remain unchanged:

- `createPaymentIntent()` in `lib/services/stripe.ts` — no `transfer_data`, no `on_behalf_of`
- `PlatformLedger.totalCollected` increment on `payment_intent.succeeded` webhook
- `buildPayout()` eligibility: `Transaction.status = 'SETTLED'`, dispute buffer, `chargesEnabled`, `payoutsEnabled`
- `executePayout()` PAY-01 ownership check via `verifyPayoutDestinationOwnership()`
- `assertSufficientBalance()` and `assertNonNegativeBalance()` guards
- `getCommissionRate()` tier-based rates from `PlatformSettings`
- `REFUND_ISSUED` + `ADJUSTMENT` flow for post-payout refunds (PLATFORM only)
- Dispute webhook: freeze → `DISPUTE_OPENED` → release/cancel on resolution (PLATFORM only)

---

## 7. Existing Code Gaps (informational — not fixes, pre-conditions for DIRECT activation)

These gaps are documented here so they are not lost. They must be addressed before DIRECT
mode is enabled. They are not assigned separate audit IDs at this time — they are
implementation prerequisites for WLA-002.

| Gap | Location | Description |
|---|---|---|
| G01 | `lib/services/stripe.ts` | `createDirectPaymentIntent()` referenced in `PAYMENT-WHITE-LABEL.md` as complete at line 110; not found in current source. Must be confirmed present or rebuilt. |
| G02 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `payment_intent.succeeded` handler. Would write incorrect `PAYMENT_COLLECTED` LedgerEntry for DIRECT bookings. |
| G03 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `charge.refunded` handler. Would write incorrect `REFUND_ISSUED` LedgerEntry and corrupt `PlatformLedger.totalRefunded`. |
| G04 | `lib/services/chargebackAutomation.ts` | No `paymentMode === 'DIRECT'` branch. Would freeze instructor payout (which doesn't exist for DIRECT) and write `DISPUTE_LOST` against `PlatformLedger.totalCollected` (which was never incremented for DIRECT). |
| G05 | `prisma/schema.prisma` | `Booking.directApplicationFeeId` field does not exist. Required for two-step DIRECT refunds. |
| G06 | `lib/services/payout-service.ts` — `buildPayout()` | Does not exclude `paymentMode === 'DIRECT'` transactions. Would queue DIRECT bookings for payout despite instructor already holding funds. |
| G07 | `lib/utils/account.ts` — `assertPlatformPaymentMode()` | Has zero call sites in production payment routes. Four separate inline guards exist instead. Must be unified before DIRECT is activated. |
| G08 | `lib/services/platform-pricing.ts` | No `directApplicationFeeRate` config exists. Would need `PlatformSettings.directApplicationFeePercentage Decimal @default(2.5)`. |
| G09 | `lib/services/saas-payment.ts` | `application_fee_amount` set without `transfer_data.destination` or `on_behalf_of`. Per Stripe API: `application_fee_amount` is only valid on charges to connected accounts. Requires verification (WLA-004). |

---

## 8. Decision Summary

| Question | Answer |
|---|---|
| Who receives funds in PLATFORM mode? | DriveBook's Stripe account; instructor receives weekly payout via Connect transfer |
| Who receives funds in DIRECT mode? | Instructor's Stripe Connect account immediately; DriveBook retains application_fee only |
| What does DriveBook earn in PLATFORM? | Commission (10–15% by tier) + 3.6% platform fee surcharge |
| What does DriveBook earn in DIRECT? | Subscription only + 2.5% application_fee per transaction |
| Who bears Stripe processing cost in DIRECT? | DriveBook (deducted from application_fee_amount) |
| Who bears chargeback liability in DIRECT? | Instructor (Stripe deducts from their account); DriveBook's exposure = 2.5% only |
| Can PLATFORM and DIRECT share a ledger? | No. `PlatformLedger` tracks PLATFORM money only. DIRECT bookings must not touch totalCollected, totalReserved, totalPaidOut, or totalRefunded. |
| Can PLATFORM and DIRECT share the payout queue? | No. `buildPayout()` must exclude DIRECT bookings. |
| Can PLATFORM and DIRECT share the refund flow? | No. PLATFORM refunds: DriveBook issues, wallet credit, ADJUSTMENT on next payout. DIRECT refunds: two-step Stripe API (full card refund + applicationFeeRefunds), no LedgerEntry for booking amount. |
| What subscription tier gates DIRECT? | PREMIUM only, AND chargesEnabled=true (Connect onboarding complete) |
| Can DIRECT be activated from current source? | No. G01–G09 must be resolved. `DIRECT mode must remain blocked until all preconditions are met.` |
| Is current PLATFORM behaviour correct? | Yes. Verified as intentional per MM-10-A and source inspection. No changes required to current code. |

---

## 9. Relationship to Other Findings

- **MM-10-A (SUPERSEDED/closed):** Confirmed SaaS money landing on platform is intentional. WLA-002 extends this by specifying what must change when DIRECT is activated.
- **WLA-001 (closed):** Fixed the missing DIRECT guard on the quote-accept route. G07 above documents the remaining consolidation work.
- **WLA-004 (FINDING):** `application_fee_amount` validity on non-Connect charges — directly relevant to G09 above.
- **WLA-005 (OPEN — next):** Wallet ownership semantics. Wallet refunds (PLATFORM mode default) should be re-evaluated once WLA-002 decision is accepted — DIRECT mode refunds go to card, not wallet.
- **PAY-01 (closed):** `verifyPayoutDestinationOwnership()` must remain in `executePayout()` and must not be called for DIRECT bookings (which have no payout step).
- **SEC-CRED-01 (ACTIVE CRITICAL — deferred):** Credential rotation. Unrelated to settlement semantics.

---

*This document is an architecture decision record. It does not implement any code changes.
It must be reviewed and accepted before any DIRECT mode implementation work begins.
The current PLATFORM codebase is unchanged by this document.*
