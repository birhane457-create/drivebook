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
| `id` | MongoDB ObjectId — monotonically increasing, used for cursor pagination |
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
- Cursor is the `id` of the last entry on the current page (MongoDB ObjectId).
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

The `AuditLog` collection should have the following indexes for acceptable query performance at scale:

```
{ createdAt: -1 }
{ targetType: 1, createdAt: -1 }
{ actorId: 1, createdAt: -1 }
{ action: 1, createdAt: -1 }
```

These are not yet defined in `schema.prisma` (MongoDB with Prisma does not require explicit index declarations for basic queries, but they should be added via the MongoDB Atlas UI or a migration script before the collection exceeds ~100k entries).

---

## Related

- [PAYOUTS.md](./PAYOUTS.md) — Payout state machine and audit trail reference
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution actions and `resolutionGroupId`
- `lib/services/payout-service.ts` — `logTransition()` helper that writes payout audit entries
- `app/api/admin/audit-log/route.ts` — API implementation
- `app/admin/audit-log/page.tsx` — UI implementation
