# Admin Audit Log

**Route:** `/admin/audit-log`
**Auth required:** ADMIN or SUPER_ADMIN
**API:** `GET /api/admin/audit-log`

---

## Overview

The audit log is the system's complete, append-only history of every financial and administrative action. It is the primary tool for:

- Debugging incidents ("what happened to this payout?")
- Compliance and legal review
- Investigating disputes
- Tracing automated system actions (cron jobs, webhooks)

Every entry is written at the time the action occurs and is never modified or deleted. The log is structured — not free-text — so it can be filtered, searched, and linked to related entities.

---

## Data Model

Each `AuditLog` entry contains:

| Field | Description |
|-------|-------------|
| `id` | PostgreSQL CUID — used for cursor pagination |
| `action` | Standardised action string (e.g. `PAYOUT_PAID`) |
| `actorId` | User ID of the admin who triggered the action, or `SYSTEM` for automated actions |
| `actorRole` | `ADMIN`, `SUPER_ADMIN`, or `SYSTEM` |
| `targetType` | Entity type: `PAYOUT`, `TRANSACTION`, `INSTRUCTOR`, `BOOKING` |
| `targetId` | ID of the affected record |
| `success` | `true` if the action completed without error |
| `errorMessage` | Set when `success = false` — the error message from the caught exception |
| `metadata` | JSON snapshot of key values at the time of the action (amounts, IDs, reasons) |
| `createdAt` | UTC timestamp — displayed in AWST in the UI |

---

## Action Reference

| Action | Human label | Trigger |
|--------|-------------|---------|
| `PAYOUT_CREATED` | Payout created | `buildPayout()` completes |
| `PAYOUT_PROCESSING` | Payout processing | Concurrency lock acquired in `executePayout()` |
| `PAYOUT_PAID` | Payout completed | Stripe transfer confirmed |
| `PAYOUT_FAILED` | Payout failed | Stripe or system error in `executePayout()` |
| `PAYOUT_HELD` | Payout held | Admin places hold via `POST /api/admin/payouts/[id]/hold` |
| `PAYOUT_RELEASED` | Payout released | Admin releases hold via `DELETE /api/admin/payouts/[id]/hold` |
| `DISPUTE_RESOLVED_REFUND_CLIENT` | Dispute — client refunded | `resolve` endpoint, `refund_client` action |
| `DISPUTE_RESOLVED_APPROVE_FOR_PAYOUT` | Dispute — approved for payout | `resolve` endpoint, `approve_for_payout` action |
| `DISPUTE_RESOLVED_CHARGE_INSTRUCTOR` | Dispute — instructor charged | `resolve` endpoint, `charge_instructor` action |
| `DISPUTE_RESOLVED_VOID` | Dispute — voided | `resolve` endpoint, `void` action |
| `DISPUTE_RESOLVED_SPLIT` | Dispute — split resolution | `resolve-split` endpoint |
| `ABN_VERIFICATION_REVOKED` | ABN revoked | Weekly `recheck-abn` cron finds a cancelled ABN |
| `ABN_VERIFIED` | ABN verified | Admin manually verifies via `POST /api/admin/instructors/[id]/verify-abn` |
| `PAYMENT_SUCCEEDED` | Stripe payment confirmed | `payment_intent.succeeded` webhook — booking payment |
| `PAYMENT_FAILED` | Stripe payment failed | `payment_intent.payment_failed` webhook |
| `WALLET_PAYMENT_SUCCEEDED` | Wallet top-up confirmed | `payment_intent.succeeded` webhook — wallet/package purchase |
| `INSTRUCTOR_APPROVED` | Instructor approved | Admin approves instructor registration |
| `INSTRUCTOR_SUSPENDED` | Instructor suspended | Admin suspends instructor account |

---

## API

### `GET /api/admin/audit-log`

Returns a paginated list of audit log entries, newest first.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `targetType` | string | Filter by entity type: `PAYOUT`, `TRANSACTION`, `INSTRUCTOR`, `BOOKING` |
| `action` | string | Filter by exact action string (e.g. `PAYOUT_FAILED`) |
| `actorId` | string | Filter by actor user ID |
| `from` | ISO datetime | Inclusive lower bound on `createdAt` |
| `to` | ISO datetime | Inclusive upper bound on `createdAt` |
| `limit` | number | Entries per page. Default: 50. Max: 100 |
| `cursor` | string | Last `id` from previous page — omit for first page |

**Response:**

```json
{
  "logs": [ ...AuditLog[] ],
  "nextCursor": "string | undefined"
}
```

`nextCursor` is present only when more pages exist. Pass it as `cursor` in the next request to get the next page.

**Pagination notes:**
- Cursor-based (not offset). Safe for high-frequency writes — no skipped or duplicated rows between pages.
- Cursor is the `id` (CUID) of the last entry on the current page.
- Sort is always `createdAt DESC`.

---

## UI

### Filter bar

Four filters available at the top of the page:

- Target type — dropdown: All / PAYOUT / TRANSACTION / INSTRUCTOR / BOOKING
- Action — dropdown with human-readable labels (e.g. "Payout failed" maps to `PAYOUT_FAILED`)
- From / To — datetime pickers (AWST)

Filters persist in the URL (`?targetType=PAYOUT&action=PAYOUT_FAILED`). Links are shareable — useful for handing off an incident to another admin.

Default view on first load: last 24 hours, no other filters.

### Quick filter buttons

One-click presets that reset all filters and fetch immediately:

| Button | Equivalent filter |
|--------|------------------|
| ❌ Failed only | `action=PAYOUT_FAILED` |
| 💸 Payouts | `targetType=PAYOUT` |
| ⚖️ Disputes | `targetType=TRANSACTION` |
| 👤 Instructors | `targetType=INSTRUCTOR` |
| 📅 Last 7 days | `from=<7 days ago>` |

Quick filters bypass React state and call the API directly — the table updates instantly. A spinning "Updating…" indicator appears while the fetch is in flight. Buttons are disabled during the fetch to prevent double-clicks.

### Table columns

| Column | Notes |
|--------|-------|
| Time | Relative (e.g. "14m ago") with exact AWST timestamp on hover |
| Action | Human-readable label, colour-coded: green = success/approved, red = failed/revoked/suspended, yellow = held/charged |
| Target | Entity type badge + last 8 chars of ID + external link icon |
| Actor | Last 8 chars of user ID, or purple `SYSTEM` badge for automated actions |
| Status | Green `✓ OK` or red `✗ Failed` badge |

