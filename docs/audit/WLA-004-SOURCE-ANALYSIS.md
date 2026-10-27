# WLA-004 Source Analysis — Stripe application_fee_amount without connected-account context

**Date:** 2026-10-26
**Finding:** WLA-004 (source/API-contract verified; Stripe test-mode runtime verification pending)
**Owner clarification (2026-10-26):** SaaS subscription is available to every provider type, including driving instructors who subscribe. Subscription eligibility is distinct from the per-booking charge model. Testing the intended Connect fee flow requires the platform's test-mode key and a connected test account created under the same platform.
**Commit:** `0b47689c`

## Source-level analysis

### The Stripe request construction

File: `lib/services/saas-payment.ts`, function `_createAndBindSession()`

```typescript
// Commission is calculated from BusinessSettings.commissionRate
const commissionPercent = businessConfig.capabilities.commission
  ? businessConfig.commissionPercent
  : 0
const applicationFeeAmount = commissionPercent > 0
  ? Math.round(calculatePercentage(amountInCents / 100, commissionPercent) * 100)
  : 0

// Session created on the PLATFORM account (no Stripe-Account header)
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: 'payment',
  line_items: lineItems,
  // ... metadata, URLs, customer_email ...
}

if (applicationFeeAmount > 0) {
  sessionParams.payment_intent_data = {
    application_fee_amount: applicationFeeAmount,
    // NOTE: no transfer_data.destination
  }
}

// Created on platform account — no { stripeAccount } option passed
const session = await stripe.checkout.sessions.create(sessionParams, {
  idempotencyKey: `scs-${quoteId}-${generation}`,
})
```

### What's missing

1. **No `transfer_data.destination`** — the destination charge pattern requires this to route funds to a connected account
2. **No `Stripe-Account` header** — the direct charge pattern requires creating the session on the connected account
3. **No connected account reference at all** — `stripe.checkout.sessions.create()` is called without a `stripeAccount` option

### Stripe's documented patterns

| Pattern | Platform session? | Stripe-Account header? | transfer_data.destination? | application_fee_amount valid? |
|---|---|---|---|---|
| Direct charge | No | Yes (connected account) | No | Yes (platform takes fee) |
| Destination charge | Yes | No | Yes (connected account) | Yes (platform takes fee) |
| **Current code** | **Yes** | **No** | **No** | **Set but context missing** |

The current code matches neither documented pattern. `application_fee_amount` is set without a connected-account context, which means:
- There is no connected account to receive the net amount after the fee
- Stripe may silently ignore `application_fee_amount` (no destination to split with) or reject the request

### API version

```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})
```

The source declares API version `2026-02-25.clover`. As of 2026-10-26, this date is in the past; do not label it a future version based on the date alone. Stripe SDK compatibility and exact runtime behaviour must be established from the installed SDK and an actual test-mode API call.

### WLA-001 interaction

The WLA-001 DIRECT-mode guard now blocks providers with `paymentMode = 'DIRECT'` from reaching `createCheckoutSession()`. The normal registration mapping complicates reachability:
- `app/api/register/route.ts` currently derives `businessModel` and `paymentMode` from business type: driving becomes `MARKETPLACE` + `PLATFORM`; non-driving becomes `SAAS` + `DIRECT`.
- WLA-001 now blocks DIRECT-mode quote acceptance before this service is called.
- `createCheckoutSession()` requires `businessConfig.paymentModel === 'saas'`, while the driving template is `marketplace`.
- The owner clarified that SaaS subscription availability is not restricted by provider vertical. WLA-020 tracks the mismatch between the intended product rule and current registration mapping.
- A test must use an isolated test fixture or controlled test branch that makes `createCheckoutSession()` reachable without weakening the production guard or changing live data.

### What remains

**Runtime verification required:** use a Stripe test-mode platform key and a connected test account created under that same Connect platform. The repository has a Connect onboarding route (`app/api/instructor/stripe-connect/onboard/route.ts`) that creates an Express account and stores `Provider.stripeAccountId`; when configured with an `sk_test_...` key, onboarding creates a test-mode connected account. Never paste the key into chat or commit it to `.env`.

A connected account by itself does not change the current Checkout request. The request parameters must explicitly use a documented charge pattern:

- **Direct charge:** create the relevant request in the connected-account context (Stripe-Account / SDK `stripeAccount` request option) and set `application_fee_amount`; confirm the account has the required payment capability.
- **Destination charge:** keep Checkout on the platform account and set `payment_intent_data.transfer_data.destination = provider.stripeAccountId`, paired with `application_fee_amount`. If the provider's business identity should appear as settlement merchant, evaluate `on_behalf_of` as a separate explicit choice and verify its requirements. Stripe states `on_behalf_of` requires the connected account to have a payments capability such as `card_payments` (https://docs.stripe.com/connect/separate-charges-and-transfers). The current `app/api/instructor/stripe-connect/onboard/route.ts` requests `transfers` only, so onboarding capabilities may need to change if `on_behalf_of` is selected.
- **Current request as-is:** it sets `application_fee_amount` with neither account context nor destination. Test that request in isolation if the only question is how Stripe responds, but that is not a test of the intended connected-account fee flow.

**Test evidence required:**
1. Confirm the connected test account belongs to the same platform Stripe account and expected provider identity.
2. Use an isolated test provider/quote/business config with a non-zero commission.
3. Record the API response (success or Stripe error code/message/request ID, with secrets and personal data removed).
4. If accepted, retrieve the Checkout Session/PaymentIntent and inspect the application fee, transfer, destination and balance transactions; acceptance alone does not prove funds or fee settled as intended.
5. Run the resulting webhook and ledger assertions in test mode; verify provider allocation, DriveBook fee, refunds and reversals.

No Stripe test credentials are available to this review, and no live transaction or Stripe request was performed.
## Conclusion

WLA-004 is source/API-contract verified: the request is not configured as either a documented direct charge or destination charge. The exact API outcome is unverified. WLA-020 must also resolve how driving instructors select/subscribe to the SaaS offering independently of business vertical. Do not implement a guessed charge model: select the intended Connect pattern first, then test with a platform test key and a connected test account.
