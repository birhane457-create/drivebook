# WLA-002 — Provider Settlement Semantics: Architecture Decision Record (v7)

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary that becomes a code defect when DIRECT mode is activated.  
**Status:** ARCHITECTURE DECISION DEFINED (v7) — pending reviewer acceptance  
**v1–v6 history:** NOT ACCEPTED (see appendix A for full rejection history)  
**v7 authored:** 2026-11-06  
**v6 rejection reason:** (1) Arithmetic error — $1.49 processing cost written as $1.19; provider net $66.76 written as $67.06. (2) Connected-account configuration wrong — recommended Accounts v2 with `fees_collector: "stripe"`, `losses_collector: "stripe"`, Standard account, full Dashboard access; not legacy Express. (3) Refund procedure wrong — provider initiates refunds directly through Stripe, DriveBook does not facilitate; DriveBook processes webhooks only. (4) Dispute handling wrong — provider manages via Stripe Dashboard; DriveBook must not claim zero legal liability. (5) Scope too broad — wallet top-ups and wallet-funded packages out of scope until WLA-005. (6) Australian card-surcharge compliance not reviewed.

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

**Current state:** `createConnectAccount()` creates `type: 'express'` accounts (v1 legacy model). This is not the intended configuration for DIRECT mode.

**Recommended configuration for DIRECT mode (Accounts v2):**

| Setting | Value | Rationale |
|---|---|---|
| Account type | **Standard** (Accounts v2) | Full Stripe Dashboard access — provider can manage payments, issue refunds, and respond to disputes directly |
| `fees_collector` | **`"stripe"`** | Stripe collects its own processing fees from the connected account's payment; provider sees Stripe's standard pricing, not DriveBook's |
| `losses_collector` | **`"stripe"`** | Stripe absorbs negative balances on connected accounts — DriveBook is not liable for connected-account shortfalls (unlike Express) |
| Charge type | **Direct charges** | Charge created on the connected account using `Stripe-Account` header |

**Accounts v2 with Managed Risk:** Per [Stripe docs](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk), Stripe manages credit and fraud risk and assumes losses from unrecoverable negative balances when `losses_collector: "stripe"` is configured. This is recommended for SaaS platforms using direct charges.

**Unresolved assumption — Australian eligibility:** Accounts v2 features (`fees_collector: "stripe"`, `losses_collector: "stripe"`) must be verified for Australian-registered connected accounts. The Stripe changelog indicates Express connected accounts v2 support was added with Stripe-owned pricing and negative-balance liability, but actual availability for DriveBook's AU integration must be confirmed with Stripe before recording this as an established capability.

**Migration required:** Current `createConnectAccount()` creates Express accounts. Migrating to Accounts v2 Standard accounts is a precondition for DIRECT mode. This migration has not been authorised and is out of scope for this ADR.

---

## 5. Fund Flow — DIRECT Mode

### 5.1 Successful payment (booking rate $70, 2.5% application fee)

```
Student pays:               $70.00  (provider's advertised rate — nothing added)
Stripe creates charge on:   Provider's connected account
Stripe deducts:             application_fee = $1.75  (2.5% × $70)
Stripe deducts:             processing cost = $1.49  (1.70% × $70 + $0.30 = $1.19 + $0.30)
Provider nets:              $70.00 − $1.75 − $1.49 = $66.76
DriveBook receives:         $1.75  (application fee transferred to platform)
DriveBook's Stripe balance: +$1.75 only (not $70)
```

### 5.2 Refund — provider manages refunds directly

**Who handles refunds in DIRECT mode:** The provider initiates and manages refunds directly through their Stripe Dashboard. DriveBook must **not** initiate or facilitate provider refunds through its application. DriveBook's role is limited to processing refund webhooks to update booking status and accounting records.

**Application fee policy: non-refundable**

