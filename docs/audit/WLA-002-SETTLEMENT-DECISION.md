# WLA-002 — Provider Settlement Semantics: Architecture Decision Record (v9)

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary that becomes a code defect when DIRECT mode is activated.  
**Status:** ARCHITECTURE DECISION DEFINED (v9) — pending reviewer acceptance  
**v1–v8 history:** NOT ACCEPTED (see appendix A for full rejection history)  
**v9 authored:** 2026-11-06  
**v8 rejection reason:** (1) Accounts v2 terminology imprecise — "Standard (Accounts v2)" should be "Accounts v2 connected account with full Dashboard access" with `dashboard: "full"`; must address whether existing Express accounts require replacement and provider re-onboarding. (2) DIRECT package purchases still partially in scope — must be fully excluded until provider-facing refund policy defined. (3) Webhook specification covered only connected-account events — must also specify platform-account handling for `application_fee.created` and `application_fee.refunded`; two separate webhook contexts required.

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
| Account type | **Accounts v2 connected account with full Dashboard access** | Provider can manage payments, issue refunds, and respond to disputes directly via Stripe Dashboard |
| `dashboard` | **`"full"`** | Full Stripe Dashboard — not Express Dashboard (which lacks dispute management) |
| `defaults.responsibilities.fees_collector` | **`"stripe"`** | Stripe collects its own processing fees from the connected account's payment; provider sees Stripe's standard pricing, not DriveBook's |
| `defaults.responsibilities.losses_collector` | **`"stripe"`** | Stripe absorbs negative balances on connected accounts — DriveBook is not liable for connected-account shortfalls (unlike Express) |
| Charge type | **Direct charges** | Charge created on the connected account using `Stripe-Account` header |

**Accounts v2 with Managed Risk:** Per [Stripe docs](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk), Stripe manages credit and fraud risk and assumes losses from unrecoverable negative balances when `defaults.responsibilities.losses_collector: "stripe"` is configured. This is recommended for SaaS platforms using direct charges.

**Unresolved assumptions — Australian eligibility and account migration:**
- Accounts v2 features (`defaults.responsibilities.fees_collector: "stripe"`, `defaults.responsibilities.losses_collector: "stripe"`, `dashboard: "full"`) must be verified for Australian-registered connected accounts on DriveBook's Stripe platform.
- The Stripe changelog indicates Express connected accounts v2 support was added with Stripe-owned pricing and negative-balance liability, but actual availability for DriveBook's AU integration must be confirmed with Stripe.
- **Existing Express accounts:** Current `createConnectAccount()` creates v1 Express accounts. It is unresolved whether existing Express accounts can be migrated in place to Accounts v2 with `dashboard: "full"`, or whether they must be replaced entirely (requiring provider re-onboarding). This must be determined before DIRECT mode can be activated.

**Migration required (G12, not authorised):** Migrating to Accounts v2 connected accounts with full Dashboard access is a precondition for DIRECT mode. This migration has not been authorised and is out of scope for this ADR.

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

**Partial refunds:** The provider issues partial refunds through Stripe Dashboard. The full application fee remains with DriveBook by default — `refund_application_fee: false` (the default) means the application fee is **not refunded at all**, including on partial refunds. A proportional application-fee refund only occurs if the platform explicitly sets `refund_application_fee: true`, which is an operation controlled by DriveBook (the platform that collected the fee), not by the provider. Under the non-refundable policy, DriveBook does not refund the application fee on any refund — partial or full.

**ACL compliance note:** A non-refundable application fee is the intended product policy. Under Australian Consumer Law, consumer statutory rights may override a disclosed non-refundable fee in certain circumstances (e.g. service not delivered, major failure). The terms and refund handling must receive legal review before DIRECT mode launches.

**Refund funding and insufficient-balance behaviour:**

When the provider issues a full or partial refund, the connected account must have sufficient available balance to fund the refund. The provider's remaining proceeds after a successful charge are `bookingRate − applicationFee − StripeProcessingCost` (e.g. $66.76 on $70). If the provider has already withdrawn these funds to their bank account, the connected account balance may be insufficient for a subsequent refund.

| Scenario | Outcome |
|---|---|
| Connected account has sufficient balance | Refund proceeds; student receives funds; connected account debited |
| Connected account has insufficient balance (funds withdrawn) | Refund is created in `pending` status; Stripe waits for the connected account balance to be replenished by new charges or manual top-up |
| Connected account remains insufficient | Refund stays pending; Stripe may eventually fail the refund. The provider is responsible for resolving the shortfall. DriveBook does not advance funds. |
| `losses_collector: "stripe"` (recommended Accounts v2) | If the connected account goes negative, Stripe absorbs the loss — but this applies to negative balances, not to refund funding. The provider must still resolve pending refunds. |
| `losses_collector: "application"` (or legacy Express) | DriveBook is liable for the negative balance. DriveBook may need to fund the refund from its platform balance and recover from the provider. |

