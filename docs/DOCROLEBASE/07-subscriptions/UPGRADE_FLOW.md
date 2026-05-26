# Upgrade / Downgrade / Cancel

**Route:** `/dashboard/subscription`  
**APIs:** `POST /api/instructor/subscription`, `POST /api/instructor/subscription/billing-portal`, `POST /api/instructor/subscription/sync`, `DELETE /api/instructor/subscription`  
**Last updated:** May 2026

---

## How It Works

The flow depends on whether the instructor is on a trial or has an active paid subscription.

### Trial Instructors (no Stripe subscription yet)

Clicking any tier button calls `POST /api/instructor/subscription` directly:
- DB updated immediately — `subscriptionTier` and `subscriptionStatus` updated
- New tier features available instantly
- **Trial end date is never reset** — one trial window per instructor regardless of tier changes
- A confirmation dialog is shown first (upgrade-trial or downgrade-trial type)

### Active Paid Instructors (has `stripeSubscriptionId`)

Clicking any tier button shows an `active-change` dialog, then opens the **Stripe Billing Portal**:
1. `POST /api/instructor/subscription/billing-portal` creates a portal session
2. Instructor is redirected to Stripe's hosted portal
3. Stripe handles proration automatically (`create_prorations` must be set in portal config)
4. On return, URL contains `?portal_return=true`
5. `SubscriptionPlans.tsx` detects this and calls `POST /api/instructor/subscription/sync`
6. Sync fetches live subscription from Stripe and updates DB immediately
7. Webhook (`customer.subscription.updated`) arrives shortly after as a second confirmation

---

## Upgrade

**Trial:** Immediate — new tier features unlock instantly, trial end date preserved.

**Active:** Via Stripe Billing Portal. Stripe charges the prorated difference immediately. New tier features available after sync returns.

---

## Downgrade

**Trial:** Immediate — features from the higher tier are removed.

**Active:** Via Stripe Billing Portal. Stripe applies a credit for unused time. Downgrade takes effect at end of current billing period (Stripe default). Commission changes when downgrade takes effect.

**Important:** Existing confirmed bookings retain the commission rate at time of booking. Only new bookings after the effective date use the new rate.

---

## Cancel

`DELETE /api/instructor/subscription` or via Stripe Billing Portal.

- Sets `cancelAtPeriodEnd: true` on the `Subscription` record
- Stripe cancels at end of current billing period
- Instructor retains full access until `currentPeriodEnd`
- After expiry: `subscriptionStatus` → `CANCELLED`, new bookings blocked, dashboard read-only

---

## Sync Endpoint

`POST /api/instructor/subscription/sync` — called automatically after Billing Portal return.

- Fetches live subscription from Stripe
- Derives tier from price ID (handles Billing Portal upgrades where metadata isn't updated)
- Updates `Instructor.subscriptionTier`, `Instructor.subscriptionStatus`, `Subscription` record
- Returns `{ synced: true, tier, tierChanged, statusChanged }`

---

## Audit Log

All plan changes logged to `AuditLog` via `lib/services/auditLogger.ts`:
- `action`: `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_CANCELLED`
- `actorId`: instructor's userId
- `metadata`: tier, status, commissionRate, amount

---

## Related

- [TIERS.md](./TIERS.md) — Tier features and commission rates
- [BILLING.md](./BILLING.md) — Billing mechanics and portal config
- `app/api/instructor/subscription/route.ts` — Trial change handler
- `app/api/instructor/subscription/billing-portal/route.ts` — Portal session creator
- `app/api/instructor/subscription/sync/route.ts` — Post-portal sync
- `components/SubscriptionPlans.tsx` — UI with dialogs and sync trigger
