# Subscription Billing

**Route:** `/dashboard/subscription`  
**APIs:** `POST /api/instructor/subscription/billing-portal`, `POST /api/subscriptions/checkout`

---

## Billing Cycles

| Cycle | Description | Savings |
|-------|-------------|---------|
| Monthly | Charged each month | — |
| Annual | Charged once per year | ~17% vs monthly |

Annual prices:
- BASIC: $290/year (vs $348 monthly)
- PRO: $790/year (vs $948 monthly)
- BUSINESS: $1,990/year (vs $2,388 monthly)

---

## Payment Method

Instructors add a payment method via Stripe Checkout or the Stripe Billing Portal. Card details are never stored on DriveBook — Stripe handles all PCI compliance.

---

## Stripe Billing Portal

`POST /api/instructor/subscription/billing-portal` creates a Stripe Billing Portal session where instructors can:
- Update payment method
- View invoice history
- Download invoices
- Cancel subscription

If the instructor has no `stripeCustomerId`, a Stripe Checkout session is created instead to add a payment method.

---

## Invoice Emails

Stripe sends invoice emails automatically to the instructor's email address on each billing cycle.

---

## Failed Payment

If a payment fails:
1. Stripe retries according to its retry schedule (typically 3 attempts over 7 days)
2. On first failure → `subscriptionStatus` set to `PAST_DUE`
3. Dashboard shows a "Payment failed — update your payment method" banner
4. After all retries fail → `subscriptionStatus` set to `CANCELLED`

---

## Cancellation

See [UPGRADE_FLOW.md](./UPGRADE_FLOW.md) for cancellation details.

---

## Related

- [TRIAL.md](./TRIAL.md) — Trial period before billing starts
- [UPGRADE_FLOW.md](./UPGRADE_FLOW.md) — Upgrade, downgrade, cancel
- `docs/06-payments/STRIPE.md` — Stripe configuration