DriveBook's contractual obligation to the student on a DIRECT booking is not automatically zeroed by retaining the application fee. The provider's agreement with DriveBook should define who bears the cost when a refund cannot be funded from the connected account.

### 5.3 Dispute and chargeback handling

**Per [Stripe docs (direct charges)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes):**

> "With direct charges, your platform creates payments on the connected account. Stripe debits refunds and disputed amounts from that account's balance."

| Step | Action |
|---|---|
| `charge.dispute.created` fires | Stripe debits **provider's connected account** (not DriveBook's platform) |
| Dispute response | **Provider manages dispute responses through the full Stripe Dashboard** (requires Accounts v2 with `dashboard: "full"`) |
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

### 5.4 Webhook Event-Handling Specification (G03 + G11)

DIRECT mode requires **two separate webhook contexts**. Direct-charge events (refunds, disputes) fire against the connected account. Application-fee events fire against the platform account. One webhook endpoint or event context does not cover all Stripe objects.

#### Context 1 — Connected-account webhook (refund and dispute events)

**Endpoint:** Separate Connect webhook endpoint, signed with the Connect webhook signing secret (not the platform-level webhook secret).

**Event context:**
- Direct-charge events arrive with the connected account's ID in the event payload (`event.account`)
- DriveBook must verify `event.account` matches a known provider's `stripeAccountId`
- Events from unknown accounts must be logged and ignored (return 200 — Stripe retries on non-2xx)

**Signature verification:**
- Use the **Connect webhook signing secret** (separate from the platform-level webhook secret)
- `stripe.webhooks.constructEvent(rawBody, signature, connectWebhookSecret)`

**Account identification:**
- Each event's `event.account` field identifies the connected account
- DriveBook must look up the provider by `stripeAccountId === event.account`
- If no provider matches: log, return 200, do not process

**Idempotency:**
- Each event has a unique `id` field. DriveBook must maintain an idempotency table (existing `WebhookEvent` model) keyed on `event.id`
- If already processed: return 200 without reprocessing

**Refund events:**

| Event | Handling |
|---|---|
| `charge.refunded` (full) | Verify connected account; verify charge belongs to a DIRECT booking; update Booking status to `CANCELLED` or `REFUNDED`; do NOT write `PlatformLedger` entries |
| `charge.refunded` (partial) | Check `amount_refunded` on the charge (cumulative, not per-event). Compare against charge total to determine remaining unrefunded balance. Update Booking to `PARTIALLY_REFUNDED`. Do NOT mark as fully cancelled. |
| Multiple refunds on one charge | Stripe allows multiple partial refunds. Each `charge.refunded` event represents one refund object; `amount_refunded` on the charge is cumulative. DriveBook must track individual refund objects and sum them. |
| `refund.updated` (failed reversal) | If a `succeeded` refund transitions to `failed`, Stripe fires `refund.updated`. DriveBook must revert any booking state change made based on the original refund success. |

**Booking state transitions:**

```
CONFIRMED → PARTIALLY_REFUNDED  (partial refund issued by provider)
CONFIRMED → REFUNDED             (full refund issued by provider)
PARTIALLY_REFUNDED → REFUNDED    (subsequent refund brings total to full)
REFUNDED → CONFIRMED              (refund failed/reversed — rare; must revert)
```

**Dispute events:**

| Event | Handling |
|---|---|
| `charge.dispute.created` (on connected account) | Verify connected account; log dispute; do NOT write `PlatformLedger` entries; alert admin if needed |
| `charge.dispute.closed` | Record outcome in `DirectSettlementEntry` if applicable; do NOT write `DISPUTE_OPENED/WON/LOST` LedgerEntries against `PlatformLedger` |

**Reconciliation against Stripe objects (connected-account context):**
- After each refund event, fetch the charge and its `refunds` collection via the Stripe API (using the `Stripe-Account` header)
- Verify `amount_refunded` matches DriveBook's expected refund total
- Verify the `application_fee` object on the charge — check whether the fee was refunded by examining the `ApplicationFee` object's `amount_refunded` field

#### Context 2 — Platform-account webhook (application-fee events)

**Endpoint:** Platform-level webhook endpoint (existing `app/api/stripe/webhook/route.ts`), signed with the platform webhook signing secret. These events fire on the DriveBook platform account, not the connected account.

