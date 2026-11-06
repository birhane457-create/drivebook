# WLA-002 — Provider Settlement Semantics: Architecture Decision Record (v6)

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary that becomes a code defect when DIRECT mode is activated.  
**Status:** ARCHITECTURE DECISION DEFINED (v6) — pending reviewer acceptance  
**v1–v5 history:** NOT ACCEPTED (see appendix A for full rejection history)  
**v6 authored:** 2026-11-06  
**Central correction from v5:** v1–v5 assumed a destination charge (Model A): student pays booking rate + platform fee; DriveBook is the charge merchant; `transfer_data.destination` routes money to the instructor. This is wrong. The intended DIRECT model is a **direct charge on the instructor's connected account**: student pays the provider's advertised price only; DriveBook collects a provider-funded application fee from the instructor's proceeds. This is a different Stripe charge type with different fund flow, different dispute/refund mechanics, and different fee funding.

**Sources inspected (code):**  
- `lib/services/stripe.ts` — `createConnectAccount()`: `type: 'express'`, `country: 'AU'`  
- `lib/services/payout-service.ts`, `lib/services/ledger-service.ts`  
- `lib/services/booking-service.ts` — `calculatePartialPackageRefund()` (PLATFORM package refunds, already implemented)  
- `lib/utils/account.ts` — `assertPlatformPaymentMode()`, `getAccountFeatures()`  
- `docs/newplan/PAYMENT-WHITE-LABEL.md` — original DIRECT design spec  