### Row expansion

Click any row to expand it. The expanded view shows:

- Exact timestamp (AWST) and full actor ID + role
- Error message (if `success = false`)
- `resolutionGroupId` badge (purple `🧵 RES-GRP-XXXXXX`) — present on split dispute entries, links both legs of the resolution visually
- Metadata key/value table — all fields from the `metadata` JSON, formatted for readability

### Critical row highlighting

Rows with `success = false`, or with actions `PAYOUT_FAILED`, `ABN_VERIFICATION_REVOKED`, or `INSTRUCTOR_SUSPENDED`, are marked with a red left border. This draws attention without overwhelming the table.

### Navigation links

Each row with a known `targetType` shows an external link icon:

| Target type | Links to |
|-------------|---------|
| `PAYOUT` | `/admin/payouts` |
| `INSTRUCTOR` | `/admin/instructors/[targetId]` |
| `BOOKING` | `/admin/bookings` |
| `TRANSACTION` | — (no direct page) |

### Load more

The table loads 50 entries per page. A "Load more" button appears at the bottom when more pages exist. Clicking it appends the next page to the existing table (does not replace it).

---

## Split Dispute Grouping

When a split resolution is executed via `POST /api/admin/payouts/resolve-split`, both legs (refund + approve for payout) are logged with a shared `resolutionGroupId` in their metadata (e.g. `RES-GRP-A1B2C3D4`).

In the audit log UI, expanding either leg shows the purple `🧵 RES-GRP-XXXXXX` badge. This makes it immediately clear that the two entries are linked and part of the same atomic operation.

To find all entries for a specific split resolution, filter by `targetType=TRANSACTION` and search for the `resolutionGroupId` in the metadata.

---

## SYSTEM Actor

Actions triggered by automated processes (cron jobs, webhooks) use `actorId = SYSTEM` and `actorRole = SYSTEM`. In the UI, these show a purple `SYSTEM` badge instead of a truncated user ID.

Current SYSTEM actors:

| Source | Actions logged |
|--------|---------------|
| `recheck-abn` cron | `ABN_VERIFICATION_REVOKED` |
| Stripe webhook | (payment events — not yet logged to AuditLog) |

---

## Performance Notes

The `AuditLog` table has the following indexes (created via SQL migration — already applied):

```sql
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);
CREATE INDEX "AuditLog_targetType_createdAt_idx" ON "AuditLog" ("targetType", "createdAt" DESC);
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt" DESC);
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt" DESC);
```

These support all common query patterns: filter by action, filter by target, filter by actor, sort by time.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Payout state machine and audit trail reference
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution actions and `resolutionGroupId`
- `lib/services/payout-service.ts` — `logTransition()` helper that writes payout audit entries
- `app/api/admin/audit-log/route.ts` — API implementation
- `app/admin/audit-log/page.tsx` — UI implementation
# Admin Bookings