**Event context:**
- `application_fee.created` fires when Stripe transfers the application fee to the DriveBook platform account after a successful direct charge
- `application_fee.refunded` fires when an application fee is partially or fully refunded (only if DriveBook explicitly set `refund_application_fee: true`)

**Signature verification:**
- Use the **platform webhook signing secret** (the existing one already used for PLATFORM-mode events)
- `stripe.webhooks.constructEvent(rawBody, signature, platformWebhookSecret)`

**Account identification:**
- The `ApplicationFee` object contains an `account` field (the connected account ID) and an `originating_transaction` (the charge ID)
- DriveBook must look up the DIRECT booking by matching the charge ID in `originating_transaction`
- If no DIRECT booking matches: this may be a PLATFORM-mode event — route to existing PLATFORM handler

**Idempotency:**
- Same `WebhookEvent` idempotency table, keyed on `event.id`
- Platform-account and connected-account events have different `event.id` values even if they refer to the same underlying transaction

**Platform-account events:**

| Event | Handling |
|---|---|
| `application_fee.created` | Record `DirectSettlementEntry(APPLICATION_FEE_RECEIVED)` with the fee amount and originating charge ID. This confirms DriveBook received the fee. Do NOT write `PlatformLedger` entries. |
| `application_fee.refunded` | Record `DirectSettlementEntry(APPLICATION_FEE_REFUNDED)` (negative). This only fires if DriveBook explicitly refunded the fee (which under the non-refundable policy it does not). If this event arrives unexpectedly, investigate. |

**Reconciliation (platform-account context):**
- After `application_fee.created`, verify the `ApplicationFee.amount` matches the expected 2.5% × bookingRate
- After `application_fee.refunded`, verify the refunded amount matches DriveBook's records
- Cross-reference: the `ApplicationFee.originating_transaction` links to the charge on the connected account. DriveBook can fetch the charge using the `Stripe-Account` header to verify the full picture.

**Why two endpoints are needed:**
- Connected-account events (`charge.refunded`, `charge.dispute.created`) are scoped to the connected account and require the Connect webhook signing secret
- Platform-account events (`application_fee.created`, `application_fee.refunded`) are scoped to the platform account and use the platform webhook signing secret
- A single endpoint cannot receive both event types — Stripe routes events to the webhook endpoint registered for the account that owns the event
- The existing `app/api/stripe/webhook/route.ts` handles platform-account events; a new endpoint (G11) is required for connected-account events

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

**In scope (this ADR):**
- DIRECT-mode single-booking payments (the charge structure, fee, refund, dispute, and ledger mechanics defined in sections 4–7)

**Out of scope until WLA-005 is resolved:**
- DIRECT-mode wallet top-ups
- DIRECT-mode wallet-funded package purchases
- Wallet credit reversals and cash refund distinctions

**Explicitly excluded until a provider-facing package refund policy is defined:**
- DIRECT-mode package purchases (all package payment types)
- The existing PLATFORM `calculatePartialPackageRefund()` does not transfer to DIRECT mode. The provider manages DIRECT refunds independently through their Stripe Dashboard. A separate provider-facing package refund contract (including discount clawback, used-hours repricing, and minimum-hours qualification) must be defined before DIRECT package purchases are activated. This ADR does not assume the PLATFORM calculation transfers.

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

## 10. Implementation Pre-Conditions (G01–G12)

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
| G11 | `app/api/stripe/webhook/route.ts` | No Connect webhook listener for connected-account events — required for DIRECT refund and dispute visibility. Design specified in section 5.4 (event context, signature verification, idempotency, partial/full refund handling, reconciliation) |
| G12 | `lib/services/stripe.ts` | `createConnectAccount()` creates v1 Express accounts; must migrate to Accounts v2 connected accounts with `dashboard: "full"`, `defaults.responsibilities.fees_collector: "stripe"`, `defaults.responsibilities.losses_collector: "stripe"`. Existing Express accounts may require replacement and provider re-onboarding (unresolved). Migration not authorised by this ADR |

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
| Who manages dispute responses? | **Provider** — through full Stripe Dashboard (Accounts v2 with `dashboard: "full"`) |
| Who bears dispute cost? | Connected account debited first; negative-balance responsibility depends on `losses_collector` configuration |
| Does DriveBook have zero legal liability? | Not claimed — depends on provider agreement, Stripe config, and Australian law |
| Are DIRECT wallet top-ups in scope? | No — out of scope until WLA-005 is resolved |
| Are DIRECT package purchases in scope? | No — excluded until provider-facing package refund policy is defined |
| Can PLATFORM and DIRECT share PlatformLedger? | No — DIRECT must use `DirectSettlementEntry` only |
| Can DIRECT be activated from current source? | No — G01–G12 must be resolved |
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
| v7 | NOT ACCEPTED | Partial application-fee refund described as proportional (incorrect — full fee retained unless platform explicitly refunds); DIRECT package refunds claimed to use PLATFORM function (provider manages independently); refund funding/insufficient-balance not documented; webhook specification incomplete; G01–G11 not updated to G01–G12; Managed Risk eligibility unverified |
| v8 | NOT ACCEPTED | Accounts v2 terminology imprecise ("Standard" not "Accounts v2 with full Dashboard"); DIRECT packages still partially in scope (must be fully excluded); webhook specification covered only connected-account events (must also cover platform-account `application_fee.created`/`application_fee.refunded`); two webhook contexts not defined |

