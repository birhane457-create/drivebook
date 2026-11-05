# WLA-002 — Provider Settlement Semantics: Architecture Decision Record (v3)

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary whose absence becomes a code defect when DIRECT mode is activated.  
**Status:** ARCHITECTURE DECISION DEFINED (v3) — pending reviewer acceptance  
**v1 authored:** 2026-11-06 — NOT ACCEPTED (reviewer: dispute liability incorrectly assigned to instructor)  
**v2 authored:** 2026-11-06 — NOT ACCEPTED (reviewer: AU rate stale; DIRECT dispute ledger contradicts section 6.5)  
**v3 authored:** 2026-11-06  
**v2 rejection reason:** AU processing rate used 1.65% + $0.30 (stale); section 6.3 `PlatformLedger` impact row stated `DISPUTE_LOST → totalCollected -= disputedAmount`, directly contradicting section 6.5 which correctly prohibits any `totalCollected` mutation for DIRECT bookings; Model A rationale overstated Stripe's position on Express accounts without precise documentation; dispute countered fee (A$25) omitted from dispute economics.

**Sources inspected (code):**  
- `lib/services/stripe.ts` — `createConnectAccount()` — `type: 'express'`, `country: 'AU'`  
- `lib/services/payout-service.ts` — `buildPayout()`, `executePayout()`, `recordPaymentCollected()`, `recordRefundIssued()`  
- `lib/services/ledger-service.ts` — `LedgerEntryType`, `PlatformLedger`, `availableBalance`  
- `lib/services/saas-payment.ts` — `createCheckoutSession()`, `applicationFeeAmount`  
- `lib/services/platform-pricing.ts` — `getCommissionRate()`, `getPlatformFeeRate()`  
- `lib/services/chargebackAutomation.ts` — dispute webhook handlers  
- `lib/utils/account.ts` — `assertPlatformPaymentMode()`, `getAccountFeatures()`  
- `prisma/schema.prisma` — `Provider`, `Booking`, `Transaction`, `LedgerEntry`, `PlatformLedger`  
- `docs/newplan/PAYMENT-WHITE-LABEL.md` — DIRECT mode design spec  

