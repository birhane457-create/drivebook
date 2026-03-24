# Upgrade / Downgrade / Cancel

**Route:** `/dashboard/subscription`  
**APIs:** `POST /api/instructor/subscription/change-plan`, `DELETE /api/instructor/subscription`

---

## Upgrade

Instructor selects a higher tier on the subscription page and clicks "Upgrade".

**Trial users** (no `stripeSubscriptionId`):
- DB updated immediately — no Stripe call
- New tier features available instantly

**Active users** (has `stripeSubscriptionId`):
- Calls `stripe.subscriptions.update` with proration
- Stripe charges the prorated difference immediately
- New tier features available after Stripe confirms

---

## Downgrade

Same flow as upgrade but to a lower tier.

**Proration:** Stripe calculates the credit for unused time on the current tier and applies it to the new tier's first invoice.

**Feature access:** Downgraded features (e.g. branded page for BASIC) are removed immediately after the plan change is confirmed.

---

## Cancel

Instructor clicks "Cancel Subscription" on the subscription page or in the Stripe Billing Portal.

**API:** `DELETE /api/instructor/subscription`

- Sets `cancelAtPeriodEnd: true` on the `Subscription` record
- Sets `cancelledAt` timestamp
- Stripe cancels at the end of the current billing period
- Instructor retains access until `currentPeriodEnd`
- After expiry: `subscriptionStatus` → `CANCELLED`, new bookings blocked

---

## Reactivation

If cancelled before `currentPeriodEnd`, the instructor can reactivate from the subscription page. This calls `stripe.subscriptions.update` to remove the `cancel_at_period_end` flag.

If already expired, the instructor must start a new subscription via Stripe Checkout.

---

## Audit Log

All plan changes are logged to `AuditLog` via `lib/services/auditLogger.ts`:
- `action`: `SUBSCRIPTION_UPGRADED`, `SUBSCRIPTION_DOWNGRADED`, `SUBSCRIPTION_CANCELLED`
- `actorId`: instructor's userId
- `metadata`: old tier, new tier, billing cycle

---

## Related

- [TIERS.md](./TIERS.md) — Tier features
- [BILLING.md](./BILLING.md) — Billing mechanics
- `docs/SUBSCRIPTION_SYSTEM.md` — Full subscription reference