---

## Appendix B — Unresolved Assumptions

These assumptions must be verified before the ADR is accepted or DIRECT mode is activated:

1. **Accounts v2 Australian eligibility:** `defaults.responsibilities.fees_collector: "stripe"` and `defaults.responsibilities.losses_collector: "stripe"` must be confirmed available for Australian-registered connected accounts on DriveBook's Stripe platform. The Stripe changelog indicates support was added but actual availability must be verified.

2. **Accounts v2 Dashboard access:** The recommendation assumes Accounts v2 connected accounts with `dashboard: "full"` provide full Stripe Dashboard access in Australia. This must be confirmed for the specific Stripe product configuration DriveBook uses.

3. **Connect webhook event delivery:** Direct-charge dispute and refund events fire against the connected account. DriveBook must verify that Connect webhooks deliver these events reliably to the platform for reconciliation.

4. **Negative-balance responsibility:** The recommended `losses_collector: "stripe"` shifts negative-balance liability to Stripe. This must be confirmed in the actual account configuration — if not available or not configured, DriveBook remains liable.

5. **Australian Consumer Law and non-refundable fees:** The non-refundable application fee policy must be reviewed by legal counsel. ACL statutory rights may override the disclosed policy in certain circumstances.

6. **Australian card-surcharge compliance:** The Marketplace 3.6% surcharge must be reviewed against the RBA surcharging framework and any regulatory changes. This is a Marketplace compliance item, not a DIRECT-mode item, but is noted here for completeness.

7. **WLA-004 dependency:** The SaaS `application_fee_amount` path in `saas-payment.ts` remains unverified. This ADR does not treat the SaaS flow as a confirmed baseline.

8. **Merchant-of-record and tax obligations:** Out of scope for this ADR. Requires separate legal/tax assessment.
9. **DIRECT package refund policy:** The provider manages DIRECT refunds independently. The existing PLATFORM `calculatePartialPackageRefund()` function does not transfer to DIRECT mode. A provider-facing package refund contract (including discount clawback, used-hours repricing, and minimum-hours qualification) must be defined before DIRECT package purchases are activated. Single-booking DIRECT refunds are in scope; DIRECT packages are deferred.
10. **Refund funding and provider obligations:** When a provider issues a refund with insufficient connected-account balance, the refund may pend or fail. DriveBook's contractual obligations to the student in this scenario are not defined. The provider agreement must specify who bears the cost when a refund cannot be funded from the connected account.
11. **Express account replacement and re-onboarding:** It is unresolved whether existing v1 Express accounts can be migrated in place to Accounts v2 with `dashboard: "full"`, or whether they must be replaced entirely. If replacement is required, existing providers would need to complete new onboarding. The operational impact of this migration on active providers is not assessed.

---

*This document is an architecture decision record. No code changes, account migration, or DIRECT activation are authorised by this ADR. DIRECT mode remains blocked until G01–G12 are resolved, this ADR is accepted by independent review, and all unresolved assumptions in Appendix B are verified. Stripe Managed Risk eligibility for DriveBook's Australian platform agreement is not confirmed and must not be treated as a verified guarantee.*

*Stripe documentation sources are cited inline. Content was paraphrased for compliance with licensing restrictions.*

*Sources: [Create direct charges](https://docs.stripe.com/connect/direct-charges), [Handle refunds and disputes (SaaS)](https://docs.stripe.com/connect/saas/tasks/refunds-disputes), [Disputes on Connect](https://docs.stripe.com/connect/disputes), [Fee behavior on connected accounts](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior), [Managed Risk](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk), [Stripe AU pricing](https://stripe.com/AU/pricing), [RBA surcharging framework](https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/).*