**Stripe documentation referenced:**  
- [Disputes on Connect platforms](https://docs.stripe.com/connect/disputes) — charge-type dispute debit rules  
- [Handle refunds and disputes (marketplace)](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes) — destination-charge refund and `reverse_transfer` requirements  
- [Understand how charges work in a Connect integration](https://docs.stripe.com/connect/charges) — charge type definitions  
- [Picking the right charge type (Stripe dev.to)](https://dev.to/stripe/picking-the-right-charge-type-for-your-stripe-connect-platform-3m14) — liability and fee comparisons  
- [Stripe Australia pricing](https://stripe.com/AU/pricing) — current AU rates  
- [April 2024 AU pricing update](https://support.stripe.com/questions/april-2024-pricing-update-for-businesses-on-standard-pricing-in-australia) — rate change history  

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

MM-10-A (SUPERSEDED/closed) confirmed that SaaS money landing on the platform account is
intentional current architecture. This document extends that by specifying the settlement
boundary rules that must hold when DIRECT mode is eventually activated.

---

## 2. Current Stripe Connect Account Configuration

`createConnectAccount()` in `lib/services/stripe.ts` creates accounts as:

```typescript
stripe.accounts.create({
  type: 'express',    // Express account — NOT Standard or Custom
  country: 'AU',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  business_type: 'individual',
})
```

**Established facts:**
- Account type is **Express** (legacy v1 account model)
- Express accounts use `controller.fees.payer = 'application_express'` by default
- For **direct charges** on Express accounts: connected account pays Stripe processing fees; connected account balance is debited for disputes, but the **platform is responsible for the connected account's negative balances**
- For **destination charges** on Express accounts (and any indirect charges): the **platform account** is debited for both the dispute amount and dispute fees; the platform must use `reverse_transfer: true` to recover funds from the connected account
- The Express Dashboard does not support dispute management; the platform must handle dispute responses for Express accounts

This account type is compatible with both destination charges and direct charges, but with different liability implications for each, as detailed in sections 4–6 below.

---

## 3. Current PLATFORM Settlement — Source-Verified State

### 3.1 Fund Flow

In PLATFORM mode (current and only active mode), DriveBook uses a plain PaymentIntent
with no `transfer_data` and no `on_behalf_of`. Money flows to DriveBook's Stripe account.
The instructor receives a weekly Stripe Connect transfer via `executePayout()`.

```
Student pays
  → DriveBook Stripe account (PaymentIntent, no transfer_data)
  → payment_intent.succeeded
      → PlatformLedger.totalCollected += fullAmount
      → PlatformLedger.totalReserved  += fullAmount
      → Booking.status = CONFIRMED
      → Transaction.status = SETTLED

After lesson + dispute buffer (default 48h):
  → buildPayout()
      → grossAmount = Σ(Transaction.providerPayout)     [net of commission]
      → adjustments for post-payout refunds
      → withholdingTax = grossAmount × Provider.withholdingTaxRate
      → netAmount = grossAmount − withholdingTax
      → Payout record (ELIGIBLE)

executePayout():
  → assertSufficientBalance(netAmount)
  → verifyPayoutDestinationOwnership()                  [PAY-01 fix]
  → stripe.transfers.create({ destination: verifiedAccountId, amount: netAmount })
  → PlatformLedger.totalPaidOut      += netAmount
  → PlatformLedger.totalReserved     -= grossAmount
  → LedgerEntry: PAYOUT_PAID
```

### 3.2 Fee Structure (PLATFORM, example: BASIC tier, $75 domestic card)

| Field | Amount | Source |
|---|---|---|
| Student pays | $75.00 | Full lesson price |
| Platform fee surcharge (3.6%) | $2.70 | `PlatformSettings.platformFeePercentage` — collected from student |
| Commission (BASIC 15%) | $11.25 | `PlatformSettings.basicCommissionRate` — DriveBook revenue |
| `providerPayout` on Booking | $63.75 | Net after commission; withholding tax applied at payout |
| Stripe processing cost (1.70% + $0.30) | ~$1.58 | Borne by DriveBook from commission margin |
| Net Stripe charge to DriveBook | ~$9.67 | Commission ($11.25) minus Stripe cost ($1.58) |

**Naming notes:**
- `Booking.platformFee` = the 3.6% surcharge amount in AUD
- `Booking.commissionRate` = the tier-based commission percentage
- `Booking.providerPayout` = net after commission, before withholding tax
- Withholding tax is applied at `buildPayout()` time, not booking time

### 3.3 PLATFORM Dispute Handling (Current)

DriveBook is the **sole merchant on the charge**. All disputes debit the DriveBook platform
account. `chargebackAutomation.ts` holds the instructor's payout on `dispute.opened` and
reverses on `dispute.won` or cancels on `dispute.lost`. No transfer reversal is needed —
the instructor has not yet received the funds (they are in the dispute buffer or payout
queue). The current implementation correctly handles PLATFORM mode disputes.

---

## 4. Current SaaS Settlement — Dependency on WLA-004

`lib/services/saas-payment.ts` creates a Stripe Checkout session that sets
`payment_intent_data.application_fee_amount` when `businessConfig.commissionPercent > 0`,
but does **not** set `transfer_data.destination` or `on_behalf_of`.

**Per Stripe's API**: `application_fee_amount` is only valid when the charge is created on
a connected account (direct charge) or with `transfer_data.destination` (destination charge).
Setting it on a plain platform charge may cause the parameter to be silently ignored or
result in an API error.

**Decision: the current SaaS path is NOT a confirmed working baseline for settlement
semantics.** It is acknowledged as intentionally landing on the platform account (per
MM-10-A), but whether the `application_fee_amount` field is valid in that context is
unresolved pending WLA-004 runtime verification. This ADR treats the SaaS flow as
"money lands on platform" only, and does not rely on `application_fee_amount` semantics
for any of the decisions below.

---

## 5. The Central Charge-Type Decision for DIRECT Mode

The v1 ADR assumed a single model: `on_behalf_of + transfer_data.destination` (destination
charge). The reviewer correctly identified that this does not shift dispute liability to the
connected account. This section defines the two viable models and makes an explicit choice.

### 5.1 Model A — Destination Charge (current design doc assumption)

```typescript
stripe.paymentIntents.create({
  amount,
  currency: 'aud',
  on_behalf_of: instructorStripeAccountId,   // statement descriptor = instructor
  payment_method_types: ['card'],
  transfer_data: { destination: instructorStripeAccountId },
  application_fee_amount: Math.round(amount * 0.025),
})
```

**Stripe-verified behaviour (destination charges):**
- Charge is stored on the **DriveBook platform account**
- Funds transfer atomically to instructor's connected account minus application fee
- Student sees instructor's Stripe statement descriptor (due to `on_behalf_of`)
- Stripe processes fees using **DriveBook platform's** pricing (1.70% + $0.30 AU)
- **Disputes: Stripe debits the DriveBook platform account** for both the disputed amount and the A$25 dispute fee (regardless of `on_behalf_of`)
- To recover disputed funds from the connected account: **transfer reversal required** (`reverse_transfer: true`)
- If the connected account has insufficient balance: Stripe may debit its external bank account if `debit_negative_balances` is set; otherwise DriveBook bears the loss
- DriveBook is the merchant of record for card network dispute rate monitoring

**Refund procedure (destination charges, Stripe-verified):**
```typescript
// Refunding a destination charge WITHOUT reverse_transfer leaves connected account
// with the funds while platform covers the negative balance — do NOT do this.
stripe.refunds.create({
  charge: chargeId,
  reverse_transfer: true,         // mandatory — pulls funds back from connected account
  refund_application_fee: true,   // returns the application fee proportionally
})
```
Without `reverse_transfer: true`, the connected account retains the transferred funds
while DriveBook's balance is debited for the full refund — platform bears the full loss.

**Summary (Model A):**
| Aspect | Reality |
|---|---|
| Statement descriptor | Instructor's (via `on_behalf_of`) |
| Stripe processing fees | Charged to DriveBook platform |
| Dispute debit | DriveBook platform account |
| Dispute response authority | DriveBook (platform account) |
| Dispute fee (A$25) | DriveBook platform account |
| Refund debit | DriveBook platform account |
| Refund recovery mechanism | `reverse_transfer: true` — funds pulled from connected account |
| DriveBook's maximum loss if connected account is empty | Full disputed/refunded amount |
| Connected account Stripe dashboard | Transaction appears (via `on_behalf_of`) |

### 5.2 Model B — Direct Charge on Connected Account

```typescript
// Charge created WITH Stripe-Account header pointing to connected account
stripe.paymentIntents.create(
  {
    amount,
    currency: 'aud',
    payment_method_types: ['card'],
    application_fee_amount: Math.round(amount * 0.025),
  },
  { stripeAccount: instructorStripeAccountId }   // Stripe-Account header
)
```

**Stripe-verified behaviour (direct charges on Express accounts):**
- Charge is stored on the **connected account** (instructor's Stripe account)
- Student sees instructor's Stripe statement descriptor
- Stripe processes fees using the **connected account's** pricing (same as Express account rate, typically same as platform unless custom rate applies)
- **Disputes: Stripe debits the connected account's balance** for disputed amounts
  - For Express accounts: connected account pays dispute-related fees
  - However: **DriveBook remains responsible for the connected account's negative balances** (this is an Express account limitation — Stripe does not absorb negative balances for Express accounts unless Stripe is explicitly set as the negative-balance controller)
  - DriveBook is **not** the card-network merchant-of-record — the connected account is, but dispute-rate monitoring may still apply to DriveBook's platform depending on Stripe's assessment
- `application_fee_amount` is valid in this context (charge is on a connected account)
- Refunds: initiated by DriveBook on the connected account using its `Stripe-Account` header; reduce the connected account's balance; application fee can be refunded via `refund_application_fee: true`

**Summary (Model B):**
| Aspect | Reality |
|---|---|
| Statement descriptor | Instructor's (charge is on their account) |
| Stripe processing fees | Charged to connected account's balance |
| Dispute debit | Connected account's balance |
| Dispute response authority | Connected account (but Express dashboard lacks dispute UI — DriveBook must handle via API) |
| Dispute fee (A$25) | Connected account (for Express with `fees.payer = application_express`) |
| Refund debit | Connected account's balance |
| Refund recovery mechanism | Reduces connected account balance directly (no separate transfer reversal) |
| DriveBook's exposure if connected account balance goes negative | Full negative balance (platform liable for Express account negative balances) |
| Connected account Stripe dashboard | Full transaction visibility |

### 5.3 Model Comparison

| Aspect | Model A (Destination) | Model B (Direct) |
|---|---|---|
| Charge settles on | Platform account | Connected account |
| `application_fee_amount` valid? | Yes (with `transfer_data.destination`) | Yes (charge on connected account) |
| Dispute debit | **Platform** | Connected account |
| Dispute fee | **Platform** | Connected account (Express) |
| Refund debit | **Platform** | Connected account |
| Platform's max exposure | Full amount if connected account empty | Full negative balance if connected account empty |
| Radar rules apply to | Platform account rules | Connected account must be configured per-account |
| Dispute management UI | Platform Stripe Dashboard | Express Dashboard lacks it — must use API |
| Consistent with Express account type? | Yes — recommended for Express | Technically possible but complex |
| `createDirectPaymentIntent()` in design doc | Uses this model | Requires Stripe-Account header instead |

**Critical finding common to both models:** In neither model does DriveBook escape financial
exposure when the connected account balance is empty. For destination charges, the platform
is debited directly. For direct charges on Express accounts, the platform is responsible for
negative connected account balances. The risk allocation between models is one of immediacy
and operational complexity, not fundamentally different total exposure.

### 5.4 Decision: Model A (Destination Charge) — with corrections

**Rationale:**
1. `createConnectAccount()` creates Express accounts. Model B (direct charges on Express accounts) has documented operational complexity: the Express Dashboard does not support dispute management (Stripe dev.to article; noted as a limitation for platforms), so DriveBook would need to handle all dispute responses via API. Platform-level Radar rules do not automatically apply to direct charges on connected accounts — connected accounts must be configured individually (noted in Stripe Connect Radar documentation). Reporting for direct charges is fragmented across connected accounts. On balance, these are operational disadvantages relative to Model A for a platform at DriveBook's current scale.
2. Model A is consistent with Express accounts, uses DriveBook's platform Radar rules and reporting, and centralises dispute responses through the platform Dashboard.
3. The design doc `PAYMENT-WHITE-LABEL.md` uses `on_behalf_of + transfer_data.destination` (Model A). This is the correct implementation path.
4. The key correction from v1: Model A does NOT move dispute/refund liability to the instructor. DriveBook bears the immediate debit; recovery from the connected account requires `reverse_transfer: true` and is not guaranteed if the account balance is zero.

**This decision does not change the risk profile — it correctly names it.** DriveBook bears the first-instance financial exposure in both models when a connected account has no balance. The difference is that Model A keeps operational control (Radar, dispute management, reporting) centralised.

---

## 6. Corrected Settlement Contract for DIRECT Mode (Model A)

### 6.1 Who Receives Funds

| | PLATFORM | DIRECT (Model A, destination charge) |
|---|---|---|
| Charge created on | DriveBook platform account | DriveBook platform account |
| Funds transfer to instructor | Weekly Stripe Connect transfer | Atomically at charge creation (`transfer_data.destination`) |
| Student's bank statement | "DRIVEBOOK.COM.AU" | Instructor's Stripe statement descriptor (via `on_behalf_of`) |
| DriveBook's Stripe balance change | +fullAmount | +application_fee_amount only |

### 6.2 Who Bears Fees

| Fee | PLATFORM | DIRECT (Model A) |
|---|---|---|
| Stripe processing (1.70% + A$0.30, domestic) | DriveBook | DriveBook (destination charge uses platform pricing) |
| DriveBook commission | Tier-based 10–15% | Zero |
| DriveBook `application_fee_amount` | Implicit (retained from settlement) | Explicit: recommended 2.5% of lesson price |
| Platform fee surcharge to student | 3.6% (passed on to student) | Subject to product decision — see section 6.5 |

### 6.3 Dispute and Chargeback Handling (CORRECTED from v1)

**Per Stripe documentation (source: [Connect disputes guide](https://docs.stripe.com/connect/disputes)):**

> For destination and separate charges and transfers, with or without on_behalf_of, Stripe debits dispute amounts and fees from your platform account.

| Step | Action |
|---|---|
| `charge.dispute.created` fires | DriveBook platform balance is debited immediately (full disputed amount + A$25 dispute fee) |
| Dispute response | DriveBook responds via platform Dashboard or Disputes API |
| If DriveBook accepts or loses | Reverse the transfer: `stripe.transfers.createReversal(transferId)` — pulls funds from connected account |
| If connected account has insufficient balance | Stripe attempts to debit connected account's external bank (if `debit_negative_balances: true`); otherwise DriveBook bears the loss |
| If DriveBook wins | Do NOT reverse the transfer; connected account retains funds |
| `PlatformLedger` impact | **None** — DIRECT bookings must not touch `totalCollected`, `totalReserved`, or `totalPaidOut`. Dispute amounts must be recorded in the application-fee sub-ledger (G10) only. |

**Implementation consequence:** The `chargebackAutomation.ts` DIRECT branch must:
1. Not freeze a payout queue entry (there is none for DIRECT bookings)
2. Execute `stripe.transfers.createReversal()` on dispute loss/acceptance
3. Record the dispute event in the **application-fee sub-ledger** (G10), not in the existing `PlatformLedger` fields. The application fee exposure per dispute is: `application_fee_amount` (2.5%) plus the A$25 dispute received fee, plus A$25 dispute countered fee if the dispute is contested (refundable if won, per Stripe AU pricing). The full booking amount is never DriveBook's collected revenue in DIRECT mode and must not appear in `totalCollected`.
4. Do NOT write `DISPUTE_OPENED`, `DISPUTE_WON`, or `DISPUTE_LOST` LedgerEntries using the full disputed booking amount — those entry types implicitly reference `PlatformLedger` aggregates that were not incremented for DIRECT bookings. New sub-ledger entry types scoped to the application fee are required.

### 6.4 Refund Procedure (CORRECTED from v1)

**For destination charges, refunds debit the DriveBook platform account by default. To recover from the connected account, `reverse_transfer: true` is mandatory.**

```typescript
// CORRECT refund procedure for DIRECT (destination charge) bookings:
await stripe.refunds.create({
  charge: chargeId,
  amount: refundAmountInCents,   // partial or full
  reverse_transfer: true,        // MANDATORY — recover from connected account
  refund_application_fee: true,  // return application fee proportionally
});
// Note: refund_application_fee refunds proportionally, e.g. 40% refund → 40% of fee refunded
// Stripe's sunk processing cost (1.70% + $0.30) is not returned by Stripe in any refund
```

**Omitting `reverse_transfer: true` leaves the connected account with the lesson funds
while DriveBook's balance absorbs the full refund.** This is not a product decision — it is
a required parameter for DIRECT refunds.

**What happens to the application fee on refund:**
- `refund_application_fee: true` refunds the fee proportionally
- The Stripe processing cost (1.70% + $0.30 of the original charge) is non-refundable — Stripe does not return it on any refund
- DriveBook's net cost on a full refund: the Stripe processing cost of the original charge (~1.70% + $0.30)

**`directApplicationFeeId` requirement:**
- The `application_fee` object ID is returned by Stripe on the charge after `payment_intent.succeeded`
- If `refund_application_fee: true` is used on the refund (not a separate `applicationFeeRefunds.create()`), the `application_fee` ID is not separately needed — Stripe handles it automatically via the `charge` ID
- `directApplicationFeeId` on `Booking` is still useful for auditing and reconciliation purposes but is not required for the `reverse_transfer + refund_application_fee` approach
- Recommendation: store it as `Booking.directApplicationFeeId String?` for audit completeness; it is not a hard blocker for the refund procedure

### 6.5 Ledger Invariants — What Must NOT Change for DIRECT Bookings

`PlatformLedger` tracks money that passed through DriveBook's Stripe account as a
full-amount settlement. In DIRECT mode, only the `application_fee_amount` passes through
DriveBook's balance. The full booking amount does not.

| Field / LedgerEntry | PLATFORM | DIRECT (Model A) |
|---|---|---|
| `PlatformLedger.totalCollected` | += fullAmount on `payment_intent.succeeded` | **DO NOT INCREMENT by fullAmount** — only application_fee is DriveBook revenue |
| `PlatformLedger.totalReserved` | += fullAmount on collect; -= on payout | **DO NOT TOUCH** |
| `PlatformLedger.totalPaidOut` | += netAmount on Stripe transfer | **DO NOT INCREMENT** (no payout queue) |
| `PlatformLedger.totalRefunded` | += on `REFUND_ISSUED` | **DO NOT INCREMENT by fullAmount** |
| `LedgerEntry.PAYMENT_COLLECTED` (for full amount) | Created on booking confirmation | **DO NOT CREATE** for full amount |
| `LedgerEntry.PAYOUT_PAID` | Created on Stripe transfer | **DO NOT CREATE** (no payout) |
| `LedgerEntry.REFUND_ISSUED` (for full amount) | Created on refund | **DO NOT CREATE** for full amount |

**What to do instead:** An application-fee sub-ledger or separate LedgerEntry type is needed
to track `application_fee_amount` received per DIRECT booking. This does not exist in the
current schema and must be designed before DIRECT mode is activated. Until it is designed,
DIRECT bookings must not write any entries to the existing `PlatformLedger` fields.

**Dispute LedgerEntries for DIRECT:** When a DIRECT booking is disputed, DriveBook is
debited the full disputed amount from its platform balance (Stripe mechanics). The
application-fee sub-ledger should record the debit. The existing `DISPUTE_OPENED` /
`DISPUTE_WON` / `DISPUTE_LOST` entries may be reused but must be scoped to the application
fee amount only, not the full booking amount.

### 6.6 Payout Queue Exclusion

`buildPayout()` must exclude `Transaction` records where `booking.paymentMode === 'DIRECT'`.
Including them would instruct `executePayout()` to Stripe-transfer money that is already in
the connected account, resulting in a double-payment to the instructor and a negative
`availableBalance` assertion failure.

### 6.7 Application Fee Rate Recalculation (AU, 2026)

**Stripe Australia domestic card processing (current rate as of 6 November 2026, per reviewer inspection of stripe.com/AU/pricing):**  
1.70% + A$0.30 per successful online charge

**Note on rate history:** Stripe reduced AU domestic online rates from 1.75% to 1.70% in April 2024, then to 1.65% in a subsequent update visible on the pricing page at the time of v2 drafting. The reviewer confirmed 1.70% + $0.30 as the current rate on 6 November 2026. The authoritative source is [stripe.com/AU/pricing](https://stripe.com/AU/pricing), which should be checked at implementation time.

**Per $75 lesson (DIRECT mode, domestic card):**

| Item | Calculation | Amount |
|---|---|---|
| Student pays | — | $75.00 |
| `application_fee_amount` (2.5%) | 2.5% × $75.00 | $1.875 (= $1.88 rounded) |
| Stripe processing cost (1.70% + $0.30) | 1.70% × $75.00 + $0.30 | $1.58 |
| Stripe deducts from application fee | $1.58 from $1.88 | $1.58 |
| DriveBook net margin | $1.88 − $1.58 | **$0.30** |
| Instructor nets | $75.00 − $1.88 | $73.12 |
| On full refund, DriveBook loses | Stripe sunk cost (not refunded) | $1.58 |
| On full refund, DriveBook net | $0.30 − $1.58 | **−$1.28** per refund |

**Note on refund economics:** With `refund_application_fee: true`, the $1.88 application fee
is refunded proportionally. DriveBook still paid $1.58 to Stripe on the original charge,
which is non-refundable. On a full refund, DriveBook loses $1.28.

**Rate note:** The 2.5% application fee remains viable at this rate — DriveBook earns a small positive margin ($0.30) per successful transaction. The rate should be revisited if Stripe's AU pricing changes materially. The rate must be confirmed against the current Stripe AU pricing page at implementation time.

**Per $75 lesson, per-dispute cost to DriveBook:**

| Item | Amount |
|---|---|
| Stripe dispute received fee | A$25.00 |
| Stripe dispute countered fee (if contested) | A$25.00 (refunded if won, forfeited if lost) |
| If dispute lost: full amount debited from platform | $75.00 |
| Transfer reversal recovery (if connected account has funds) | −$73.12 (instructor's portion) |
| Net loss to DriveBook on lost dispute, connected account solvent, not contested | $25.00 received fee + $1.88 application fee = **$26.88** |
| Net loss to DriveBook on lost dispute, connected account solvent, contested | $25.00 received fee + $25.00 countered fee + $1.88 = **$51.88** |
| Net loss to DriveBook on lost dispute, connected account empty | $25.00 + $75.00 = **$100.00** (+ $25.00 if contested) |

This risk profile is the same in kind as PLATFORM mode (DriveBook loses the full amount if
connected account is empty), but the frequency is expected to be lower for PREMIUM tier
instructors with established businesses.

---

## 7. Merchant of Record and Australian Tax — Scope Limitation

v1 stated that the instructor is the "merchant of record" in DIRECT mode and that GST/BAS
obligations shift to the instructor. The reviewer correctly identified that these conclusions
are not supportable from Stripe settlement mechanics alone.

**What Stripe mechanics establish:**
- In Model A (destination charge with `on_behalf_of`): the student sees the instructor's statement descriptor; the charge is stored on DriveBook's platform account
- In Model B (direct charge): the charge is stored on the connected account; the connected account is the settlement account
- `on_behalf_of` affects statement descriptor and some presentment details; it does not, by itself, determine who is the legal merchant of record

**What Stripe mechanics do NOT establish:**
- Legal merchant of record status under Australian consumer law
- GST/BAS obligation allocation (which party must register, collect and remit GST on lesson fees)
- Whether the instructor or DriveBook is liable under the AFCA or ASIC regulatory frameworks for payment disputes

**Decision: merchant-of-record and Australian tax conclusions are out of scope for this ADR.**
These require a separate legal and tax assessment. This ADR defines only the Stripe
settlement mechanics and ledger invariants. The product team and legal counsel must assess:
- Whether DriveBook or the instructor is the merchant of record under Australian Consumer Law in DIRECT mode
- Whether the instructor's ABN/GST registration is sufficient for DIRECT mode
- Whether DriveBook's existing terms of service cover DIRECT mode payment arrangements

Until that assessment is complete, DIRECT mode must not be described in any public-facing
material as moving merchant-of-record or tax obligations to the instructor.

---

## 8. Updated Implementation Pre-Conditions (G01–G09)

These gaps must be resolved before DIRECT mode is activated. No code changes are authorised
by this ADR.

| Gap | Location | Description | Revised from v1? |
|---|---|---|---|
| G01 | `lib/services/stripe.ts` | `createDirectPaymentIntent()` referenced in design doc at line 110 as complete; not found in current source. Must be confirmed present or rebuilt. | No change |
| G02 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `payment_intent.succeeded`. Would incorrectly write full-amount `PAYMENT_COLLECTED` LedgerEntry for DIRECT bookings. | No change |
| G03 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `charge.refunded`. Would incorrectly write full-amount `REFUND_ISSUED` and corrupt `PlatformLedger.totalRefunded`. | No change |
| G04 | `lib/services/chargebackAutomation.ts` | No `paymentMode === 'DIRECT'` branch. Must not freeze a payout (none exists); must initiate `stripe.transfers.createReversal()` on dispute loss; must not write full-amount `DISPUTE_LOST` LedgerEntry. | **Revised** — v1 incorrectly said instructor bears chargeback; platform is actually debited first and must reverse transfer to recover |
| G05 | `prisma/schema.prisma` | `Booking.directApplicationFeeId` field does not exist. Useful for audit/reconciliation; not required if using `reverse_transfer + refund_application_fee` approach but recommended. | **Revised** — no longer a hard blocker for refund procedure |
| G06 | `lib/services/payout-service.ts` | `buildPayout()` does not exclude `paymentMode === 'DIRECT'` transactions. Would queue DIRECT bookings for payout despite instructor already holding funds. | No change |
| G07 | `lib/utils/account.ts` | `assertPlatformPaymentMode()` has zero call sites in production payment routes. Four separate inline guards exist instead. | No change |
| G08 | `lib/services/platform-pricing.ts` / `prisma/schema.prisma` | No `directApplicationFeeRate` config field. Needs `PlatformSettings.directApplicationFeePercentage Decimal @default(2.5)`. | No change |
| G09 | `lib/services/saas-payment.ts` | `application_fee_amount` set without `transfer_data.destination` or connected-account context. Validity unresolved pending WLA-004. | No change |
| G10 | Application-fee sub-ledger | No LedgerEntry type or PlatformLedger field exists to track `application_fee_amount` income per DIRECT booking. The existing `totalCollected` must not be used. A new tracking mechanism (e.g. `totalApplicationFeesCollected`) must be designed. | **NEW in v2** |
| G11 | Transfer-reversal automation | No `stripe.transfers.createReversal()` call exists anywhere in the codebase. Required for DIRECT dispute loss and potentially for DIRECT refunds where the connected account must be debited. | **NEW in v2** |

---

## 9. Mode Separation Rules (Binding Constraints)

These rules are unchanged from v1 except where noted.

| Rule | Constraint |
|---|---|
| S-01 | Every `LedgerEntry` write and `PlatformLedger` mutation must check `booking.paymentMode` before executing. DIRECT bookings must not use `totalCollected`, `totalReserved`, or `totalPaidOut`. |
| S-02 | `assertPlatformPaymentMode()` must be called from every payment entry point. Inline guards may remain as belt-and-suspenders. |
| S-03 | SaaS, PLATFORM, and DIRECT must not share commission config stores. DIRECT requires a separate `directApplicationFeeRate` in `PlatformSettings`. |
| S-04 | DIRECT mode requires PREMIUM subscription AND `provider.chargesEnabled === true`. |
| S-05 | `buildPayout()` must exclude DIRECT booking transactions from the payout queue. |
| S-06 | Refunds on DIRECT destination charges must include `reverse_transfer: true`. Omitting it leaves the connected account with the funds while DriveBook covers the refund. **(Corrected from v1)** |
| S-07 | `stripe.transfers.createReversal()` must be called on DIRECT dispute loss/acceptance to recover disputed funds from the connected account. This does not guarantee full recovery if the connected account balance is zero. **(New in v2)** |
| S-08 | DIRECT mode must not be described as making the instructor the merchant of record or shifting GST/BAS obligations until a separate legal/tax assessment is completed. **(New in v2)** |

---

## 10. What Must Not Change About Current PLATFORM Behaviour

Unchanged from v1. No current code should be modified as a result of this ADR.

- `createPaymentIntent()` in `stripe.ts` — no `transfer_data`, no `on_behalf_of`
- `PlatformLedger.totalCollected` increment on `payment_intent.succeeded`
- `buildPayout()` eligibility gates and dispute buffer
- `executePayout()` PAY-01 ownership check
- `assertSufficientBalance()` and `assertNonNegativeBalance()` guards
- `getCommissionRate()` tier-based rates from `PlatformSettings`
- `REFUND_ISSUED` + `ADJUSTMENT` flow for post-payout refunds
- Dispute webhook: `DISPUTE_OPENED` → hold payout → `DISPUTE_WON/LOST`

---

## 11. Decision Summary

| Question | Answer (v2) |
|---|---|
| What Stripe charge type for DIRECT mode? | Model A: destination charge with `on_behalf_of` + `transfer_data.destination` |
| Who receives funds first in DIRECT? | DriveBook platform account receives full amount; application fee is retained; instructor's account receives the remainder atomically |
| Who receives full lesson amount? | Instructor's connected account (via atomic transfer in same API call) |
| Student's bank statement in DIRECT? | Instructor's Stripe statement descriptor (due to `on_behalf_of`) |
| Who is debited for disputes in DIRECT? | **DriveBook platform account** — destination charge disputes always debit the platform |
| How does DriveBook recover disputed funds? | `stripe.transfers.createReversal()` — not guaranteed if connected account is empty |
| Who is debited for Stripe processing fees in DIRECT? | DriveBook (destination charges use platform pricing) |
| Who is debited for refunds in DIRECT? | DriveBook platform — must use `reverse_transfer: true` to recover from connected account |
| What application fee rate? | 2.5% — DriveBook nets ~$0.34 per $75 lesson; loses ~$1.20 per full refund (Stripe sunk cost) |
| Can PLATFORM and DIRECT share the ledger? | No. DIRECT must not touch totalCollected/totalReserved/totalPaidOut for full booking amounts. |
| Can PLATFORM and DIRECT share the payout queue? | No. `buildPayout()` must exclude DIRECT. |
| What are the new preconditions vs v1? | G10 (application-fee sub-ledger), G11 (transfer-reversal logic) |
| Is merchant-of-record/tax addressed? | No — out of scope; requires separate legal/tax assessment |
| Can DIRECT be activated from current source? | No. G01–G11 must be resolved. |
| Is current PLATFORM behaviour correct? | Yes — verified per MM-10-A and source inspection. No changes required. |
| Is current SaaS flow a confirmed baseline? | No — WLA-004 unresolved; `application_fee_amount` validity on plain platform charge is unverified. |

---

## 12. Relationship to Other Findings

- **MM-10-A (SUPERSEDED):** SaaS money on platform is intentional. WLA-002 extends this for DIRECT.
- **WLA-001 (closed):** Missing DIRECT guard on quote-accept route fixed. G07 consolidation of inline guards remains open.
- **WLA-004 (FINDING):** `application_fee_amount` without connected-account context. This ADR explicitly declares it unresolved and does not rely on the SaaS path as a working baseline.
- **WLA-005 (OPEN — next):** Wallet ownership. DIRECT mode refunds go back to card (Stripe handles via `reverse_transfer`), not to wallet. WLA-005 wallet semantics should not assume DIRECT bookings generate wallet credits.
- **PAY-01 (closed):** `verifyPayoutDestinationOwnership()` remains in `executePayout()` for PLATFORM. In DIRECT mode there is no `executePayout()` call — the transfer is atomic at charge creation.
- **SEC-CRED-01 (ACTIVE CRITICAL — deferred):** Unrelated to settlement semantics.

---

*This document is an architecture decision record. It does not implement any code changes.
It must be reviewed and accepted before any DIRECT mode implementation work begins.
Current PLATFORM code is unchanged.*

*Content was paraphrased for compliance with licensing restrictions. Stripe documentation sources are cited inline.*