On a DIRECT mode booking refund, DriveBook retains the 2.5% application fee. Per [Stripe docs](https://docs.stripe.com/connect/direct-charges):

> "Application fees aren't automatically refunded when issuing a refund. Your platform must explicitly refund the application fee or the connected account loses that amount."

This means when the provider issues a refund through their Stripe Dashboard, the default behaviour retains the application fee on DriveBook's platform account. The provider would need to explicitly choose to refund the application fee for it to be returned.

**Refund flow:**

```
1. Provider issues refund in Stripe Dashboard (or via Stripe API on their own account)
   → Student receives bookingRate ($70.00) from provider's connected account balance
   → Application fee ($1.75) retained by DriveBook (default: refund_application_fee = false)

2. Stripe fires charge.refunded webhook (on connected account)
   → DriveBook webhook listener receives event
   → Updates Booking status (CANCELLED / REFUNDED)
   → Records DirectSettlementEntry if application fee was returned or retained
   → Does NOT write PlatformLedger entries

3. Application-fee retention recorded separately:
   → DirectSettlementEntry(APPLICATION_FEE_RECEIVED) already exists from original charge
   → If provider refunded with refund_application_fee: false (default): no APPLICATION_FEE_REFUNDED entry
   → If provider chose to refund the fee: APPLICATION_FEE_REFUNDED entry (negative)
```

**DriveBook net position on full refund (application fee retained):**
- Application fee retained: $1.75
- Stripe processing cost: $1.49 — borne by the provider, not DriveBook
- DriveBook net: **+$1.75** (full application fee retained)

**Partial refunds:** The provider issues partial refunds through Stripe Dashboard. The application fee is retained proportionally by default (per Stripe: if the provider does not set `refund_application_fee: true`, the fee is not returned). DriveBook processes the webhook to update booking state accordingly.

**ACL compliance note:** A non-refundable application fee is the intended product policy. Under Australian Consumer Law, consumer statutory rights may override a disclosed non-refundable fee in certain circumstances (e.g. service not delivered, major failure). The terms and refund handling must receive legal review before DIRECT mode launches.

### 5.3 Dispute and chargeback handling

**Per [Stripe docs (direct charges)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes):**

> "With direct charges, your platform creates payments on the connected account. Stripe debits refunds and disputed amounts from that account's balance."

| Step | Action |
|---|---|
| `charge.dispute.created` fires | Stripe debits **provider's connected account** (not DriveBook's platform) |
| Dispute response | **Provider manages dispute responses through the full Stripe Dashboard** (requires Standard account type) |
| If dispute lost | Connected account balance is debited; provider bears the loss |
| Negative-balance responsibility | **Depends on account configuration** — see below |

**Negative-balance responsibility (unresolved assumption):**

The configured negative-balance responsibility depends on the connected account configuration:
- **Accounts v2 with `losses_collector: "stripe"` (recommended):** Stripe absorbs negative balances — DriveBook is not financially liable for connected-account shortfalls
- **Accounts v1 Express (current):** DriveBook (platform) is liable for connected-account negative balances
- **Accounts v2 with `losses_collector: "application"`:** DriveBook is liable

The actual configuration must be verified at implementation time. This ADR recommends `losses_collector: "stripe"` but does not claim it has been configured or verified. DriveBook's legal and financial liability for disputes cannot be determined from Stripe settlement mechanics alone — it depends on the agreement with the provider, the Stripe account configuration, and Australian law.

**DriveBook's application fee on dispute loss:** If the provider loses a dispute, DriveBook retains the application fee. The provider's loss does not create an obligation for DriveBook to return the fee. Whether DriveBook chooses to return the fee as a goodwill measure is a separate product decision.

**Webhook handling for DIRECT disputes:** The `charge.dispute.created` event fires against the connected account, not the platform. DriveBook must listen to events on connected accounts via Connect webhooks (G11). Dispute event delivery and reconciliation must be verified before DIRECT activation. No `PlatformLedger` entries must be written for DIRECT disputes (see section 6).

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
| Dispute fee | Connected account (depends on `fees_collector` configuration) |
| If connected account has sufficient funds | DriveBook's direct Stripe-balance exposure is limited, but legal liability is not determined by balance alone |
| If connected account has insufficient funds | Depends on `losses_collector`: Stripe absorbs (v2 recommended) or DriveBook liable (v1 Express current) |
| DriveBook's legal liability | Not determined by this ADR — depends on provider agreement, Stripe configuration, and Australian law |

---

## 8. Scope Limitations

**Out of scope until WLA-005 is resolved:**
- DIRECT-mode wallet top-ups
- DIRECT-mode wallet-funded package purchases
- Wallet credit reversals and cash refund distinctions

Wallet ownership semantics (WLA-005) must be resolved before any DIRECT wallet integration is designed. This ADR covers single-booking and package purchases only.

**Package purchases in scope:**
- Provider pays the 2.5% application fee (same as single bookings)
- Student pays the package price only
- Package refund clawback rules (from `calculatePartialPackageRefund()`) apply in both modes for the booking-rate portion
- Application fee is retained on refund under the non-refundable policy

**Marketplace behaviour unchanged:** This ADR does not change any PLATFORM-mode behaviour, including wallet top-ups, wallet-funded bookings, commission rates, payout schedules, or package refund clawback.

**Australian card-surcharge compliance note:**