**Route:** `/admin/bookings`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/bookings/page.tsx`
**APIs:** `GET /api/admin/bookings`, `PATCH /api/admin/bookings`, `POST /api/admin/bookings`

---

## Overview

The admin bookings page shows every booking on the platform. Admin can view, filter, and manage the status of any booking regardless of which instructor or client it belongs to. This is the primary tool for resolving lesson issues, marking completions, and handling no-shows.

---

## Stats Bar

Seven counters shown at the top of the page:

| Counter | Description |
|---------|-------------|
| Total | All bookings ever |
| Confirmed | Active upcoming or in-progress lessons |
| Pending | Awaiting instructor confirmation |
| Completed | Lessons marked complete |
| Cancelled | Cancelled by any party |
| No-Show | Marked as no-show (either party) |
| Ended (unpaid) | CONFIRMED bookings whose `endTime` has passed — needs admin action |

The "Ended (unpaid)" counter is the most operationally important. A purple alert banner appears when this count is > 0, prompting admin to mark those lessons complete so instructor payouts can be released.

---

## Filters

- Free-text search: client name, client email, instructor name, booking ID
- Status filter buttons: All / CONFIRMED / PENDING / COMPLETED / CANCELLED / NO_SHOW

The API fetches up to 200 bookings ordered by `startTime DESC`. Client-side filtering is applied on top.

---

## Table Columns

| Column | Notes |
|--------|-------|
| Client | Name + email/phone. Package lesson badge shown if `isPackageBooking = true` |
| Instructor | Name |
| Date / Time | Start date, start–end time |
| Status | Colour-coded badge. Purple "ended" indicator for lessons past `endTime` still in CONFIRMED |
| Price | Lesson price paid by client |
| Manage | Opens the action drawer. Purple button for ended-but-unresolved lessons |

---

## Action Drawer

Clicking "Manage" opens a bottom sheet (mobile) / modal (desktop) with context-aware actions.

### Available actions

| Action | When available | Effect |
|--------|---------------|--------|
| Mark as Completed | CONFIRMED or PENDING, and `endTime` has passed | Sets `status = COMPLETED`. Transaction becomes eligible for payout. Shows payout link. |
| Mark as No-Show | CONFIRMED, and `startTime` has passed | Opens no-show party picker (see below) |
| Confirm Booking | PENDING only | Sets `status = CONFIRMED` |
| Cancel Booking | Any non-terminal status | Calls `POST /api/bookings/[id]/cancel`. Refund applied per cancellation policy. |

Actions are disabled with a reason shown when timing conditions aren't met (e.g. "Lesson ends 3:00 PM on 24 Mar" blocks Complete until then).

Terminal statuses (COMPLETED, CANCELLED, NO_SHOW) show "no further actions available."

### No-show party picker

When admin marks a booking as NO_SHOW, a second step asks who didn't show:

| Party | Effect |
|-------|--------|
| Instructor didn't show | `status = NO_SHOW`, transaction tagged `[INSTRUCTOR_NO_SHOW]`. Goes to Withheld tab in Payouts. Recommended resolution: refund client + charge instructor penalty. |
| Client didn't show | `status = NO_SHOW`, transaction tagged `[CLIENT_NO_SHOW]`. Goes to Withheld tab in Payouts. Recommended resolution: approve instructor for payout. |
| Both / Disputed | `status = NO_SHOW`, transaction tagged `[DISPUTED]`. Goes to Disputes tab in Payouts for manual resolution. |

The tag is written to `Transaction.description` and is read by the Payouts page to surface the correct resolution path.

### Package lesson handling

If `isPackageBooking = true`, a purple banner is shown in the drawer. Cancellation refunds return as wallet credit (not a card refund). This is noted in the cancel and no-show confirmation screens.

### Post-complete screen

After marking complete, a confirmation screen shows:
- Instructor payout amount now eligible
- Link to `/admin/payouts` to process the payout

### Post-no-show screen

After recording a no-show, a screen shows the resolution steps specific to the party selected (instructor / client / both), with a link to `/admin/payouts`.

---

## API

### `GET /api/admin/bookings`

Returns up to 200 bookings ordered by `startTime DESC`, plus a `stats` object.

Query params: `status`, `search`, `from`, `to` (all optional).

### `PATCH /api/admin/bookings`

Updates a booking's status.

```json
{ "bookingId": "string", "status": "CONFIRMED|COMPLETED|CANCELLED|NO_SHOW|PENDING", "noShowParty": "instructor|client|both" }
```

`noShowParty` is only used when `status = NO_SHOW`. It writes the party label to the first linked transaction's `description` field.

### `POST /api/admin/bookings`

Creates a booking on behalf of a client. Used from the Client Detail page (see CLIENTS.md).

Required: `clientId`, `instructorId`, `startTime`, `endTime`.
Optional: `notes`, `price` (defaults to instructor hourly rate × duration).

Checks client wallet balance before creating. Deducts from wallet atomically. Sets `status = CONFIRMED`, `isPaid = true`.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — What happens after a booking is marked complete or no-show
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution for no-show cases
- [CLIENTS.md](./CLIENTS.md) — Creating bookings from the client detail page
# Admin Clients

**Routes:** `/admin/clients`, `/admin/clients/[id]`
**Auth required:** ADMIN or SUPER_ADMIN
**Files:** `app/admin/clients/page.tsx`, `app/admin/clients/[id]/page.tsx`
**APIs:**
- `GET /api/admin/clients` — list all clients
- `GET /api/admin/clients/[id]/wallet` — client detail + wallet + bookings
- `PATCH /api/admin/clients/[id]` — update client profile
- `POST /api/admin/clients/[id]/wallet/add-credit` — add wallet credit
- `POST /api/admin/clients/[id]/wallet/deduct-credit` — deduct wallet credit

---

## Client List (`/admin/clients`)

### Stats bar

| Stat | Description |
|------|-------------|
| Total Clients | All registered clients |
| Active Wallets | Clients with `creditsRemaining > 0` |
| Total Credits Paid | Sum of all wallet top-ups across all clients |
| Total Spent | Sum of all booking charges across all clients |
| Zero Balance | Clients with exactly $0 remaining |

### Filters

- Search by name or email (client-side filter)
- Status filter: All / Active (has credits) / Zero Balance / Negative Balance

### Table columns

| Column | Notes |
|--------|-------|
| Client Name | |
| Email | |
| Total Paid | All credits ever loaded into wallet |
| Spent | All booking charges (net of cancellation refunds) |
| Remaining | Current wallet balance — green if > 0, amber if 0, red if negative |
| Bookings | Total booking count |
| Status | Active / Zero / Negative badge |
| Actions | "Details" link → `/admin/clients/[id]` |

### Status definitions

| Status | Condition |
|--------|-----------|
| Active | `creditsRemaining > 0` |
| Zero Balance | `creditsRemaining = 0` |
| Negative | `creditsRemaining < 0` (should not occur in normal operation) |

---

## Client Detail (`/admin/clients/[id]`)

Full management page for a single client. Loaded from `GET /api/admin/clients/[id]/wallet`.

### Profile section

Shows: name, email, phone, notes, account creation date, current instructor (if assigned).

Admin can edit all profile fields inline via "Edit Details" mode:
- Name, email, phone, notes
- Saved via `PATCH /api/admin/clients/[id]`

### Wallet summary

| Field | Description |
|-------|-------------|
| Total Paid | All credits loaded |
| Total Spent | All booking charges |
| Remaining | Current balance |
| Usage bar | Visual `totalSpent / totalPaid` percentage |

### Wallet actions

**Add credit:**
- Admin enters amount + optional reason
- Calls `POST /api/admin/clients/[id]/wallet/add-credit`
- Creates a `CREDIT` wallet transaction
- Increments `ClientWallet.balance`

**Deduct credit:**
- Admin enters amount + optional reason
- Calls `POST /api/admin/clients/[id]/wallet/deduct-credit`
- Creates a `DEBIT` wallet transaction
- Decrements `ClientWallet.balance`

Both operations require a positive amount. Reason defaults to "Manual add/deduct by admin" if not provided.

### Transaction history drawer

Slide-in drawer showing all wallet transactions for the client.

Filterable by: All / Credits / Debits.

Each entry shows: description, timestamp, type badge (CREDIT/REFUND = green, DEBIT = red), amount with +/- prefix.

### Bookings drawer

Slide-in drawer showing all bookings for the client.

Filterable by: All / Confirmed / Completed / Cancelled / Pending.

**Per-booking actions (⋯ menu):**

| Action | When available | Effect |
|--------|---------------|--------|
| Reschedule | CONFIRMED or PENDING | Inline date/time picker. Calls `PATCH /api/bookings/[id]` with new `startTime`/`endTime`. Duration preserved. |
| Mark Complete | CONFIRMED or PENDING | Calls `PATCH /api/bookings/[id]` with `status: COMPLETED` |
| Cancel + Refund | CONFIRMED or PENDING | Calls `POST /api/bookings/[id]/cancel`. Refund per cancellation policy. |
| Remove record | Any status | Soft-delete via `DELETE /api/bookings/[id]`. Audit log entry created. |

### Create booking (from client detail)

Admin can create a new booking for the client directly from the bookings drawer.

Steps:
1. Select instructor — search by name or suburb/postcode. Current instructor shown as shortcut.
2. Select date + duration (1–3 hours in 30-min increments)
3. Select time slot — fetched from `GET /api/availability/slots`
4. Credit check — shows lesson cost vs wallet balance. Blocks creation if insufficient.
5. Optional notes
6. Submit → `POST /api/admin/bookings`

The booking is created as CONFIRMED + isPaid = true. Wallet is debited atomically.

---

## API Details

### `GET /api/admin/clients`

Returns all clients with computed wallet stats:
- `totalPaid` — sum of non-refund CREDIT transactions + confirmed/completed booking prices
- `totalSpent` — sum of DEBIT transactions minus cancellation refunds
- `creditsRemaining` — `ClientWallet.balance` (source of truth)
- `bookingCount` — total bookings
- `status` — `active | zero-balance | negative`

### `GET /api/admin/clients/[id]/wallet`

Returns full client detail:
```json
{
  "user": { "id", "name", "email", "phone", "notes", "createdAt" },
  "wallet": { "id", "totalPaid", "totalSpent", "creditsRemaining", "transactions": [...] },
  "bookings": [...],
  "clientId": "string",
  "currentInstructor": { "id", "name", "hourlyRate", "serviceAreas", "baseAddress" } | null
}
```

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking status management
- `docs/02-student/WALLET.md` — Wallet mechanics from the client perspective
- `docs/06-payments/REFUNDS.md` — Refund policy on cancellation
# Credits Management

**Route:** `/admin/credits`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/credits/page.tsx`  
**API:** `GET /api/admin/clients` (reused — no dedicated credits endpoint)

