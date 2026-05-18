# Trial Period

**Fields:** `Instructor.trialEndsAt`, `Instructor.subscriptionStatus`  
**Config:** `lib/config/subscriptions.ts`  
**Last updated:** May 2026

---

## Trial Lengths

| Tier | Trial Days |
|------|-----------|
| BASIC | 14 days |
| PRO | 14 days |
| STUDIO | 14 days |
| BUSINESS | 30 days |

---

## Trial Mechanics

- No payment method required to start a trial
- Full feature access for the selected tier during trial
- `subscriptionStatus = TRIAL` during the trial period
- `trialEndsAt` stored on the `Instructor` record
- A `Subscription` record is created with `status: TRIAL` and `stripeSubscriptionId: null`

---

## Trial Expiry — Read-Only Mode

When `trialEndsAt` passes, the instructor enters **read-only mode**. They are NOT locked out.

**What they can still do:**
- Log in and access all dashboard pages
- View all booking history, client list, earnings, documents
- Download receipts and weekly earnings reports
- Access the subscription page to resubscribe

**What is blocked:**
- Creating new bookings (`POST /api/bookings` → 403)
- Adding new clients (`POST /api/clients` → 403)
- Changing settings (`PUT /api/instructor/settings` → 403)
- Editing profile (`PUT /api/instructor/profile` → 403)
- Scheduling PDA tests (`POST /api/pda-tests` → 403)
- Offline bookings (`POST /api/bookings/offline` → 403)

**Public booking page:**
- Shows "not accepting bookings" message — students cannot book
- Instructor profile info still visible (name, bio, rating)
- `POST /api/public/bookings` returns 403 `INSTRUCTOR_INACTIVE`

**Dashboard banner:**
- Amber `ReadOnlyBanner` shown at top of all dashboard pages
- CTA: "Choose a Plan" → `/dashboard/subscription`

**Implementation:** `lib/middleware/subscriptionValidation.ts` → `checkSubscriptionAccess()`

---

## Trial Banner (Active Trial)

The instructor dashboard shows subscription status banners:

| Condition | Banner | CTA |
|-----------|--------|-----|
| Trial, >7 days left | No banner | — |
| Trial, ≤7 days left | Amber — "Trial ends in N days" | Upgrade |
| Trial expired | Red — "Trial has expired" | Choose Plan |
| PAST_DUE | Yellow — "Payment past due" | Fix Now |

Banners shown in `app/dashboard/page.tsx` (instructor section).

---

## Starting a Paid Subscription from Trial

1. Instructor clicks "Choose a Plan" / "Upgrade" on the subscription page
2. Selects a tier and billing cycle
3. If no `stripeSubscriptionId` → creates a Stripe Checkout session
4. On successful payment → Stripe webhook updates `subscriptionStatus` to `ACTIVE`
5. `stripeSubscriptionId` saved to the `Subscription` record
6. Read-only mode lifted immediately

---

## Related

- [TIERS.md](./TIERS.md) — Tier features and pricing
- [BILLING.md](./BILLING.md) — Billing after trial
- `lib/middleware/subscriptionValidation.ts` — Access control implementation
- `components/instructor/ReadOnlyBanner.tsx` — Read-only UI banner