The Marketplace mode charges students a 3.6% platform fee surcharge. Under the [RBA surcharging framework](https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/), Australian merchants may apply cost-based surcharges but must not exceed the cost of accepting that card payment type. The RBA's March 2026 Conclusions Paper indicates the removal of surcharging on all designated card networks is under consideration. DriveBook's 3.6% Marketplace surcharge must be reviewed against the actual cost of acceptance and any regulatory changes before the surcharge is relied upon. This compliance review is separate from this ADR and is required for Marketplace mode, not DIRECT mode.

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
| G11 | `lib/services/` | No Connect webhook listener for events on connected accounts (required for DIRECT dispute and refund visibility) |
| G12 | `lib/services/stripe.ts` | `createConnectAccount()` creates Express accounts (v1); must migrate to Accounts v2 Standard with `fees_collector: "stripe"`, `losses_collector: "stripe"` — migration not authorised by this ADR |

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
| Who pays Stripe processing cost in DIRECT? | **Provider** (connected account, if `fees_collector: "stripe"`) |
| DriveBook's revenue per DIRECT booking? | Application fee only (2.5% × bookingRate) |
| Who initiates refunds in DIRECT? | **Provider** — directly through Stripe Dashboard; DriveBook does not facilitate |
| DriveBook's refund role | Processes refund webhooks to update booking/accounting state only |
| Is application fee refunded? | No — non-refundable policy; `refund_application_fee` defaults to `false` |
| DriveBook net on full DIRECT refund? | +$1.75 (full application fee retained; Stripe processing cost is provider's) |
| Who manages dispute responses? | **Provider** — through full Stripe Dashboard (Standard account) |
| Who bears dispute cost? | Connected account debited first; negative-balance responsibility depends on `losses_collector` configuration |
| Does DriveBook have zero legal liability? | Not claimed — depends on provider agreement, Stripe config, and Australian law |
| Are DIRECT wallet top-ups in scope? | No — out of scope until WLA-005 is resolved |
| Can PLATFORM and DIRECT share PlatformLedger? | No — DIRECT must use `DirectSettlementEntry` only |
| Can DIRECT be activated from current source? | No — G01–G11 must be resolved |
| Is PLATFORM behaviour changed by this ADR? | No |
| Is account migration authorised? | No — migration to Accounts v2 is a precondition, not authorised by this ADR |

---

## Appendix A — Version History

| Version | Status | Primary rejection reason |
|---|---|---|
| v1 | NOT ACCEPTED | Dispute liability incorrectly assigned to instructor |
| v2 | NOT ACCEPTED | AU processing rate stale; DIRECT dispute ledger contradicted section 6.5 |
| v3 | NOT ACCEPTED | Refund loss calculation incorrect; G10 design insufficient |
| v4 | NOT ACCEPTED | Platform fee inverted — charged on top of booking rate instead of additive |
| v5 | NOT ACCEPTED | Entire charge type wrong — destination charge assumed; correct model is direct charge on connected account; fee is provider-funded not student-funded |
| v6 | NOT ACCEPTED | Arithmetic error ($1.49 written as $1.19); wrong account config (Express, not Accounts v2 Standard); DriveBook facilitating refunds (should be provider-initiated); zero-liability claim for disputes; wallet top-ups in scope (should be out until WLA-005); no AU surcharge compliance review |

---

## Appendix B — Unresolved Assumptions

These assumptions must be verified before the ADR is accepted or DIRECT mode is activated:

1. **Accounts v2 Australian eligibility:** `fees_collector: "stripe"` and `losses_collector: "stripe"` must be confirmed available for Australian-registered connected accounts on DriveBook's Stripe platform. The Stripe changelog indicates support was added but actual availability must be verified.

2. **Standard account Dashboard access:** The recommendation assumes Standard accounts provide full Stripe Dashboard access in Australia. This must be confirmed for the specific Stripe product configuration DriveBook uses.

3. **Connect webhook event delivery:** Direct-charge dispute and refund events fire against the connected account. DriveBook must verify that Connect webhooks deliver these events reliably to the platform for reconciliation.

4. **Negative-balance responsibility:** The recommended `losses_collector: "stripe"` shifts negative-balance liability to Stripe. This must be confirmed in the actual account configuration — if not available or not configured, DriveBook remains liable.

5. **Australian Consumer Law and non-refundable fees:** The non-refundable application fee policy must be reviewed by legal counsel. ACL statutory rights may override the disclosed policy in certain circumstances.

6. **Australian card-surcharge compliance:** The Marketplace 3.6% surcharge must be reviewed against the RBA surcharging framework and any regulatory changes. This is a Marketplace compliance item, not a DIRECT-mode item, but is noted here for completeness.

7. **WLA-004 dependency:** The SaaS `application_fee_amount` path in `saas-payment.ts` remains unverified. This ADR does not treat the SaaS flow as a confirmed baseline.

8. **Merchant-of-record and tax obligations:** Out of scope for this ADR. Requires separate legal/tax assessment.

---

*This document is an architecture decision record. No code changes, account migration, or DIRECT activation are authorised by this ADR. DIRECT mode remains blocked until G01–G12 are resolved, this ADR is accepted by independent review, and all unresolved assumptions in Appendix B are verified.*

*Stripe documentation sources are cited inline. Content was paraphrased for compliance with licensing restrictions.*

*Sources: [Create direct charges](https://docs.stripe.com/connect/direct-charges), [Handle refunds and disputes (SaaS)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes), [Disputes on Connect](https://docs.stripe.com/connect/disputes), [Fee behavior on connected accounts](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior), [Managed Risk](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk), [Stripe AU pricing](https://stripe.com/AU/pricing), [RBA surcharging framework](https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/).*
