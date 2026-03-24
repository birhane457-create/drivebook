# Admin Dashboard

**Route:** `/admin`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/page.tsx`
**API:** `GET /api/admin/fortress-dashboard`

---

## What It Shows

- Platform stats:
  - Total instructors (approved, pending, suspended)
  - Total bookings (all time, this month)
  - Total clients
  - Platform revenue (this month)
- Subscription overview:
  - Instructors by tier (BASIC / PRO / BUSINESS)
  - Instructors on trial vs. active
- Recent bookings table (last 20, with status badges)
- Quick links to all admin sections

---

## Navigation

`components/admin/AdminNav.tsx` — top navigation with dropdown groups
`components/admin/MobileBottomNav.tsx` — mobile bottom tabs

Admin nav groups:
- Overview → `/admin`
- Users → Instructors, Clients, Staff Tasks
- Finance → Credits, Revenue, Payouts, Pricing
- Operations → Documents, Bookings, Audit Log
- Engagement → Reviews, Support
- Settings → `/admin/settings`

---

## All Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/admin` | Platform overview and stats |
| Instructors | `/admin/instructors` | Approve, reject, suspend instructors |
| Instructor Detail | `/admin/instructors/[id]` | Full profile, documents, bookings, ABN |
| Document Review | `/admin/documents/review/[instructorId]` | Review uploaded compliance documents |
| Clients | `/admin/clients` | Client list with wallet stats |
| Client Detail | `/admin/clients/[id]` | Wallet management, booking management |
| Bookings | `/admin/bookings` | All bookings — complete, no-show, cancel |
| Revenue | `/admin/revenue` | Commission, transactions, refunds, CSV export |
| Payouts | `/admin/payouts` | Instructor payout processing and disputes |
| Pricing | `/admin/pricing` | Commission rates, package discounts, fees |
| Settings | `/admin/settings` | Platform name, booking window, notifications |
| Reviews | `/admin/reviews` | Review moderation (read-only currently) |
| Support | `/admin/support` | Quick links and operator reference |
| Audit Log | `/admin/audit-log` | Full history of all financial and admin actions |
| Credits | `/admin/credits` | Client credit management |
| Staff Governance | `/admin/staff-governance` | Staff task management |

---

## Related

- [BOOKINGS.md](./BOOKINGS.md)
- [CLIENTS.md](./CLIENTS.md)
- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md)
- [DOCUMENTS.md](./DOCUMENTS.md)
- [CREDITS.md](./CREDITS.md)
- [STAFF_GOVERNANCE.md](./STAFF_GOVERNANCE.md)
- [REVENUE.md](./REVENUE.md)
- [PAYOUTS.md](./PAYOUTS.md)
- [SETTINGS.md](./SETTINGS.md)
- [REVIEWS.md](./REVIEWS.md)
- [AUDIT_LOG.md](./AUDIT_LOG.md)

