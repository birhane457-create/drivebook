# Trial Period

**Fields:** `Instructor.trialEndsAt`, `Instructor.subscriptionStatus`, `Subscription.trialEndsAt`

---

## Trial Lengths

| Tier | Trial Days |
|------|-----------|
| BASIC | 14 days |
| PRO | 14 days |
| BUSINESS | 30 days |

---

## Trial Mechanics

- No payment method required to start a trial
- Full feature access for the tier during trial
- `subscriptionStatus` = `TRIAL` during the trial period
- `trialEndsAt` stored on both `Instructor` and `Subscription` models
- A `Subscription` record is created with `status: TRIAL` and `stripeSubscriptionId: null`

---

## Trial Expiry

When `trialEndsAt` passes:
- The instructor's `subscriptionStatus` is set to `CANCELLED` (or `PAST_DUE` if a payment method was added but failed)
- New booking creation is blocked (`requireActiveSubscription` middleware)
- The instructor is redirected to `/dashboard/subscription` to add a payment method

The cron job or webhook handles the status transition. Manual check: the subscription dashboard reads `trialEndsAt` and shows a countdown.

---

## Trial Banner

The instructor dashboard shows a trial banner:
- "X days remaining in your trial — Add payment method to continue"
- If expired: "Your trial has ended — Reactivate to continue booking"

---

## Starting a Paid Subscription from Trial

1. Instructor clicks "Add Payment Method" on the subscription page
2. If no `stripeSubscriptionId` → creates a Stripe Checkout session
3. On successful payment → Stripe webhook updates `subscriptionStatus` to `ACTIVE`
4. `stripeSubscriptionId` is saved to the `Subscription` record

---

## Related

- [TIERS.md](./TIERS.md) — Tier features and pricing
- [BILLING.md](./BILLING.md) — Billing after trial
- `docs/SUBSCRIPTION_SYSTEM.md` — Full subscription system reference
