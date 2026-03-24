# Instructor Dashboard

**Route:** `/dashboard`  
**Auth required:** INSTRUCTOR role + active subscription  
**File:** `app/dashboard/page.tsx`

---

## What It Shows

- Today's bookings (time, client name, pickup address)
- Upcoming bookings (next 7 days)
- Earnings summary (this week, this month)
- Subscription status banner:
  - Trial: days remaining + upgrade CTA
  - Active: renewal date + current tier
  - Past due: payment warning
  - Cancelled: reactivation CTA
- Quick actions: Add Booking, View Clients, Check Availability

---

## Subscription Gate

All instructor dashboard routes require an active subscription (`requireActiveSubscription` middleware). If the subscription is expired or cancelled, the instructor is redirected to `/dashboard/subscription` to reactivate.

Trial instructors have full access during the trial period.

---

## Navigation

Desktop: `components/DashboardNav.tsx` — sidebar navigation  
Mobile: `components/instructor/MobileBottomNav.tsx` — bottom tab bar

Tabs:
- Dashboard (home)
- Bookings
- Clients
- Earnings
- Settings

---

## Stats

The dashboard fetches from `GET /api/analytics` which returns:
- Total bookings (all time)
- Bookings this month
- Revenue this month
- Active clients count
- Average rating

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking management
- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown
- `docs/07-subscriptions/TIERS.md` — Subscription tiers