---

## What It Shows

A read-only aggregate view of all client wallet credits across the platform. Data is derived from the client list API.

### Stats Cards

| Card | Value | Color |
|------|-------|-------|
| Total Credits Paid | Sum of all `totalPaid` across clients | Blue |
| Total Spent | Sum of all `totalSpent` across clients | Orange |
| Total Remaining | `totalPaid - totalSpent` | Green |
| Clients with Credits | Count of clients where `totalPaid > 0` | Purple |

### Secondary Metrics

| Metric | Formula |
|--------|---------|
| Average Credits/Client | `totalPaid / clientCount` |
| Average Spent/Client | `totalSpent / clientCount` |
| Credit Utilization | `(totalSpent / totalPaid) * 100` % |

---

## Problem Areas

### Zero Balance Clients

Clients where `status === "zero-balance"` — they have exhausted their credits and cannot book without topping up. Links to `/admin/clients?status=zero-balance`.

### Negative Balance Clients

Clients where `status === "negative"` — indicates a refund or dispute has pushed the balance below zero. Links to `/admin/clients?status=negative` for resolution.

---

## Actions

- Refresh Data — re-fetches from `/api/admin/clients`
- Manage All Clients — navigates to `/admin/clients`

---

## Notes

- This page has no direct write capability. All credit adjustments (add/deduct) are done from the Client Detail page (`/admin/clients/[id]`).
- The credits page is a monitoring view, not a management tool.
- Negative balances should be investigated via the Audit Log and resolved through the client wallet or dispute flow.

---

## Related

- [CLIENTS.md](./CLIENTS.md) — Client detail with wallet add/deduct
- [PAYOUTS.md](./PAYOUTS.md) — How credits flow into instructor payouts
- [AUDIT_LOG.md](./AUDIT_LOG.md) — Credit adjustment history
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
# Disputes

**Route:** `/admin/payouts` (Disputes tab)  
**Auth required:** ADMIN or SUPER_ADMIN  

---

## What Is a Dispute?

A dispute is raised when there is a disagreement about whether a lesson occurred, who was at fault for a no-show, or whether a refund is warranted.

---

## How Disputes Are Created

1. Admin marks a booking as `NO_SHOW` via `PATCH /api/admin/bookings`
2. Admin selects the no-show party: `INSTRUCTOR_NO_SHOW`, `CLIENT_NO_SHOW`, or `DISPUTED`
3. The transaction is tagged with the no-show type
4. The booking appears in the Disputes tab of `/admin/payouts`

---

## Resolution Options

### Single-action resolution

Admin resolves a dispute via `POST /api/admin/payouts/resolve`:

```json
{
  "transactionId": "string",
  "action": "refund_client | approve_for_payout | charge_instructor | void",
  "reason": "optional note"
}
```

| Action | Effect |
|--------|--------|
| `refund_client` | Credits the client's wallet with the full booking amount. Marks the transaction `REFUNDED`. |
| `approve_for_payout` | Marks the transaction `SETTLED` — eligible for the next payout run. No Stripe transfer happens here. Admin must process the payout separately from the Eligible tab. UI shows: "Approved for payout — go to Eligible tab to process." |
| `charge_instructor` | Creates a negative `ADJUSTMENT` ledger entry against the instructor (deducted from their next payout). Marks the original transaction `CANCELLED`. |
| `void` | Cancels the transaction with no money movement on either side. Marks the transaction `CANCELLED`. |

**`approve_for_payout` vs `pay_instructor`:** The action was renamed from `pay_instructor` to `approve_for_payout` to accurately reflect that no money moves at this step. The old name `pay_instructor` is still accepted by the API as a backward-compatible alias but is deprecated in the UI.

All resolutions require a written reason. Every action creates an `AuditLog` entry with `targetType: 'TRANSACTION'`.

**Idempotency:** The resolve endpoint checks the transaction's current status before executing. Terminal states (`REFUNDED`, `CANCELLED`) return HTTP 409. `approve_for_payout` on an already-`SETTLED` transaction also returns 409.

### Atomic split resolution

When fault is shared between both parties, admin uses `POST /api/admin/payouts/resolve-split`:

```json
{
  "transactionId": "string",
  "refundAmount": 50.00,
  "payoutAmount": 30.00,
  "reason": "optional note"
}
```

Both legs execute inside a single DB `$transaction`:
1. Partial refund credited to client wallet
2. Transaction marked `SETTLED` with `instructorPayout` updated to `payoutAmount`

If either leg fails, the entire operation rolls back — no partial state is possible. This replaces the previous approach of two sequential API calls which had no atomicity guarantee.

A `resolutionGroupId` (e.g. `RES-GRP-A1B2C3D4`) is generated and stored on the transaction, linking both legs in the audit log under a single `DISPUTE_RESOLVED_SPLIT` entry.

**Idempotency:** If `resolutionStatus = COMPLETED` already exists on the transaction, returns HTTP 409 with the existing `resolutionGroupId`.

---

## Escalation

If a dispute cannot be resolved by admin, it can be escalated to the finance team. The admin sets a manual hold on the payout and contacts the finance team via `ADMIN_EMAIL`.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Payout management
- `docs/BOOKING_SYSTEM.md` — NO_SHOW handling
- `docs/04-legal/CANCELLATION_POLICY.md` — Cancellation and refund policy
# Documents & Compliance

