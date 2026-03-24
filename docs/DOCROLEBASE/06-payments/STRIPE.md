# Stripe Integration

**Webhook endpoint:** `POST /api/stripe/webhook`  
**File:** `app/api/stripe/webhook/route.ts`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Server-side secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side publishable key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe Dashboard |
| `STRIPE_BASIC_MONTHLY_PRICE_ID` | Stripe Price ID for BASIC monthly |
| `STRIPE_BASIC_ANNUAL_PRICE_ID` | Stripe Price ID for BASIC annual |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe Price ID for PRO monthly |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe Price ID for PRO annual |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | Stripe Price ID for BUSINESS monthly |
| `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | Stripe Price ID for BUSINESS annual |

**Note:** `STRIPE_WEBHOOK_SECRET` must be set to the real value from the Stripe Dashboard → Webhooks section. The placeholder `whsec_your_webhook_secret_here` will cause all webhook signature verifications to fail.

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

Instructor payouts use Stripe Connect. Each instructor has a `stripeAccountId` field. Payouts are sent to this account via the admin payouts page.

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
