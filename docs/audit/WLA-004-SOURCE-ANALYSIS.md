# WLA-004 Source Analysis — Stripe application_fee_amount without connected-account context

**Date:** 2026-10-26
**Finding:** WLA-004 (source-verified, runtime verification pending)
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

This is a custom/future API version. The exact runtime behavior (accept vs reject) cannot be confirmed without a test-mode Stripe API call.

### WLA-001 interaction

The WLA-001 DIRECT-mode guard now blocks providers with `paymentMode = 'DIRECT'` from reaching `createCheckoutSession()`. The WLA-004 issue is reachable for:
- PLATFORM-mode providers (driving schools) where `commissionPercent > 0`
- The SaaS payment path via quote acceptance

### What remains

**Runtime verification required:** A controlled Stripe test-mode Checkout creation with `commissionPercent > 0` to determine whether Stripe accepts or rejects the request. This requires Stripe test-mode API keys, which are not available in the current environment.

**If Stripe rejects:** Add `transfer_data.destination` with the provider's Stripe Connected Account ID, or remove `application_fee_amount` if Connect is not yet implemented for this path.

**If Stripe accepts but ignores:** The commission is not actually collected — the full amount goes to the platform. This is an accounting gap, not a Stripe error, but means the commission feature is non-functional.

## Conclusion

WLA-004 is a confirmed source-level configuration defect. The `application_fee_amount` is set without the required connected-account context for either Stripe Connect pattern. Runtime verification (Stripe test-mode API call) is needed to determine the exact Stripe behavior (reject vs silently ignore) before implementing a fix.