**Routes:** `/admin/documents`, `/admin/documents/review/[instructorId]`  
**Auth required:** ADMIN or SUPER_ADMIN  
**Files:** `app/admin/documents/page.tsx`, `app/admin/documents/review/[instructorId]/page.tsx`  
**APIs:** `GET /api/admin/documents/compliance`, `POST /api/admin/documents/compliance`, `GET /api/admin/documents/instructor/[instructorId]`, `POST /api/admin/documents/instructor/[instructorId]/approve`, `POST /api/admin/documents/instructor/[instructorId]/expiry`, `POST /api/admin/documents/instructor/[instructorId]/upload`

---

## Documents Overview Page — `/admin/documents`

Lists all instructors with a compliance summary. Each row shows:

- Instructor name and email
- Overall compliance status: `valid` / `expiring` / `expired`
- Individual document issues (e.g. "License: expired", "WWC: missing")
- Whether documents have been formally verified (`documentsVerified`)
- Active/inactive status

### Status Logic

Computed per instructor by `GET /api/admin/documents/compliance`:

| Status | Condition |
|--------|-----------|
| `valid` | All docs present, no expiry within 30 days |
| `expiring` | At least one doc expires within 30 days, none expired |
| `expired` | At least one doc is missing or past expiry |

Overall status = worst of the four tracked docs (license, insurance, police check, WWC).

### Bulk Actions (POST /api/admin/documents/compliance)

| Action | Effect |
|--------|--------|
| `deactivate` | Sets `isActive: false` for a specific instructor |
| `sendReminder` | Queues a document renewal reminder (logged, email TBD) |
| `autoProcess` | Scans all active instructors — deactivates any where ALL four docs are expired |

---

## Document Review Page — `/admin/documents/review/[instructorId]`

Per-instructor document review. Fetches from `GET /api/admin/documents/instructor/[instructorId]`.

### Document Fields

| Field | Label | Expiry Tracked | Required |
|-------|-------|----------------|----------|
| `licenseImageFront` | Driver License (Front) | Yes (`licenseExpiry`) | Yes |
| `licenseImageBack` | Driver License (Back) | No | Yes |
| `insurancePolicyDoc` | Insurance Policy | Yes (`insuranceExpiry`) | Yes |
| `policeCheckDoc` | Police Check | Yes (`policeCheckExpiry`) | Yes |
| `wwcCheckDoc` | Working with Children Check | Yes (`wwcCheckExpiry`) | Yes |
| `photoIdDoc` | Photo ID | No | Yes |
| `certificationDoc` | Instructor Certification | No | No |
| `vehicleRegistrationDoc` | Vehicle Registration | No | Yes |

### Traffic Light System

Each document row shows a colored dot:

| Color | Meaning |
|-------|---------|
| Green ✓ | Document present, expiry valid (>30 days) |
| Yellow ! | Document present but expiry within 30 days, or no expiry date set |
| Red ✗ | Document missing or expired |

Overall header status = worst of all tracked docs.

### Actions

- Save Expiry Dates — `POST /api/admin/documents/instructor/[instructorId]/expiry` — persists the four expiry date inputs
- Approve All Documents — `POST /api/admin/documents/instructor/[instructorId]/approve` — sets `documentsVerified: true` and records `documentsVerifiedAt`
- Upload / Replace — `POST /api/admin/documents/instructor/[instructorId]/upload` (multipart) — replaces a specific document field
- Remove — same upload endpoint with `{ field, remove: true }` — clears the document URL

### Expiry Summary Panel

Shows a 2×2 grid of the four expiry-tracked documents with color-coded date badges. Useful for quick at-a-glance review before approving.

---

## Compliance Data Source

Expiry dates are stored inside the `workingHours` JSON field on the `Instructor` model under `workingHours.expiry`:

```json
{
  "expiry": {
    "licenseExpiry": "2026-06-01",
    "insuranceExpiry": "2026-09-15",
    "policeCheckExpiry": "2027-01-01",
    "wwcCheckExpiry": "2026-12-31"
  }
}
```

This is a known schema quirk — expiry dates are embedded in `workingHours` rather than top-level fields.

---

## Related

- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md) — Approve/reject/suspend flow
- [AUDIT_LOG.md](./AUDIT_LOG.md) — Document verification events are logged
# Instructor Approvals

