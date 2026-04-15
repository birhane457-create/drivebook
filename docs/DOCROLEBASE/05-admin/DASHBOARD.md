# Admin Dashboard

**Route:** `/admin`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/page.tsx`  
**API:** Direct Prisma queries (server component)

---

## What It Shows

**Stats row (4 cards):**
- Total instructors (approved · pending breakdown)
- Total bookings (+ this month count)
- Total students
- Platform revenue MTD (sum of settled transaction platform fees)

**Action alerts (shown only when action is needed):**

| Alert | Condition | Links to |
|-------|-----------|----------|
| 🟣 Ended lessons needing completion | `status = CONFIRMED` and `endTime < now` | `/admin/bookings` |
| 🟡 Documents expiring in 30 days | Any of license/insurance/police/WWC expiring within 30 days | `/admin/documents` |
| 🔴 Unverified ABNs | Approved instructors with ABN on file but `abnVerified = false` | `/admin/instructors` |
| 🟠 Pending approvals | `approvalStatus = PENDING` | `/admin/instructors?status=PENDING` |

These alerts are the primary daily operational surface. The dashboard is designed so the admin can see everything that needs action today without navigating anywhere.

**Subscription breakdown (4 tiles):**
- BASIC / PRO / STUDIO / BUSINESS — live count per tier with price label

**Quick action links:**
- Pending Approvals → `/admin/instructors?status=PENDING`
- Process Payouts → `/admin/payouts`
- All Bookings → `/admin/bookings`
- Revenue Report → `/admin/revenue`

**Recent Bookings table:**
- Last 10 bookings with client, instructor, date, status, price

---

## Navigation

`components/admin/AdminNav.tsx` — top navigation with dropdown groups  
`components/admin/MobileBottomNav.tsx` — mobile bottom tabs

Admin nav groups:
- Overview → `/admin`
- Users → Instructors, Clients, Staff Tasks
- Finance → Credits, Revenue, Payouts, Pricing
- Operations → Documents, Bookings, Audit Log, Test Centres
- Engagement → Reviews, Support
- Settings → `/admin/settings`

---

## All Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/admin` | Platform overview, action alerts, stats |
| Instructors | `/admin/instructors` | Approve, reject, suspend — inline actions with tier badges |
| Instructor Detail | `/admin/instructors/[id]` | Full profile, documents, bookings, subscription/ABN/tax data |
| Document Review | `/admin/documents/review/[instructorId]` | Review uploaded compliance documents |
| Clients | `/admin/clients` | Client list with wallet stats |
| Client Detail | `/admin/clients/[id]` | Wallet management, booking management |
| Bookings | `/admin/bookings` | All bookings — complete, no-show, cancel. Purple alert for ended lessons. |
| Revenue | `/admin/revenue` | Commission, transactions, refunds, CSV export |
| Payouts | `/admin/payouts` | Instructor payout processing and disputes |
| Pricing | `/admin/pricing` | Commission rates, package discounts, fees |
| Settings | `/admin/settings` | Platform name, booking window, notifications |
| Reviews | `/admin/reviews` | Review moderation — reads from Booking.clientRating/clientReview |
| Support | `/admin/support` | Quick links and operator reference |
| Audit Log | `/admin/audit-log` | Full history of all financial and admin actions |
| Credits | `/admin/credits` | Client credit overview and statistics |
| Staff Governance | `/admin/staff-governance` | Operational controls, refund monitoring, SLA stats |
| Test Centres | `/admin/test-centres` | Add/edit/deactivate WA DVS test centres |

---

## Related

- [BOOKINGS.md](./BOOKINGS.md)
- [CLIENTS.md](./CLIENTS.md)
- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md)
- [DOCUMENTS.md](./DOCUMENTS.md)
- [REVENUE.md](./REVENUE.md)
- [PAYOUTS.md](./PAYOUTS.md)
- [SETTINGS.md](./SETTINGS.md)
- [REVIEWS.md](./REVIEWS.md)
- [AUDIT_LOG.md](./AUDIT_LOG.md)