**Stripe documentation referenced:**  
- [Create direct charges](https://docs.stripe.com/connect/direct-charges) — direct charge mechanics, `application_fee_amount`, refunds  
- [Handle refunds and disputes (SaaS/direct charges)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes) — dispute debit rules, `refund_application_fee`  
- [Disputes on Connect platforms](https://docs.stripe.com/connect/disputes) — charge-type comparison  
- [Fee behavior on connected accounts](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior) — `fees_collector` configuration  
- [Stripe Australia pricing](https://stripe.com/AU/pricing) — 1.70% + A$0.30 domestic (confirmed 2026-11-06)  

---

## 1. Original Finding

> "Provider-settlement requirements for the proposed white-label mode are not yet specified."

This ADR defines the settlement boundary for DIRECT mode (SaaS/white-label) and establishes its separation from the existing PLATFORM (Marketplace) mode.

---

## 2. The Two Payment Arrangements

There are two distinct payment arrangements. The critical distinction is **who funds DriveBook's fee**.

| Aspect | Marketplace (PLATFORM) | SaaS / DIRECT |
|---|---|---|
| Who funds DriveBook's fee? | **Student** | **Provider** |
| How is the fee collected? | Added to the student's payment | Deducted from the provider's payment proceeds |
| Student pays | Booking/package rate + platform fee surcharge | Provider's advertised price only — nothing added |
| Provider receives | Booking rate − commission (via weekly payout) | Booking rate − application fee − Stripe processing cost |
| DriveBook receives | Commission (% of booking rate) | Application fee (% of booking rate, from provider's proceeds) |
| Stripe charge created on | DriveBook platform account | Provider's connected account (`Stripe-Account` header) |
| Student's bank statement | "DRIVEBOOK.COM.AU" | Provider's Stripe statement descriptor |

These two modes must remain architecturally separate. This ADR governs DIRECT/SaaS mode only. PLATFORM mode is unchanged.

---

## 3. Current PLATFORM Settlement — Source-Verified (unchanged)

In PLATFORM mode, DriveBook is the Stripe merchant. Students pay DriveBook. DriveBook deducts commission and pays instructors weekly via Stripe Connect transfers.

```
Student pays: bookingRate + 3.6% surcharge → DriveBook Stripe account
DriveBook commission (10–15% by tier) deducted from booking rate
providerPayout = bookingRate − commission
Weekly executePayout() → Stripe transfer to provider's connected account
PlatformLedger.totalCollected += bookingRate + surcharge
PlatformLedger.totalPaidOut  += providerPayout
```

This is the only currently active mode. PLATFORM behaviour is not changed by this ADR.

**PLATFORM package refunds** (already implemented — `calculatePartialPackageRefund()`):
- Platform fee: non-refundable, always retained
- Used hours: repriced at full (undiscounted) hourly rate
- Package discount: voided if remaining unused hours fall below the minimum-hours threshold for that tier
- The clawback formula is implemented and audited (H-01, `PACKAGE-ACCOUNTING-POLICY.md §4`)

---

## 4. DIRECT Mode — Stripe Charge Type Decision

### 4.1 Charge type: Direct Charge on the connected account

```typescript
// Charge is created ON the provider's connected account, not on DriveBook's account
stripe.paymentIntents.create(
  {
    amount: Math.round(bookingRateCents),      // provider's advertised price — nothing added
    currency: 'aud',
    payment_method_types: ['card'],
    application_fee_amount: Math.round(bookingRateCents * 0.025),  // DriveBook's provider-funded fee
  },
  { stripeAccount: providerStripeAccountId }   // Stripe-Account header — direct charge
)
```

**Stripe-verified behaviour (direct charges, from [Stripe docs](https://docs.stripe.com/connect/direct-charges)):**

> "The charge amount – less the Stripe fees and application fee – is deposited into the connected account."

- Charge is stored on the **provider's connected account**, not DriveBook's
- Student sees the provider's Stripe statement descriptor (connected account branding, per Stripe docs)
- Stripe processing fees are deducted from the **connected account's balance** (provider-funded)
- `application_fee_amount` is transferred from the connected account to the **DriveBook platform account**
- Provider nets: `bookingRate − application_fee − Stripe_processing_cost`
- DriveBook nets: `application_fee_amount` (the 2.5% fee)

### 4.2 Why direct charge, not destination charge

| Aspect | Destination charge (v1–v5, rejected) | Direct charge (v6, decided) |
|---|---|---|
| Fee funding | Student pays (fee added to charge amount) | Provider pays (fee deducted from their proceeds) |
| Student pays | bookingRate + 2.5% | bookingRate only |
| Stripe charge on | Platform account | Connected account |
| Dispute debit | Platform account | Connected account |
| Stripe processing fees paid by | Platform (DriveBook) | Connected account (provider) |
| Consistent with intended product | No | Yes |

### 4.3 Connected account configuration

`createConnectAccount()` creates `type: 'express'` accounts (v1 legacy). For the direct charge model:

- **Stripe processing fees:** deducted from the connected account's balance (provider-funded)
- **Dispute fees (`fees_collector`):** for legacy Express accounts (`application_express`), dispute fees are charged to the **connected account** — this is consistent with the provider-funded model
- **Negative balances:** DriveBook (platform) remains responsible for connected account negative balances — this is an Express account limitation that cannot be avoided without migrating to Accounts v2 with `losses_collector: "stripe"`
- **Express Dashboard:** connected accounts can view payments, issue refunds, and manage disputes from their Express Dashboard — appropriate for DIRECT mode where provider handles their own refund flow

---

## 5. Fund Flow — DIRECT Mode

### 5.1 Successful payment (booking rate $70, 2.5% application fee)

```
Student pays:               $70.00  (provider's advertised rate — nothing added)
Stripe creates charge on:   Provider's connected account
Stripe deducts:             application_fee = $1.75  (2.5% × $70)
Stripe deducts:             processing cost = $1.19  (1.70% × $70 + $0.30)
Provider nets:              $70.00 − $1.75 − $1.19 = $67.06
DriveBook receives:         $1.75  (application fee transferred to platform)
DriveBook's Stripe balance: +$1.75 only (not $70)
```

### 5.2 Refund — student requests refund, provider handles it

**Who handles refunds in DIRECT mode:** Per the product rule, the provider handles refunds. DriveBook facilitates the API call (using its platform secret key with the `Stripe-Account` header pointing to the provider's account) but the refund is debited from the **provider's connected account balance**.

**Application fee policy: non-refundable**

On a DIRECT mode booking refund, DriveBook retains the 2.5% application fee. The student receives back the booking rate ($70). The refund comes from the provider's connected account balance.

```typescript
// Refund on a direct charge — authenticated as the connected account
await stripe.refunds.create(
  {
    charge: chargeId,
    amount: bookingRateInCents,       // $70.00 in cents — full booking rate
    // refund_application_fee: false  (default) — DriveBook retains the $1.75 fee
  },
  { stripeAccount: providerStripeAccountId }
)
// Result:
// Student receives: $70.00 (from provider's connected account balance)
// Provider's account: debited $70.00
// DriveBook retains: $1.75 application fee (non-refundable)
// Stripe sunk cost: $1.19 processing cost (non-refundable by Stripe)
```

**Important Stripe note (from [direct charges docs](https://docs.stripe.com/connect/direct-charges)):**

> "Application fees aren't automatically refunded when issuing a refund. Your platform must explicitly refund the application fee or the connected account loses that amount."

This means the default behaviour (`refund_application_fee` omitted or `false`) correctly retains the application fee on DriveBook's platform account. No extra step needed to retain it.

**DriveBook net position on full refund:**
- Application fee retained: $1.75
- Stripe processing cost (non-refundable): $1.19 — this was paid from the **provider's account**, not DriveBook's
- DriveBook net: **+$1.75** (full application fee, since Stripe's processing cost was never DriveBook's)

This is materially different from v5 (destination charges) where DriveBook paid Stripe's processing cost and lost ~$1.59 on refund. In the direct charge model, Stripe's processing cost is the provider's, not DriveBook's. DriveBook's only cost is any application fee it chooses to refund — which under the non-refundable policy is zero.

**Partial refund (e.g. 50% of booking rate):**
```typescript
await stripe.refunds.create(
  {
    charge: chargeId,
    amount: 3500,    // $35.00 — 50% of $70
    // refund_application_fee: false — application fee retained in full
  },
  { stripeAccount: providerStripeAccountId }
)
```
Per Stripe: if `refund_application_fee: true`, a partial refund returns a proportional fee amount. Under the non-refundable policy, we do not set `refund_application_fee: true`.

### 5.3 Dispute and chargeback handling

**Per [Stripe docs (direct charges)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes):**

> "With direct charges, your platform creates payments on the connected account. Stripe debits refunds and disputed amounts from that account's balance."

| Step | Action |
|---|---|
| `charge.dispute.created` fires | Stripe debits **provider's connected account** (not DriveBook's platform) |
| Dispute fee (`fees_collector: application_express`) | Charged to **connected account** |
| Dispute response | DriveBook provides embedded dispute components or the provider responds via Express Dashboard |
| If dispute lost | Connected account balance is debited; provider bears the loss |
| If connected account has insufficient balance | **DriveBook (platform) is liable** for the negative balance — Express account limitation |
| DriveBook's application fee on dispute loss | DriveBook retains it (provider lost the dispute, not DriveBook's obligation to refund) |

**Key difference from PLATFORM mode:** In DIRECT mode, disputes debit the **provider's** account, not DriveBook's. DriveBook's direct financial exposure on a dispute is limited to the case where the connected account has insufficient funds — then DriveBook bears the negative balance as the platform responsible for Express accounts.

**Webhook handling for DIRECT disputes:** The webhook fires `charge.dispute.created` against the connected account, not the platform. DriveBook must listen to events on connected accounts or use Connect webhooks. No `PlatformLedger` entries must be written for DIRECT disputes (see section 6).

---

## 6. Ledger Separation — DIRECT Must Not Touch PlatformLedger

`PlatformLedger` tracks PLATFORM-mode money only (funds that passed through DriveBook's Stripe account as full settlement amounts). In DIRECT mode:
- DriveBook never holds the student's $70 — the charge is on the connected account
- `totalCollected`, `totalReserved`, `totalPaidOut`, `totalRefunded` must not be incremented for DIRECT bookings
- No `PAYMENT_COLLECTED`, `PAYOUT_PAID`, or `REFUND_ISSUED` LedgerEntries must be created for full booking amounts

### 6.1 DirectSettlementEntry model (G10 — precondition)

A separate settlement record is required for DIRECT bookings. The amounts tracked are DriveBook's fee revenue only, not the full booking amount.

```prisma
model DirectSettlementEntry {
  id               String   @id @default(cuid())
  bookingId        String
  booking          Booking  @relation(fields: [bookingId], references: [id])
  providerId       String
  entryType        DirectSettlementEntryType
  amountCents      Int      // signed: + = received by DriveBook, - = returned/lost
  stripeObjectId   String?  // ApplicationFee, Refund, or Dispute ID
  stripeObjectType String?
  note             String?
  createdAt        DateTime @default(now())

  @@index([bookingId])
  @@index([providerId])
}

enum DirectSettlementEntryType {
  APPLICATION_FEE_RECEIVED     // 2.5% × bookingRate received by DriveBook — positive
  APPLICATION_FEE_REFUNDED     // Fee returned to connected account (if policy changes) — negative
  DISPUTE_FEE_PLATFORM_PAID    // Only if platform is fees_collector (not current Express config)
  NEGATIVE_BALANCE_ABSORBED    // Platform covered connected account shortfall — negative
  NEGATIVE_BALANCE_RECOVERED   // Connected account repaid the platform — positive
}
```

**Reconciliation invariant for a settled DIRECT booking:**
```
APPLICATION_FEE_RECEIVED = 2.5% × bookingRate = $1.75 on $70
(DriveBook's only revenue from a DIRECT booking — the $70 never passes through DriveBook's account)
```

**Reconciliation invariant for a fully refunded DIRECT booking (non-refundable fee policy):**
```
DriveBook net = APPLICATION_FEE_RECEIVED = $1.75
(no NEGATIVE_BALANCE_ABSORBED, assuming connected account has sufficient funds)
(no APPLICATION_FEE_REFUNDED, under non-refundable policy)
```

---

## 7. Fee Economics (AU, 2026)

**Stripe AU domestic processing: 1.70% + A$0.30 (confirmed 2026-11-06). Check [stripe.com/AU/pricing](https://stripe.com/AU/pricing) at implementation.**

**Per $70 booking rate (DIRECT mode, domestic card):**

| Party | Item | Amount |
|---|---|---|
| Student pays | Provider's advertised rate | $70.00 |
| DriveBook receives | Application fee (2.5%) | $1.75 |
| Stripe deducts from provider | Processing cost (1.70% × $70 + $0.30) | $1.49 |
| Provider nets | $70.00 − $1.75 − $1.49 | $66.76 |

Note: Stripe's processing cost is borne by the provider (connected account), not DriveBook.

**On a full refund (booking rate refunded, application fee retained):**

| Party | Movement | Amount |
|---|---|---|
| Student receives | $70.00 refund from connected account | $70.00 |
| Provider's account | Debited $70.00 | −$70.00 |
| DriveBook retains | Application fee (non-refundable) | $1.75 |
| Stripe's processing cost | Not returned — borne by provider | $1.49 (provider's loss) |
| DriveBook net on refund | Application fee retained | **+$1.75** |

DriveBook's refund position is positive because Stripe's processing cost was never DriveBook's. This is fundamentally different from the destination-charge model (v5) where DriveBook bore the processing cost.

**Per-dispute cost to DriveBook:**

| Scenario | DriveBook exposure |
|---|---|
| Dispute debit | Connected account debited (not DriveBook) |
| Dispute fee | Connected account (Express: `application_express`) |
| If connected account has funds | DriveBook exposure = $0 |
| If connected account has insufficient funds | DriveBook covers negative balance — up to full disputed amount |

---

## 8. Wallet Top-Ups and Package Purchases in DIRECT Mode

Per the product rule, the platform fee applies consistently to packages, single bookings, and wallet top-ups.

**Wallet top-ups (DIRECT):**
- Student pays the requested top-up amount (e.g. $100) — no surcharge added to student
- Provider's connected account is charged $100
- DriveBook collects application fee (2.5% = $2.50) from provider's proceeds
- Wallet is credited with the top-up amount ($100) — only the requested amount, not the application fee
- Application fee is recorded separately in `DirectSettlementEntry`

**Package purchases (DIRECT):**
- Same additive fee structure as single bookings: provider pays the 2.5% application fee
- Student pays the package price only
- Package refund clawback rules (from `calculatePartialPackageRefund()`) apply in both modes for the booking-rate portion
- Application fee is retained on refund under the non-refundable policy regardless of partial/full refund

---

## 9. Mode Separation Rules (Binding)

| Rule | Constraint |
|---|---|
| S-01 | `PlatformLedger` fields (`totalCollected`, `totalReserved`, `totalPaidOut`, `totalRefunded`) must not be written for DIRECT bookings |
| S-02 | `assertPlatformPaymentMode()` must be called from all payment entry points; no DIRECT booking may reach `createPaymentIntent()` (PLATFORM path) |
| S-03 | PLATFORM commission config and DIRECT application fee config must remain separate stores |
| S-04 | DIRECT mode requires PREMIUM subscription AND `provider.chargesEnabled === true` |
| S-05 | `buildPayout()` must exclude DIRECT booking transactions |
| S-06 | DIRECT refunds are debited from the connected account (provider), not DriveBook's platform balance |
| S-07 | DriveBook retains the application fee on DIRECT refunds unless a future policy change explicitly sets `refund_application_fee: true` |
| S-08 | Merchant-of-record and Australian tax obligations require separate legal/tax assessment — not determined by this ADR |
| S-09 | No `PAYMENT_COLLECTED`, `PAYOUT_PAID`, or `REFUND_ISSUED` LedgerEntries must be written for DIRECT bookings against PlatformLedger |

---

## 10. Implementation Pre-Conditions (G01–G11)

These must all be resolved before DIRECT mode is activated. No code changes are authorised by this ADR.

| Gap | Location | Description |
|---|---|---|
| G01 | `lib/services/stripe.ts` | `createDirectPaymentIntent()` (using `Stripe-Account` header, not `transfer_data.destination`) — referenced in design doc but absent from current source |
| G02 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `payment_intent.succeeded` — must not write full-amount PLATFORM LedgerEntries |
| G03 | `app/api/stripe/webhook/route.ts` | No `paymentMode === 'DIRECT'` branch in `charge.refunded` |
| G04 | `lib/services/chargebackAutomation.ts` | No DIRECT branch — for direct charges, disputes debit the connected account, not DriveBook; must not write PLATFORM dispute LedgerEntries |
| G05 | `prisma/schema.prisma` | `Booking.directApplicationFeeId String?` — for audit/reconciliation of the ApplicationFee object |
| G06 | `lib/services/payout-service.ts` | `buildPayout()` must exclude DIRECT transactions |
| G07 | `lib/utils/account.ts` | `assertPlatformPaymentMode()` has zero call sites in production routes — must be unified |
| G08 | `lib/services/platform-pricing.ts` / schema | No `directApplicationFeeRate` config — needs `PlatformSettings.directApplicationFeePercentage Decimal @default(2.5)` |
| G09 | `lib/services/saas-payment.ts` | `application_fee_amount` without connected-account context — validity unresolved pending WLA-004 |
| G10 | `prisma/schema.prisma` | `DirectSettlementEntry` model and `DirectSettlementEntryType` enum not implemented |
| G11 | `lib/services/` | No Connect webhook listener for events on connected accounts (required for DIRECT dispute visibility) |

---

## 11. What Must Not Change About PLATFORM Behaviour

No current code is modified by this ADR. The following are verified correct and must remain unchanged:
- `createPaymentIntent()` — no `Stripe-Account` header, no `application_fee_amount`
- `PlatformLedger.totalCollected` increment on `payment_intent.succeeded`
- `buildPayout()` / `executePayout()` — PAY-01 ownership check, eligibility gates
- `calculatePartialPackageRefund()` — package discount clawback, platform fee retained
- Commission rates via `PlatformSettings`
- `REFUND_ISSUED` + `ADJUSTMENT` flow for post-payout PLATFORM refunds

---

## 12. Decision Summary

| Question | Answer |
|---|---|
| Stripe charge type for DIRECT? | **Direct charge on connected account** (`Stripe-Account` header) |
| Who pays DriveBook's fee in DIRECT? | **Provider** (deducted from their payment proceeds) |
| Student pays in DIRECT? | Provider's advertised price only — no surcharge added |
| Who pays Stripe processing cost in DIRECT? | **Provider** (connected account) |
| DriveBook's revenue per DIRECT booking? | Application fee only (2.5% × bookingRate) |
| Who handles refunds in DIRECT? | Provider (connected account is debited); DriveBook facilitates via API with `Stripe-Account` header |
| Is application fee refunded? | No — non-refundable policy; `refund_application_fee` defaults to `false` |
| DriveBook net on full DIRECT refund? | +application_fee_amount (retained); Stripe processing cost is provider's — not DriveBook's |
| Who bears dispute cost in DIRECT? | Provider (connected account debited first); DriveBook only if connected account has insufficient funds |
| Can PLATFORM and DIRECT share PlatformLedger? | No — DIRECT must use `DirectSettlementEntry` only |
| Can DIRECT be activated from current source? | No — G01–G11 must be resolved |
| Is PLATFORM behaviour changed by this ADR? | No |

---

## Appendix A — Version History

| Version | Status | Primary rejection reason |
|---|---|---|
| v1 | NOT ACCEPTED | Dispute liability incorrectly assigned to instructor |
| v2 | NOT ACCEPTED | AU processing rate stale; DIRECT dispute ledger contradicted section 6.5 |
| v3 | NOT ACCEPTED | Refund loss calculation incorrect; G10 design insufficient |
| v4 | NOT ACCEPTED | Platform fee inverted — charged on top of booking rate instead of additive |
| v5 | NOT ACCEPTED | Entire charge type wrong — destination charge assumed; correct model is direct charge on connected account; fee is provider-funded not student-funded |

---

*This document is an architecture decision record. No code changes are implemented here. DIRECT mode remains blocked until G01–G11 are resolved and this ADR is accepted.*

*Stripe documentation sources are cited inline. Content was paraphrased for compliance with licensing restrictions.*