**Route:** `/admin/instructors`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/instructors/page.tsx`, `components/admin/InstructorApprovalList.tsx`  
**APIs:** `GET /api/admin/instructors`, `POST /api/admin/instructors/[id]/approve`, `POST /api/admin/instructors/[id]/reject`, `POST /api/admin/instructors/[id]/suspend`

---

## Instructor Lifecycle

```
PENDING → APPROVED
PENDING → REJECTED
APPROVED → SUSPENDED
SUSPENDED → APPROVED  (reinstatement)
REJECTED → APPROVED   (reinstatement)
```

`Instructor.approvalStatus` field.

---

## Instructor List

The list uses `InstructorApprovalList` — a client component with inline actions.

**Each row shows:**
- Avatar + name
- Approval status badge (PENDING / APPROVED / REJECTED / SUSPENDED)
- Subscription tier badge (PRO / STUDIO / BUSINESS — BASIC not shown)
- Compliance dot (green = all valid, yellow = expiring soon, red = expired/missing)
- Email, phone, suburb
- Booking count, average rating, hourly rate
- Action buttons (context-aware per status)
- Expand chevron → shows compliance expiry dates, document status, stats, bio

**Filter tabs:** All / PENDING / APPROVED / REJECTED / SUSPENDED (via `?status=` query param)

**Search:** Name, email, phone, suburb — client-side filter

---

## Inline Actions

All actions happen without leaving the list page:

| Action | When shown | Effect |
|--------|-----------|--------|
| Approve | PENDING | Sets `approvalStatus = APPROVED`, `isVerified = true`. Sends approval email. |
| Reject | PENDING | Opens reason modal (min 10 chars). Sets `approvalStatus = REJECTED`. Sends rejection email. |
| Suspend | APPROVED | Opens reason modal. Sets `approvalStatus = SUSPENDED`, `isActive = false`. |
| Reactivate | SUSPENDED or REJECTED | Calls approve endpoint. Sets `approvalStatus = APPROVED`. |
| Profile | Any | Links to `/admin/instructors/[id]` |
| Docs | Any | Links to `/admin/documents/review/[id]` |

After each action, the page reloads to reflect the new state. A flash toast confirms success.

---

## Instructor Detail

**Route:** `/admin/instructors/[id]`  
**File:** `app/admin/instructors/[id]/page.tsx`

Three tabs: Overview / Bookings / Documents

**Overview tab shows:**
- Booking stats (completed, upcoming, cancelled, pending)
- Document status (license, insurance, police check, WWC) with expiry dates
- Subscription tier, status, hourly rate, payout method
- ABN number, verification status, withholding tax rate
- Link to manage ABN verification

**Bookings tab:** All bookings for this instructor with status, client, date, price

**Documents tab:** Document images with view links, expiry dates, link to full document review page

---

## Document Review

**Route:** `/admin/documents/review/[instructorId]`  
**File:** `app/admin/documents/review/[instructorId]/page.tsx`

Admins review uploaded documents before approving an instructor:
- Driver's licence (front + back)
- Insurance policy
- Police check
- WWC check
- Photo ID
- Vehicle registration

Document expiry dates are shown. Expired documents trigger a warning.

**API:** `GET /api/admin/documents/instructor/[instructorId]`, `POST /api/admin/documents/compliance`

---

## ABN Verification

**Route:** `POST /api/admin/instructors/[id]/verify-abn`

Admins can manually verify or revoke an instructor's ABN.

| Field | When `verified: true` | When `verified: false` |
|-------|----------------------|------------------------|
| `abnVerified` | `true` | `false` |
| `abnStatus` | `ACTIVE` | `REVIEW_REQUIRED` |
| `withholdingTaxRate` | `0` | `47` |

A weekly cron (`GET /api/cron/recheck-abn`) re-validates all instructor ABNs against the ABR API. If an ABN is cancelled, `abnVerified` is cleared and payouts are blocked.

---

## Related

- [DASHBOARD.md](./DASHBOARD.md) — Platform overview with pending count alert
- [DOCUMENTS.md](./DOCUMENTS.md) — Document compliance review
- [PAYOUTS.md](./PAYOUTS.md) — How ABN status gates payout withholding
- [AUDIT_LOG.md](./AUDIT_LOG.md) — ABN verification events
# Revenue Reporting

**Route:** `/admin/revenue`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/revenue/page.tsx`  
**API:** `GET /api/admin/revenue`  
**Ledger API:** `GET /api/admin/ledger`

---

## What It Shows

4 tabs:

### Overview
- Total platform revenue (date range)
- Total instructor payouts
- Platform net (revenue − payouts)
- GST collected
- Booking count, average booking value
- Platform ledger balance (live)

### Transactions
- Full transaction list with filters:
  - Date range
  - Instructor
  - Transaction type (`BOOKING_PAYMENT`, `REFUND`, `MANUAL_ADJUSTMENT`)
  - Status (`PENDING`, `COMPLETED`, `CANCELLED`)
- Each row: date, instructor, client, amount, platform fee, instructor payout, commission rate

### Refunds
- All refund transactions
- Refund reason, original booking, amount refunded
- Refund rate (% of total revenue)

### Export
- CSV export of all transactions in the selected date range
- Columns: date, bookingId, instructorName, clientName, amount, platformFee, instructorPayout, commissionRate, status

---

## Platform Ledger

The `PlatformLedger` singleton tracks running financial totals in real time. It is updated atomically on every payment, payout, and refund event.

| Field | Meaning |
|---|---|
| `totalCollected` | Total money received from students (all time) |
| `totalReserved` | Money earmarked for instructor payouts (not yet paid) |
| `totalPaidOut` | Total paid to instructors via Stripe transfers |
| `totalRefunded` | Total refunded to clients |
| `totalTaxWithheld` | Total ATO withholding retained by platform |
| `availableBalance` | `totalCollected − totalPaidOut − totalRefunded` (computed on read) |

`availableBalance` is the safe payout ceiling — no payout can exceed it.

**API:** `GET /api/admin/ledger`

```json
{
  "ledger": {
    "totalCollected": 45000.00,
    "totalReserved": 8500.00,
    "totalPaidOut": 32000.00,
    "totalRefunded": 1200.00,
    "totalTaxWithheld": 620.00,
    "availableBalance": 11800.00
  },
  "recentEntries": [...]
}
```

---

## Ledger Entries

Every financial event appends an immutable `LedgerEntry` record. These are never updated after creation — they form the audit trail for reconciliation.

| Type | Trigger |
|---|---|
| `PAYMENT_COLLECTED` | Stripe webhook: payment captured |
| `PAYOUT_PAID` | Instructor payout transferred |
| `TAX_WITHHELD` | ATO withholding recorded on payout |
| `REFUND_ISSUED` | Booking refund processed |
| `ADJUSTMENT` | Post-payout refund deduction |

Recent entries are returned in the `/api/admin/ledger` response.

---

## Date Range Filter

- Presets: Today, This Week, This Month, Last Month, Last 3 Months, Custom
- Custom range: date picker

---

## API Response

`GET /api/admin/revenue?from=&to=&instructorId=&type=`

Returns:
```json
{
  "summary": {
    "totalRevenue": 12500.00,
    "totalPayouts": 10625.00,
    "platformNet": 1875.00,
    "gstCollected": 1136.36,
    "bookingCount": 208
  },
  "transactions": [...],
  "ledger": {
    "totalCollected": 45000.00,
    "totalReserved": 8500.00,
    "totalPaidOut": 32000.00,
    "totalRefunded": 1200.00,
    "totalTaxWithheld": 620.00,
    "availableBalance": 11800.00
  }
}
```

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Processing instructor payouts
- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Financial rules
# Admin Revenue

