# Subscription Billing

**Route:** `/dashboard/subscription`  
**APIs:** `POST /api/instructor/subscription/billing-portal`  
**Last updated:** May 2026

---

## Billing Cycles

| Cycle | Description | Savings |
|-------|-------------|---------|
| Monthly | Charged each month | — |
| Annual | Charged once per year | ~17% vs monthly |

Annual prices:
- BASIC: $290/year (vs $348 monthly)
- PRO: $790/year (vs $948 monthly)
- STUDIO: $1,290/year (vs $1,548 monthly)
- BUSINESS: $1,990/year (vs $2,388 monthly)

---

## Payment Method

Instructors add a payment method via Stripe Checkout or the Stripe Billing Portal. Card details are never stored on DriveBook — Stripe handles all PCI compliance.

---

## Stripe Billing Portal

`POST /api/instructor/subscription/billing-portal` creates a Stripe Billing Portal session.

**For active subscribers** (has `stripeSubscriptionId`): Opens the portal where instructors can:
- Upgrade or downgrade plan (Stripe handles proration)
- Update payment method
- View and download invoice history
- Cancel subscription

**For trial subscribers** (no `stripeSubscriptionId`): Creates a Stripe Checkout session to add a payment method and activate the subscription. Remaining trial days are passed to Stripe so billing doesn't start early.

**Return URL:** The portal return URL includes `?portal_return=true`. When the instructor lands back on the subscription page, `SubscriptionPlans.tsx` detects this and calls `POST /api/instructor/subscription/sync` to pull the latest state from Stripe.

---

## Stripe Billing Portal Configuration (required before go-live)

In Stripe Dashboard → Settings → Billing → Customer portal:
1. Add all 4 subscription products (BASIC, PRO, STUDIO, BUSINESS)
2. Enable plan switching (upgrade and downgrade)
3. Set proration behavior to `create_prorations`
4. Enable cancellation

---

## Invoice Emails

Stripe sends invoice emails automatically to the instructor's email address on each billing cycle.

---

## Failed Payment

If a payment fails:
1. Stripe retries according to its retry schedule (typically 3 attempts over 7 days)
2. On first failure → `subscriptionStatus` set to `PAST_DUE` (via `invoice.payment_failed` webhook)
3. Dashboard shows a "Payment failed — update your payment method" banner
4. After all retries fail → `subscriptionStatus` set to `CANCELLED`

---

## Proration (mid-cycle plan changes)

When an active subscriber upgrades or downgrades via the Billing Portal:
- Stripe calculates the prorated credit/charge automatically
- Upgrade: Stripe charges the difference immediately
- Downgrade: Stripe applies a credit to the next invoice; downgrade takes effect at period end

---

## Related

- [TRIAL.md](./TRIAL.md) — Trial period before billing starts
- [UPGRADE_FLOW.md](./UPGRADE_FLOW.md) — Upgrade, downgrade, cancel
- `docs/DOCROLEBASE/06-payments/STRIPE.md` — Stripe configuration
- `app/api/instructor/subscription/billing-portal/route.ts` — Portal session creator
