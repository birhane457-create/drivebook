# Business Dashboard

**Route:** `/dashboard` (BUSINESS tier)  
**Auth required:** INSTRUCTOR role + BUSINESS subscription tier  
**File:** `app/dashboard/page.tsx`

---

## Purpose

The BUSINESS tier is designed for driving schools with multiple instructors. The dashboard owner (school admin) sees aggregated stats across all instructors in their team.

---

## What It Shows

- Total bookings across all team instructors (today, this week, this month)
- Team revenue summary
- Active instructors count vs. `maxInstructors` limit
- Upcoming lessons across the team
- Subscription status (BUSINESS tier allows up to 999 instructors)

---

## Team Management

`Instructor.maxInstructors` is set to `999` for BUSINESS tier. The school owner can add team instructors up to this limit.

---

## Related

- [INSTRUCTORS.md](./INSTRUCTORS.md) — Managing team instructors
- [REVENUE.md](./REVENUE.md) — School revenue reporting
- `docs/07-subscriptions/TIERS.md` — BUSINESS tier features
