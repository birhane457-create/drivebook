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
