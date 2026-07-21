# Admin Dashboard

**Route:** `/admin`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/page.tsx`  
**Data source:** Direct Prisma queries (server component, all wrapped in try/catch)

---

## What It Shows

**Header:**
- Platform overview banner with current status

**Stats row (4 cards):**
- Total instructors (approved · pending breakdown)
- Total bookings (+ this month count)
- Total students
- Platform revenue MTD (sum of settled transaction platform fees)

**Key Widgets:**

**💳 Booking Payment Status** (Platform Revenue)
- Shows verified payment revenue only (Stripe, Wallet, Platform payments)
- Tracks platform bookings through payment stages
- Real-time status: Pending, Completed, Refunded, Expired
- Auto-refreshes every 60 seconds
- Excludes offline bookings (not platform revenue)
- Purpose: Visibility into what DriveBook actually owes instructors

**📊 Instructor Retention Status** (Offline Bookings)
- Shows offline bookings tracked by instructors
- Retention strategy metrics (optional feature)
- No financial impact (offline is not revenue)
- Auto-refreshes every 60 seconds
- Separate from platform revenue
- Purpose: Understand instructor use of offline features

**Action alerts (shown only when action is needed):**

| Alert | Condition | Links to |
|-------|-----------|----------|
| 🟣 Ended lessons needing completion | `status = CONFIRMED` and `endTime < now` | `/admin/bookings` |
| 🟡 Documents expiring in 30 days | Any of license/insurance/police/WWC expiring within 30 days | `/admin/documents` |
| 🔴 Unverified ABNs | Approved instructors with ABN on file but `abnVerified = false` | `/admin/instructors` |
| 🟠 Pending approvals | `approvalStatus = PENDING` | `/admin/instructors?status=PENDING` |

**Subscription breakdown (4 tiles):**
- BASIC / PRO / STUDIO / BUSINESS — live count per tier with price label

**Quick action links:**
- Pending Approvals → `/admin/instructors?status=PENDING`
- Process Payouts → `/admin/payouts`
- All Bookings → `/admin/bookings`
- Support Centre → `/admin/support`

**Recent Bookings table:**
- Last 10 bookings with client, instructor, date, status, price
- Source badges: blue "Platform" or grey "Offline"

**Crash resilience:** All DB queries are wrapped in `try/catch` with zero fallbacks. The dashboard renders with empty stats if the DB is unavailable — it never shows a 500 error.

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
| Support | `/admin/support` | User search + act on behalf (send message, reset password, add credit) |
| Audit Log | `/admin/audit-log` | Full history of all financial and admin actions |
| Credits | `/admin/credits` | Client credit overview and statistics |
| Staff Governance | `/admin/staff-governance` | Operational controls, refund monitoring, SLA stats |
| Test Centres | `/admin/test-centres` | Add/edit/deactivate WA DVS test centres |
| Copilot | `/admin/copilot` | AI-powered admin query interface (natural language DB queries) |
| Voice Lines | `/admin/voice-lines` | Twilio number pool — assign/release/suspend PRO+ instructor lines |
| Disputes | `/admin/disputes` | Stripe chargeback management and payout hold release |
| Cron Jobs | `/admin/cron-jobs` | Cron health monitoring dashboard |

---

## Required Data

The dashboard requires these records to exist in the database:
- `PlatformSettings` (key: `default`) — created by `node seed-platform-data.js`
- `PlatformLedger` (key: `default`) — created by `node seed-platform-data.js`

If these are missing, the dashboard renders with zero stats (no crash). Run `node seed-platform-data.js` after any fresh migration.

**Last Updated:** July 2026 (admin inspection — all `confirm()`/`alert()`/`prompt()` calls replaced with inline UI throughout)

---

## Related

- [BOOKINGS.md](./BOOKINGS.md)
- [CLIENTS.md](./CLIENTS.md)
- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md)
- [SUPPORT.md](./SUPPORT.md)
- [REVENUE.md](./REVENUE.md)
- [PAYOUTS.md](./PAYOUTS.md)