**Route:** `/admin/revenue`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/revenue/page.tsx`
**API:** `GET /api/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`

---

## Overview

The revenue page is the financial reporting centre. It shows platform commission, gross lesson revenue, instructor payouts, and refunds — all filterable by date range. Every number is derived from `BOOKING_PAYMENT` transactions only. Wallet top-ups and package purchases are excluded from commission calculations.

---

## Date Filter

Six presets:

| Preset | Range |
|--------|-------|
| Today | Current calendar day |
| 7 days | Last 7 days |
| 30 days | Last 30 days |
| This month | 1st of current month to today |
| 3 months | Last 90 days |
| All time | 2020-01-01 to today |

Custom date range also available via date pickers. Changing the range re-fetches all data.

---

## Stats Cards

### Top row — selected period

| Card | Description |
|------|-------------|
| Commission Earned | Platform fee collected on completed lessons in the period |
| Gross Lesson Revenue | Total paid by students for lessons |
| Instructor Payouts | Total paid out to instructors |
| Refunds Issued | Total refunded in the period + refund count |

### Bottom row — all-time context

| Card | Description |
|------|-------------|
| All-Time Commission | Total platform commission ever |
| This Month Commission | Current month vs last month growth rate |
| Pending Payouts | Total awaiting processing — links to `/admin/payouts` |
| Total Refunds (all time) | All-time refund total + count |

---

## Tabs

### Overview

**Monthly commission trend (last 6 months):**
Horizontal bar chart showing gross revenue (light blue) and commission (dark blue) per month. Lesson count shown per row.

**All-time summary:**
Three-column panel: all-time gross, all-time instructor payouts, all-time platform commission.

**Top instructors by payout (selected period):**
Ranked list showing: rank badge, instructor name (links to `/admin/instructors/[id]`), lesson count, gross amount, payout amount, platform fee.

### Transactions

Table of all `BOOKING_PAYMENT` transactions in the selected period.

Columns: Date, Instructor (links to instructor detail), Student, Lesson Fee, Platform Commission, Instructor Payout, Booking Status, Transaction Status.

CSV export available.

### Refunds

Table of all `REFUNDED` transactions in the selected period.

Columns: Date, Instructor, Student, Amount Refunded, Note.

Info banner: "Refunds are processed from the Payouts → Withheld tab."

CSV export available.

### Export

Four CSV export options, all using the currently selected date range:

| Export | Contents |
|--------|---------|
| Lesson Transactions | Date, instructor, student, lesson fee, commission, payout, booking status, txn status |
| Refunds Report | All refunded transactions with notes |
| Monthly Summary | Gross, commission, instructor payout, lesson count per month |
| Instructor Earnings | Gross, commission, payout per instructor |

---

## API

### `GET /api/admin/revenue`

Query params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD).

Response shape:

```json
{
  "rangeCommission": number,
  "rangeGross": number,
  "rangeInstructorPayout": number,
  "rangeLessons": number,
  "rangeRefunds": number,
  "rangeRefundCount": number,
  "totalCommission": number,
  "totalGross": number,
  "totalInstructorPayouts": number,
  "totalCompletedLessons": number,
  "thisMonthCommission": number,
  "lastMonthCommission": number,
  "thisMonthGross": number,
  "pendingPayouts": number,
  "completedPayouts": number,
  "totalRefunds": number,
  "refundCount": number,
  "pendingRefunds": number,
  "totalTransactions": number,
  "topInstructors": [...],
  "revenueByMonth": [...],
  "recentTransactions": [...],
  "refundedTransactions": [...],
  "from": "string",
  "to": "string"
}
```

---

## What "Commission" Means

Commission = `Transaction.platformFee` on `BOOKING_PAYMENT` transactions with `status = COMPLETED`.

It does NOT include:
- Wallet top-up fees
- Package purchase fees
- Subscription revenue (tracked separately)

The commission rate per booking is determined at booking creation time by `lib/services/platform-pricing.ts` based on the instructor's subscription tier and whether it's a new student's first booking.

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Processing instructor payouts
- [REVENUE_REPORTING.md](./REVENUE_REPORTING.md) — Platform ledger and balance
- `docs/06-payments/COMMISSIONS.md` — Commission rate structure
# Admin Reviews

**Route:** `/admin/reviews`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/reviews/page.tsx`  
**Data source:** `Booking` model fields — `clientRating`, `clientReview`, `isReviewed`, `reviewGivenAt`

---

## What It Shows

Stats row:
- Total reviews
- Average rating (⭐)
- 5-star count
- 1–2 star count

Review table (last 100, ordered by `reviewGivenAt DESC`):
- Star rating (★★★★★ visual)
- Student name
- Instructor name
- Review comment (truncated)
- Date submitted

---

## Data Model

Reviews are NOT stored in a separate `Review` model. They are stored directly on the `Booking` record:

| Field | Type | Description |
|-------|------|-------------|
| `clientRating` | `Int?` | 1–5 star rating |
| `clientReview` | `String?` | Written comment |
| `isReviewed` | `Boolean` | Set to `true` after submission |
| `reviewGivenAt` | `DateTime?` | Timestamp of submission |

The page queries `Booking` where `isReviewed = true` and `clientRating != null`.

---

## Moderation

Reviews are currently read-only in the admin. There is no hide/flag/delete action in the UI.

The `Instructor.averageRating` and `Instructor.totalReviews` fields are recalculated automatically when a student submits a review via `POST /api/reviews`.

---

## Related

- [INSTRUCTOR_APPROVALS.md](./INSTRUCTOR_APPROVALS.md) — Instructor profile shows review count and average rating
- `app/api/reviews/route.ts` — Student review submission
- `app/api/client/pending-reviews/route.ts` — Pending reviews for students
# Admin Settings

**Routes:** `/admin/settings`, `/admin/pricing`  
**Auth required:** ADMIN or SUPER_ADMIN  
**Files:** `app/admin/settings/page.tsx`, `app/admin/pricing/page.tsx`  
**APIs:** `GET/POST /api/admin/settings`, `GET/POST /api/admin/pricing`

---

## Platform Settings (`/admin/settings`)

General platform configuration stored in `PlatformSettings` (singleton DB record).

**File:** `components/admin/PlatformSettingsForm.tsx`

Settings include:
- Platform name
- Admin email
- Support contact details
- Booking window (min advance hours, max advance days)
- Notification preferences

---

## Pricing Settings (`/admin/pricing`)

Commission rates and financial configuration. All values persist to the `PlatformSettings` DB record and take effect immediately on new bookings.

**File:** `components/admin/PricingSettingsForm.tsx`

### Commission Rates (per tier)

| Field | Default | Description |
|-------|---------|-------------|
| `basicCommissionRate` | 15% | Platform commission for BASIC tier |
| `proCommissionRate` | 12% | Platform commission for PRO tier |
| `businessCommissionRate` | 10% | Platform commission for BUSINESS tier |

### New Student Bonus (per tier)

