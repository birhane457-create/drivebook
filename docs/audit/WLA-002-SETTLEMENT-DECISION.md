# WLA-002 — Provider Settlement Semantics: Architecture Decision Record

**Finding ID:** WLA-002  
**Category:** ARCHITECTURAL  
**Risk:** Not a runtime defect in current code. An undocumented design boundary that becomes a code defect when DIRECT mode is activated.  
**Status:** OPEN — PAYMENT MODEL OPTIONS UNDER RESEARCH  
**v1–v11 history:** v1–v10 NOT ACCEPTED; v11 documented one model (2.5% combined fee, `fees_collector: "application"`) but product owner determined the fee model should not be finalised before comparing commercial options and Stripe Connect costs.  
**v11 status:** v11's technical analysis (webhook specs, ledger separation, DirectSettlementEntry, refund lifecycle, dispute handling) remains useful research. The fee model itself (2.5% vs subscription-only vs provider choice) is unresolved and under research.  
**Document authored:** 2026-11-06 (v11 corrections committed `07f17cd4`; research direction added this revision)  

**Product-owner direction:** Investigate three payment model options before committing. Use Option A (SaaS subscription only) as the initial baseline. Do not commit to the 2.5% fee model. Do not commit to subscription-only as the final choice. Research whether both models can coexist. Separate the SaaS subscription decision from the payment-processing decision.

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

## 1-A. Payment Model Options Under Research

The product owner has determined that the fee model should not be finalised before comparing commercial options. Three options are under investigation. The technical analysis in sections 2–12 below describes Option B in detail and remains useful research, but **does not represent the decided architecture**.

### Option A — SaaS subscription only (recommended initial baseline)

The provider connects an existing or new Stripe account to DriveBook. The provider:
- Receives customer payments directly into their connected Stripe account
- Pays Stripe's normal processing fees (1.70% + A$0.30 AU domestic)
- Manages refunds and disputes through their Stripe Dashboard
- Controls their own Stripe balance and payouts
- Pays DriveBook a monthly or annual SaaS subscription

**Stripe configuration to investigate:**
- Charge type: Direct charge
- `dashboard: "full"`
- `fees_collector: "stripe"` — Stripe collects processing fees from the connected account directly
- `losses_collector: "stripe"` — Stripe absorbs negative balances
- `application_fee_amount`: none (DriveBook earns subscription revenue, not per-transaction fees)

