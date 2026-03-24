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
