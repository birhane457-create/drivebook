# Stripe Integration

**Webhook endpoint:** `POST /api/stripe/webhook`  
**File:** `app/api/stripe/webhook/route.ts`

---

## Environment Variables

| Variable | Description | Status |
|----------|-------------|--------|
| `STRIPE_SECRET_KEY` | Server-side secret key | Required — set in Vercel |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side publishable key | Required — set in Vercel |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe Dashboard | Required — set in Vercel (test mode: `whsec_Y1Lrems...`) |
| `STRIPE_BASIC_MONTHLY_PRICE_ID` | Stripe Price ID for BASIC monthly | Set |
| `STRIPE_BASIC_ANNUAL_PRICE_ID` | Stripe Price ID for BASIC annual | Set |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe Price ID for PRO monthly | Set |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe Price ID for PRO annual | Set |
| `STRIPE_STUDIO_MONTHLY_PRICE_ID` | Stripe Price ID for STUDIO monthly | Set (`price_1TMSdrPFqwsHwRMqcwzCLsLG`) |
| `STRIPE_STUDIO_ANNUAL_PRICE_ID` | Stripe Price ID for STUDIO annual | Set (`price_1TMSdrPFqwsHwRMqFuJ85ijO`) |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Stripe Price ID for BUSINESS monthly | Set (not yet purchasable) |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | Stripe Price ID for BUSINESS annual | Set (not yet purchasable) |

All Stripe keys are set in Vercel environment variables. The webhook secret is the test-mode signing secret. When switching to live mode, all keys must be replaced with live equivalents from the Stripe Dashboard.

---

## Webhook Events Handled

| Event | Handler |
|-------|---------|
| `payment_intent.succeeded` | Confirms booking, credits wallet, sends notification |
| `customer.subscription.updated` | Updates instructor subscription status |
| `customer.subscription.deleted` | Marks subscription as cancelled |
| `invoice.payment_failed` | Sets subscription to `PAST_DUE` |

---

## Idempotency

Every webhook event is stored in `WebhookEvent` before processing:
```
idempotencyKey = `${event.type}_${event.id}_${event.created}`
```
Duplicate delivery → returns `{ received: true, duplicate: true }` immediately.

---

## Payment Intent Creation

**API:** `POST /api/payments/create-intent`

Two paths:
- `bookingId` — for lesson payments (public booking flow)
- `transactionId` — for wallet top-ups

Commission rate is fetched from `PlatformSettings` via `getCommissionRate(tier)` and stored in Stripe metadata for auditability.

---

## Stripe Connect

Instructor payouts use Stripe Connect. Each instructor has a `stripeAccountId` field set when they complete onboarding via `POST /api/instructor/stripe-connect/onboard`.

**Current status:** Stripe Connect onboarding is fully implemented. Instructors can connect their bank account via the payout settings page. Once `chargesEnabled` and `payoutsEnabled` are true on the Connect account, the `payoutMethod` is automatically set to `stripe_connect`.

**Automated transfers:** When admin processes a payout for an instructor with `payoutMethod = stripe_connect`, the payout service initiates a Stripe transfer to their Connect account. For instructors with `payoutMethod = bank_transfer`, admin must manually transfer funds and mark the payout as sent.

**Note:** Stripe Connect transfers require the platform's Stripe account to have sufficient balance. In test mode, use Stripe test funds.

---

## Subscription Checkout

`POST /api/subscriptions/checkout` creates a Stripe Checkout session with:
- The correct Price ID for the selected tier and billing cycle
- `trial_period_days` from the plan config
- `success_url` and `cancel_url` pointing back to the subscription dashboard

---

## Billing Portal

`POST /api/instructor/subscription/billing-portal` creates a Stripe Billing Portal session for the instructor to manage their payment method, view invoices, and cancel.

---

## Related

- `docs/06-payments/COMMISSIONS.md` — Commission rates
- `docs/07-subscriptions/BILLING.md` — Subscription billing
- `docs/BOOKING_SYSTEM.md` — Payment intent reuse logic