**Stripe Connect pricing (Stripe handles pricing):** No platform fees. No per-account charge. No payout fee. Stripe collects processing fees from connected accounts. Source: [Stripe AU Connect pricing](https://stripe.com/au/connect/pricing).

**Advantages:** Simpler reconciliation; no per-transaction margin calculation; no 2.5% fee to explain; less financial exposure for DriveBook; clear separation of SaaS revenue from payment revenue.

**Disadvantages:** DriveBook does not earn transaction-based revenue; providers manage their own Stripe account.

### Option B — SaaS subscription plus DriveBook's 2.5% combined fee (described in sections 2–12)

The provider pays 2.5% of the booking amount as a combined application fee. DriveBook receives that fee, pays Stripe's processing costs from it, and retains the remainder.

**Stripe configuration:**
- `fees_collector: "application"` — DriveBook pays Stripe processing; application fee covers both Stripe cost and DriveBook net
- `losses_collector: "stripe"`
- `application_fee_amount`: 2.5% of booking rate

**Stripe Connect pricing (You handle pricing):** A$2 per monthly active account + 0.25% + A$0.25 per payout sent. Source: [Stripe AU Connect pricing](https://stripe.com/au/connect/pricing).

**Cost not accounted for in v11:** The A$2/month per active account and 0.25% + A$0.25 per payout are Connect fees charged to DriveBook under "You handle pricing." The v11 $0.26 net margin on a $70 booking does not include these costs. For a low-volume provider (e.g. 10 lessons/month), the A$2 monthly fee alone consumes the entire margin from ~8 transactions.

**Net contribution formula (corrected):**
```
Net contribution per transaction = Application fee − Stripe processing − Connect fees − other costs
```

**Advantages:** Transaction-based revenue; bundled pricing simpler for providers who don't want to manage Stripe costs.

**Disadvantages:** Narrow margin before all costs; Connect fees may exceed margin for low-volume providers; greater financial-management role for DriveBook; fee-margin risk on higher-cost payment methods.

### Option C — Let the provider choose

The provider chooses one payment arrangement during Stripe onboarding. Plan A (independent payments) or Plan B (DriveBook-managed pricing).

**Technical constraint:** Stripe's Accounts v2 documentation states that `fees_collector` and `losses_collector` are set when the account configuration is created and **cannot be updated later**. Providers cannot freely switch between models without account replacement. Source: [Stripe configuration docs](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).

**Research required:** Whether one Australian Connect platform can support both `fees_collector` configurations simultaneously; whether both models offer full Dashboard access; what the Connect fees are under each model; whether providers can connect existing Stripe accounts.

### Research questions (mandatory before WLA-002 is resolved)

| Research question | Why it matters |
|---|---|
| Can one Australian Connect platform support both fee-collector arrangements? | Determines whether provider choice is technically viable |
| Can providers use full Stripe Dashboard access in both models? | Important for independent business operations |
| What are all Connect fees under each model? | Determines actual DriveBook profitability |
| Who pays processing, dispute and refund-related fees? | Determines the real financial responsibilities |
| Can providers switch models later? | Determines whether onboarding decisions are permanent |
| What are the Australian Managed Risk requirements? | Determines whether Stripe accepts the proposed loss allocation |
| Can providers connect existing Stripe accounts? | Affects onboarding friction and provider independence |
| How should DriveBook charge SaaS subscriptions separately? | Keeps subscription billing independent of lesson transactions |

**Official starting points for research:**
- [Stripe Australia Connect pricing](https://stripe.com/au/connect/pricing)
- [Stripe — Build a SaaS platform](https://docs.stripe.com/connect/integrate-billing-connect)
- [Stripe — Connect configuration recommendations](https://docs.stripe.com/connect/configuration-migration-guide)

### Key principle: separate subscription from payment processing

A provider can pay DriveBook for software (SaaS subscription) while separately deciding how their customers' payments are processed. These do not need to be the same commercial decision. This separation is the strongest direction to investigate before the ADR is revised.

### Boundaries (preserve while research is ongoing)

- Existing PLATFORM marketplace payments remain unchanged
- No DIRECT implementation or account migration
- No commitment to the 2.5% fee model
- No commitment to subscription-only payments as the final choice
- Research both models and whether provider choice is supported
- Make a final product-owner decision only after technical, commercial and Stripe eligibility evidence is available

---

## 2. The Two Payment Arrangements

> **Note:** Sections 2–12 below describe Option B (the 2.5% combined fee model with `fees_collector: "application"`) in detail. This technical analysis is research material, not the decided architecture. The fee model is under research per section 1-A.

There are two distinct payment arrangements. The critical distinction is **who funds DriveBook's fee**.

| Aspect | Marketplace (PLATFORM) | SaaS / DIRECT |
|---|---|---|
| Who funds DriveBook's fee? | **Student** | **Provider** |
| How is the fee collected? | Added to the student's payment | Deducted from the provider's payment proceeds |
| Student pays | Booking/package rate + platform fee surcharge | Provider's advertised price only — nothing added |
| Provider receives | Booking rate − commission (via weekly payout) | Booking rate − application fee (Stripe does not separately deduct processing from provider) |
| DriveBook receives | Commission (% of booking rate) | Application fee (2.5% of booking rate); pays Stripe processing from that; retains net |
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
// Charge is created ON the provider's connected account, not on DriveBook's account.
// With fees_collector: "application", DriveBook pays Stripe's processing fee.
// The application_fee_amount must therefore cover BOTH DriveBook's net revenue
// AND Stripe's processing cost (per Stripe docs on fees_collector: "application").
stripe.paymentIntents.create(
  {
    amount: Math.round(bookingRateCents),             // provider's advertised price — nothing added
    currency: 'aud',
    payment_method_types: ['card'],
    application_fee_amount: Math.round(bookingRateCents * 0.025),  // 2.5% covers Stripe cost + DriveBook net
  },
  { stripeAccount: providerStripeAccountId }          // Stripe-Account header — direct charge
)
```

**Stripe-verified behaviour with `fees_collector: "application"` (from [Stripe docs](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration)):**

> "If you set the fee collector to application, you collect the payment and fees, then pay Stripe its processing fee. Set the application fee amount to include both your fee and the Stripe processing fee."

- Charge is stored on the **provider's connected account**, not DriveBook's
- Student sees the provider's Stripe statement descriptor (connected account branding)
- `application_fee_amount` is transferred from the connected account to DriveBook's platform account
- DriveBook (platform) then pays Stripe's processing fee from DriveBook's own balance
- Provider nets: `bookingRate − application_fee_amount` = `$70.00 − $1.75 = $68.25`
- DriveBook receives: `application_fee_amount = $1.75`, then pays Stripe `~$1.49`, netting `~$0.26`

**This is materially different from `fees_collector: "stripe"` (v9–v10):** With `"stripe"`, Stripe deducts its processing fee from the connected account's balance directly, and the provider nets `bookingRate − applicationFee − StripeProcessingCost`. With `"application"`, DriveBook pays Stripe's fee and the provider receives the full `bookingRate − applicationFee` cleanly.

### 4.2 Why direct charge, not destination charge

| Aspect | Destination charge (v1–v5, rejected) | Direct charge (v6, decided) |
|---|---|---|
| Fee funding | Student pays (fee added to charge amount) | Provider pays (fee deducted from their proceeds) |
| Student pays | bookingRate + 2.5% | bookingRate only |
| Stripe charge on | Platform account | Connected account |
| Dispute debit | Platform account | Connected account |
| Stripe processing fees paid by | Platform (DriveBook) | **Platform (DriveBook)** — same; covered by application fee |
| Consistent with intended product | No | Yes |

### 4.3 Connected account configuration

**Current state:** `createConnectAccount()` creates `type: 'express'` accounts (v1 legacy model). This is not the intended configuration for DIRECT mode.

**Recommended configuration for DIRECT mode (Accounts v2):**

| Setting | Value | Rationale |
|---|---|---|
| Account type | **Accounts v2 connected account with full Dashboard access** | Provider can manage payments, issue refunds, and respond to disputes directly via Stripe Dashboard |
| `dashboard` | **`"full"`** | Full Stripe Dashboard — not Express Dashboard (which lacks dispute management) |
| `defaults.responsibilities.fees_collector` | **`"application"`** | Platform (DriveBook) pays Stripe's processing fee; `application_fee_amount` must cover both Stripe cost and DriveBook net revenue. This is consistent with the product decision that the 2.5% combined fee is DriveBook-funded after provider proceeds are passed through cleanly. |
| `defaults.responsibilities.losses_collector` | **`"stripe"`** | Stripe absorbs negative balances on connected accounts — DriveBook is not liable for connected-account shortfalls (valid combination: `fees_collector: "application"` + `losses_collector: "stripe"` is explicitly permitted per Stripe docs) |
| Charge type | **Direct charges** | Charge created on the connected account using `Stripe-Account` header |

**Documentation-confirmed fee behaviour with `fees_collector: "application"` ([Stripe source](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior)):**

> "If you set the fee collector to application, you collect the payment and fees, then pay Stripe its processing fee. Set the application fee amount to include both your fee and the Stripe processing fee."

- Stripe's processing fee is charged to DriveBook's **platform account** (not the connected account)
- Provider receives: `bookingRate − application_fee_amount` cleanly
- DriveBook receives `application_fee_amount`, then pays Stripe from that — retaining the remainder
- Dispute fees: also charged to the **platform** when `fees_collector: "application"` ([Stripe table](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior#dispute-fees))

**Restriction confirmed by Stripe docs:** If `losses_collector: "application"`, then `fees_collector` must also be `"application"`. The reverse is not restricted — `fees_collector: "application"` + `losses_collector: "stripe"` is valid.

**Unresolved assumptions — Australian eligibility and account migration:**
- The proposed configuration (`fees_collector: "application"`, `losses_collector: "stripe"`, `dashboard: "full"`) is documented as a valid combination by Stripe. Australian eligibility for this exact combination on DriveBook's Stripe platform must still be confirmed with Stripe before activation.
- **Existing Express accounts:** It is unresolved whether existing v1 Express accounts can be migrated in place to Accounts v2, or whether they must be replaced entirely requiring provider re-onboarding. This must be determined before DIRECT mode is activated.
- **G12 (not authorised):** Account migration to Accounts v2 is a precondition for DIRECT mode; not authorised by this ADR.

---

## 5. Fund Flow — DIRECT Mode

### 5.1 Successful payment (booking rate $70, 2.5% application fee)

With `fees_collector: "application"`, Stripe charges its processing fee to the platform (DriveBook), not to the connected account. The provider receives the booking rate minus only the application fee.

```
Student pays:                  $70.00  (provider's advertised rate — nothing added)
Stripe creates charge on:      Provider's connected account
Stripe transfers to DriveBook: application_fee = $1.75  (2.5% × $70)
Provider nets:                 $70.00 − $1.75 = $68.25  (Stripe does NOT separately deduct processing from provider)
DriveBook receives:            $1.75  (application fee)
DriveBook pays Stripe:         ~$1.49  (1.70% × $70 + $0.30 — charged to DriveBook's platform balance)
DriveBook net revenue:         $1.75 − $1.49 = ~$0.26
DriveBook's platform balance:  +$0.26 net (application fee in, Stripe cost out)
```

**Actual processing costs** must be reconciled using Stripe balance transaction records, not permanently assumed from an estimated rate. The $1.49 is illustrative; the real amount depends on the card type, Stripe's current AU pricing, and any applicable discounts.

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
- Stripe processing cost: ~$1.49 — **borne by DriveBook's platform account** (with `fees_collector: "application"`, the platform paid Stripe at charge time)
- DriveBook net on full refund: **+$1.75 − ~$1.49 = ~$0.26** — approximately the same as a successful transaction; Stripe does not return the processing cost on a refund
- This is consistent with the product decision: the 2.5% covers Stripe processing and DriveBook net revenue; on refund, DriveBook retains the fee and absorbs Stripe's sunk cost, netting approximately the same as a normal transaction

**Partial refunds:** The provider issues partial refunds through Stripe Dashboard. The full application fee remains with DriveBook by default — `refund_application_fee: false` (the default) means the application fee is **not refunded at all**, including on partial refunds. A proportional application-fee refund only occurs if the platform explicitly sets `refund_application_fee: true`, which is an operation controlled by DriveBook (the platform that collected the fee), not by the provider. Under the non-refundable policy, DriveBook does not refund the application fee on any refund — partial or full.

**ACL compliance note:** A non-refundable application fee is the intended product policy. Under Australian Consumer Law, consumer statutory rights may override a disclosed non-refundable fee in certain circumstances (e.g. service not delivered, major failure). The terms and refund handling must receive legal review before DIRECT mode launches.

**Refund funding and insufficient-balance behaviour:**

When the provider issues a full or partial refund, the connected account must have sufficient available balance to fund the refund. The provider's remaining proceeds after a successful charge are `bookingRate − applicationFee` (e.g. $68.25 on $70, under `fees_collector: "application"` where Stripe's processing cost is charged to DriveBook not the connected account). If the provider has already withdrawn these funds to their bank account, the connected account balance may be insufficient for a subsequent refund.

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
| If dispute lost | Connected account balance is debited; provider bears the booking amount loss |
| **Dispute fee (A$25)** | **DriveBook platform account** — with `fees_collector: "application"`, dispute fees are charged to the platform, not the connected account ([Stripe table](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior#dispute-fees)) |
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
| `charge.refunded` (full) | Verify connected account; verify charge belongs to a DIRECT booking; check the individual Refund object's status (see lifecycle below). Only update Booking status when the Refund is `succeeded`. Do NOT write `PlatformLedger` entries. |
| `charge.refunded` (partial) | Check the individual Refund object. Treat `Charge.amount_refunded` as a cumulative reconciliation value (not per-event). Compare cumulative total against charge amount to determine remaining unrefunded balance. Update Booking to `PARTIALLY_REFUNDED` only when the Refund is `succeeded`. Do NOT mark as fully cancelled. |
| Multiple refunds on one charge | Stripe allows multiple partial refunds. The `charge.refunded` event fires when a refund is created, but the individual Refund object and its ID is the authoritative record — not the event itself. DriveBook must track individual Refund objects by their IDs and sum their `amount` values. `Charge.amount_refunded` is a cumulative reconciliation value for verification, not the primary record. |
| `refund.updated` (status transition) | A Refund transitions `pending → succeeded` or `pending → failed`. A `succeeded` refund does **not** transition to `failed`. When `refund.updated` fires: if the Refund moved to `succeeded`, update booking state accordingly. If the Refund moved to `failed`, do NOT mark the booking as refunded — log the failure and alert admin. |

**Refund lifecycle:**
```
pending → succeeded    (refund completed — student received funds)
pending → failed        (refund could not be completed — insufficient balance or other failure)
```
A `succeeded` refund does not transition to `failed`. DriveBook must not revert a booking state change based on a succeeded refund unless the Refund object's status explicitly shows `failed` (which only occurs from `pending`, not from `succeeded`).

**Do not mark a booking as refunded merely because a refund was requested or created.** A refund in `pending` status means Stripe has not yet transferred funds to the student. Booking state should only transition to `REFUNDED` or `PARTIALLY_REFUNDED` when the individual Refund object's status is `succeeded`.

**Booking state transitions (only when individual Refund status is `succeeded`):**

```
CONFIRMED → PARTIALLY_REFUNDED  (partial refund succeeded)
CONFIRMED → REFUNDED             (full refund succeeded)
PARTIALLY_REFUNDED → REFUNDED    (subsequent refund brings cumulative total to full)
```

Do NOT transition booking state when a refund is `pending` or `failed`. A `pending` refund has not transferred funds to the student and the booking remains in its current state until the Refund object transitions to `succeeded`.

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
- The `ApplicationFee` object contains an `account` field (the connected account ID) and a `charge` field (the originating Direct Charge ID)
- DriveBook must identify the connected account using `ApplicationFee.account`
- DriveBook must identify the originating charge using `ApplicationFee.charge`
- DriveBook must look up the DIRECT booking by matching the charge ID from `ApplicationFee.charge`
- Retrieve the charge in the correct connected-account context (using `Stripe-Account: ApplicationFee.account` header)
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
- Cross-reference: `ApplicationFee.account` identifies the connected account and `ApplicationFee.charge` identifies the originating Direct Charge. DriveBook can fetch the charge using the `Stripe-Account` header (set to `ApplicationFee.account`) to verify the full picture.

**Why two webhook configurations are needed:**
- Connected-account events (`charge.refunded`, `charge.dispute.created`) are scoped to the connected account and require a webhook endpoint registered with the **Connect webhook signing secret**
- Platform-account events (`application_fee.created`, `application_fee.refunded`) are scoped to the platform account and require a webhook endpoint registered with the **platform webhook signing secret**
- Stripe routes events to the webhook endpoint registered for the account that owns the event. Two separately registered Stripe webhook endpoint configurations are required — one for connected-account events and one for platform-account events.
- These two configurations may point to the **same application URL** or to **separate URLs**. If they share the same URL, the endpoint must distinguish event contexts by inspecting the event type and account fields, and apply the correct signature verification for each context.
- Two separate application routes are **not** mandatory. However, separate account contexts and signature verification must be preserved regardless of URL configuration.
- The existing `app/api/stripe/webhook/route.ts` handles platform-account events. Connected-account event handling (G11) may be added to the same route (with context-based dispatch) or to a separate route.

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
  DISPUTE_FEE_PLATFORM_PAID    // Dispute fee charged to DriveBook platform (platform-paid under fees_collector: "application")
  NEGATIVE_BALANCE_ABSORBED    // Platform covered connected account shortfall — negative
  NEGATIVE_BALANCE_RECOVERED   // Connected account repaid the platform — positive
}
```

**Reconciliation invariant for a settled DIRECT booking:**
```
APPLICATION_FEE_RECEIVED = 2.5% × bookingRate = $1.75 on $70
STRIPE_PROCESSING_FEE_PAID ≈ −$1.49 (DriveBook's platform balance debited by Stripe)
DriveBook net ≈ $1.75 − $1.49 = $0.26
(The $70 never passes through DriveBook's account; only the application fee does)
```

**Reconciliation invariant for a fully refunded DIRECT booking (non-refundable fee policy):**
```
DriveBook net = APPLICATION_FEE_RECEIVED − STRIPE_PROCESSING_FEE_PAID
             = $1.75 − $1.49 ≈ $0.26
(no NEGATIVE_BALANCE_ABSORBED, assuming connected account has sufficient funds)
(no APPLICATION_FEE_REFUNDED, under non-refundable policy)
Note: Stripe's processing cost is a sunk cost — not returned on refund. DriveBook
      retains the full $1.75 application fee but has already paid ~$1.49 to Stripe
      at charge time. Net position on refund ≈ same as a successful transaction.
```

---

## 7. Fee Economics (AU, 2026)

**Stripe AU domestic processing: 1.70% + A$0.30 (confirmed 2026-11-06). Check [stripe.com/AU/pricing](https://stripe.com/AU/pricing) at implementation.**

**Per $70 booking rate (DIRECT mode, domestic card, `fees_collector: "application"`):**

| Party | Item | Amount |
|---|---|---|
| Student pays | Provider's advertised rate | $70.00 |
| Provider receives | Booking rate − application fee | $68.25 |
| DriveBook receives (application fee) | 2.5% × $70.00 | $1.75 |
| DriveBook pays Stripe (processing cost) | ~1.70% × $70 + $0.30 | ~$1.49 |
| **DriveBook net revenue** | $1.75 − $1.49 | **~$0.26** |

Note: With `fees_collector: "application"`, Stripe's processing cost is charged to DriveBook's platform balance, not the provider's. Provider receives $68.25 cleanly. **Actual processing costs must be reconciled from Stripe balance transaction records**, not permanently assumed from the estimated rate.

**On an eligible refund (booking rate refunded; platform fee retained):**

| Movement | Amount |
|---|---|
| Refund to student | $70.00 (from provider's connected account) |
| Provider's account debited | $70.00 |
| Platform fee retained by DriveBook | $1.75 |
| Stripe processing cost (already paid at charge time, not returned) | ~$1.49 |
| **DriveBook net on refund** | $1.75 − $1.49 = **~$0.26** |

The processing fee is a sunk cost paid at charge time. DriveBook retains the application fee and absorbs Stripe's processing cost; the net position on refund is approximately the same as a successful transaction.

**Per-dispute cost to DriveBook (`fees_collector: "application"`):**

| Scenario | DriveBook exposure |
|---|---|
| Disputed booking amount | Connected account debited (not DriveBook) |
| **Dispute fee (A$25)** | **DriveBook platform** — `fees_collector: "application"` means platform pays dispute fees ([confirmed by Stripe table](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior#dispute-fees)) |
| Dispute countered fee (A$25, if contested) | DriveBook platform (refunded if won) |
| If connected account has sufficient funds | DriveBook exposure: dispute fee(s) + Stripe processing sunk cost |
| If connected account has insufficient funds | `losses_collector: "stripe"` (recommended) → Stripe absorbs; otherwise DriveBook liable |
| DriveBook's legal liability | Not determined by this ADR — depends on provider agreement, Stripe configuration, and Australian law |

**Fee-margin risk note:**

The 2.5% application fee is the fixed provider-funded rate. It is **not a guarantee** that Stripe's processing costs will always be covered. The illustrative $1.49 processing cost on a $70 domestic card is an estimate; actual costs depend on:
- Card type (domestic, international, business, debit vs credit)
- Stripe's current AU pricing (may change)
- Additional Stripe fees (3DS, currency conversion, etc.)

For higher-cost payment methods (e.g. international cards at 3.5% + $0.30), Stripe's processing cost may exceed the 2.5% application fee, resulting in a **negative net margin** for DriveBook on that transaction. This risk must be assessed before activating DIRECT mode.

**Actual processing costs must be reconciled from Stripe balance transaction records** after each charge. DriveBook must not permanently assume the $1.49 illustrative figure. If the 2.5% rate is insufficient to cover processing costs for a material volume of transactions, the rate should be revised before launch. The fix is **not** to add a student surcharge or silently increase the provider fee — any rate change must be explicitly disclosed to providers.

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
| G12 | `lib/services/stripe.ts` | `createConnectAccount()` creates v1 Express accounts; must migrate to Accounts v2 connected accounts with `dashboard: "full"`, `defaults.responsibilities.fees_collector: "application"`, `defaults.responsibilities.losses_collector: "stripe"`. Australian eligibility and Stripe Managed Risk approval must be confirmed. Existing Express accounts may require replacement and provider re-onboarding (unresolved). Migration not authorised by this ADR |

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
| Provider proceeds in DIRECT? | `bookingRate − applicationFee` = $68.25 on $70 (Stripe does not separately deduct processing from provider; DriveBook pays Stripe) |
| Who pays Stripe processing cost in DIRECT? | **DriveBook (platform)** — `fees_collector: "application"` means platform pays; application fee covers both Stripe cost and DriveBook net revenue |
| DriveBook's revenue per DIRECT booking? | Application fee (2.5% × bookingRate) minus Stripe processing cost paid by DriveBook; net ~$0.26 on $70 (illustrative) |
| Who initiates refunds in DIRECT? | **Provider** — directly through Stripe Dashboard; DriveBook does not facilitate |
| DriveBook's refund role | Processes refund webhooks to update booking/accounting state only |
| Is application fee refunded? | No — non-refundable policy; `refund_application_fee` defaults to `false` |
| DriveBook net on full DIRECT refund? | ~$0.26 (application fee $1.75 retained; Stripe processing cost ~$1.49 already paid at charge time and not returned by Stripe) |
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
| v9 | NOT ACCEPTED | ApplicationFee identification used `originating_transaction` (should use `account` and `charge`); refund lifecycle described `succeeded → failed` (should be `pending → succeeded` or `pending → failed`); bookings marked refunded on refund creation not success; webhook endpoint claimed separate routes mandatory (should allow same URL with separate registrations) |
| v10 | NOT ACCEPTED | `fees_collector: "stripe"` — conflicts with product decision that DriveBook pays Stripe processing; correct value is `fees_collector: "application"` (platform pays Stripe, application_fee covers both); fund flow wrong (provider gets $66.76 not $68.25); dispute fees assigned to connected account (with `fees_collector: "application"` platform pays dispute fees) |
| v11 | OPEN — PAYMENT MODEL UNDER RESEARCH | v11 documented one model (2.5% combined fee, `fees_collector: "application"`) in detail. Product owner determined the fee model should not be finalised before comparing: Option A (subscription only, `fees_collector: "stripe"`, no Connect fees), Option B (2.5% fee, `fees_collector: "application"`, A$2/month + payout fees), Option C (provider choice). v11 did not account for Stripe Connect fees (A$2/active account + 0.25% + A$0.25/payout under "You handle pricing"). Technical analysis (webhook specs, ledger separation, refund lifecycle) remains useful research. Fee model unresolved. |

---

## Appendix B — Unresolved Assumptions

These assumptions must be verified before the ADR is accepted or DIRECT mode is activated:

1. **Accounts v2 Australian eligibility:** The proposed configuration (`fees_collector: "application"`, `losses_collector: "stripe"`, `dashboard: "full"`) is documented as valid by Stripe. However, availability for Australian-registered connected accounts on DriveBook's specific platform must be confirmed with Stripe. Managed Risk (`losses_collector: "stripe"`) requires Stripe approval per [Stripe docs](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk).

2. **Full Dashboard access with `fees_collector: "application"`:** Stripe docs confirm `dashboard: "full"` is a valid setting for Accounts v2 connected accounts alongside `fees_collector: "application"`. Actual availability in DriveBook's Stripe account configuration must be verified.

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