| Field | Default | Description |
|-------|---------|-------------|
| `basicNewStudentBonus` | 8% | Commission on first booking (BASIC) |
| `proNewStudentBonus` | 10% | Commission on first booking (PRO) |
| `businessNewStudentBonus` | 12% | Commission on first booking (BUSINESS) |

### Package Discounts

| Field | Default | Description |
|-------|---------|-------------|
| `package6Discount` | 5% | Discount for 6-hour package |
| `package10Discount` | 10% | Discount for 10-hour package |
| `package15Discount` | 12% | Discount for 15-hour package |
| `discountPaidBy` | shared | Who absorbs the discount: `platform`, `instructor`, or `shared` |

### Other Fees

| Field | Default | Description |
|-------|---------|-------------|
| `platformFeePercentage` | 3.6% | Additional platform fee on top of commission |
| `drivingTestPackagePrice` | $225 | Fixed price for driving test package |
| `cancellationFee` | $0 | Fixed fee charged on cancellation |
| `lateCancellationWindowHours` | 24h | Hours before lesson that triggers late cancellation |
| `noShowPenaltyAmount` | $0 | Penalty for no-show |

### Wallet Limits

| Field | Default |
|-------|---------|
| `walletTopUpMin` | $10 |
| `walletTopUpMax` | $500 |

### GST

| Field | Default |
|-------|---------|
| `gstEnabled` | true |
| `gstRate` | 10% |

### Peak Surcharge

| Field | Default |
|-------|---------|
| `peakSurchargeEnabled` | false |
| `peakSurchargePercent` | 0% |

---

## How Changes Take Effect

Changes saved via `POST /api/admin/pricing` are upserted to the `PlatformSettings` singleton record. The next payment intent creation reads the new rates via `lib/services/platform-pricing.ts`. Existing bookings are not retroactively affected.

---

## Related

- `docs/06-payments/COMMISSIONS.md` — Commission rate details
- `lib/services/platform-pricing.ts` — How rates are read at runtime
- `docs/01-architecture/DATABASE_SCHEMA.md` — PlatformSettings model
# Staff Governance

**Route:** `/admin/staff-governance`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/staff-governance/page.tsx`  
**API:** `GET /api/admin/staff-governance/stats`

---

## Purpose

The Staff Governance dashboard provides a high-level operational control view for platform owners and senior admins. It surfaces:

- Tasks requiring supervisor approval
- SLA breaches and escalations
- Financial monitoring (refund rates)
- Performance metrics (resolution time, workload balance)
- Status of all active governance controls

This is a monitoring and oversight page — it does not directly manage staff or tasks, but links out to the relevant tools.

---

## Stats Sections

### Critical Alerts

| Metric | Alert Threshold | Color |
|--------|----------------|-------|
| Tasks Requiring Approval | > 0 → orange | Orange / Green |
| SLA Breaches | > 0 → red | Red / Green |
| Escalations | Always shown | Purple |

### Financial Monitoring

| Metric | Notes |
|--------|-------|
| Total Refunds (All Time) | Cumulative refund value |
| Refunds This Week | Rolling 7-day refund total |
| % of Revenue Refunded | Flags red if > 10% |

A refund rate above 10% triggers a visible warning: "⚠️ Above 10% threshold".

### Performance Metrics

| Metric | Alert Threshold |
|--------|----------------|
| Avg Resolution Time (hours) | Displayed as-is |
| Tasks Reopened | > 5 → red |
| Workload Balance | `Imbalanced` → orange, `Balanced` → green |

---

## Governance Controls Status

Displays the live status of five platform controls. All are expected to show `Active`:

| Control | Description |
|---------|-------------|
| Financial Control Separation | Approval thresholds enforced for financial actions |
| Task Closure Control | Resolution and audit requirements enforced before closing tasks |
| Automated Refund Calculation | Refunds are system-calculated, not manually entered |
| Permission Matrix | Role-based access control (RBAC) enforced across all routes |
| SLA Enforcement | Automatic escalation enabled for overdue tasks |

These are static status indicators — they reflect system design, not live checks. If a control shows `Inactive`, it indicates a configuration or deployment issue.

---

## Actions

- View Staff Dashboard — navigates to `/staff/dashboard`
- View Audit Logs — navigates to `/admin/audit-logs`
- Refresh Data — re-fetches governance stats

---

## Notes

- The `/api/admin/staff-governance/stats` endpoint aggregates data from pending instructor approvals, disputes, refund totals, failed/stuck payouts, and expired documents. It returns real DB counts — not placeholder data.
- This page is intended for SUPER_ADMIN and platform owner use. Regular ADMIN users may have read-only access depending on role configuration.

---

## Related

- [AUDIT_LOG.md](./AUDIT_LOG.md) — Full action history
- [SUPPORT.md](./SUPPORT.md) — Support task management
- [PAYOUTS.md](./PAYOUTS.md) — Financial controls for payouts
# Admin Support

**Route:** `/admin/support`
**Auth required:** ADMIN or SUPER_ADMIN
**File:** `app/admin/support/page.tsx`

---

## Overview

A static reference page for admin operators. No dynamic data — it's a quick-access hub with links to other admin sections and a summary of common operational tasks.

---

## Quick Actions

| Link | Destination | Purpose |
|------|-------------|---------|
| Review Pending Instructors | `/admin/instructors?status=pending` | Approve or reject new applications |
| View All Bookings | `/admin/bookings` | Monitor platform activity |
| Manage Reviews | `/admin/reviews` | Moderate flagged content |
| Platform Settings | `/admin/settings` | Configure pricing and features |

---

## Common Admin Tasks (reference)

### Approving new instructors
1. Go to Instructors → Pending tab
2. Review profile and documents
3. Click Approve or Reject with reason
4. Instructor receives email notification

### Managing subscriptions
- View subscription stats on the Overview (Dashboard) page
- Monitor trial users and past-due accounts
- PRO: $29/mo, 12% commission
- BUSINESS: $59/mo, 7% commission

### Handling support issues
1. Check bookings for cancellations or disputes
2. Review flagged reviews for inappropriate content
3. Contact instructors via their profile page
4. Suspend accounts via `/admin/instructors/[id]` if needed

### Revenue monitoring
- Monthly subscription revenue on Dashboard
- Commission tracked per booking
- Detailed breakdown at `/admin/revenue`

---

## Note

This page is a static operator reference. It does not have a backend API. For live support tooling (ticket system, chat, etc.), that would need to be built separately.
