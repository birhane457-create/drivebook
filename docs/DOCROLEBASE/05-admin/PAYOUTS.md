# Admin Payouts

**Route:** `/admin/payouts`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/payouts/page.tsx`  
**APIs:** `GET /api/admin/payouts`, `POST /api/admin/payouts/process`, `POST /api/admin/payouts/process-all`, `POST /api/admin/payouts/resolve`, `POST /api/admin/payouts/resolve-split`, `POST /api/admin/payouts/[payoutId]/hold`, `POST /api/admin/payouts/[payoutId]/mark-sent`

---

## Purpose

The Payouts page is the primary tool for admin to pay instructors. It surfaces all eligible earnings, withheld transactions, disputes, and manual bank transfer queues in one place.

---

## Tabs

### Eligible

Shows all instructors with settled, payout-eligible transactions (24h+ after lesson end, no open disputes).

Each instructor row shows:
- Name, phone, transaction count
- Total payout amount
- "Pay" button → calls `POST /api/admin/payouts/process` for that instructor
- Expand → shows individual lesson breakdown (client, date, lesson price, platform fee, instructor payout)

**Process All Eligible** button at the top processes all eligible instructors in one call (`POST /api/admin/payouts/process-all`).

### Manual Transfers

For instructors using bank transfer (not Stripe Connect). Two sub-sections:

**Pending Transfer** — payout approved, awaiting admin to physically transfer funds:
- Shows BSB, account number, account name
- "Mark Sent" button → opens modal to enter bank transaction reference → moves payout to `SENT`
- "Hold" button → calls `POST /api/admin/payouts/[payoutId]/hold` → moves payout to `ON_HOLD`

**Sent — Awaiting Confirmation** — bank reference recorded, waiting for instructor to confirm receipt:
- Shows bank reference, sent date
- "Confirm Received" button → moves payout to `PAID`, updates ledger

### Withheld

Transactions that cannot be paid yet — no-shows and cancellations where the resolution is unclear.

Each case card shows:
- Booking details (client, instructor, date, time, pickup address)
- No-show party badge (Instructor no-show / Client no-show / Disputed)
- Money breakdown (lesson price, platform fee, instructor payout)
- "Resolve this case" button → opens Resolve Modal

### Disputes

Transactions with `noShowParty = 'both'` — both parties claim the other didn't show. Requires manual investigation.

Same card format as Withheld. Resolve Modal has the same options.

---

## Resolve Modal

Opened from Withheld or Disputes tabs. Shows full booking context (client + instructor contact details, date/time, pickup address, notes, money breakdown) and a recommended resolution based on the no-show party.

**Resolution options:**

| Action | Effect |
|--------|--------|
| Refund Client | Returns lesson price to client wallet |
| Approve for Payout | Marks instructor payout as eligible |
| Split Resolution | Partial refund to client + partial payout to instructor (atomic) |
| Charge Instructor Penalty | Deducts from instructor's next payout |
| Void Transaction | No money moves — write off |

All resolutions are logged to AuditLog with `action: DISPUTE_RESOLVED`.

---

## Hold / Release

Admin can place any `PENDING_TRANSFER` or `ELIGIBLE` payout on hold:

```
POST /api/admin/payouts/[payoutId]/hold   → ON_HOLD
```

To release, the payout must be manually moved back to `ELIGIBLE` via the resolve flow or a future release endpoint.

Every hold is logged to AuditLog with `action: PAYOUT_HELD`.

---

## Financial Mechanics

See `docs/DOCROLEBASE/06-payments/PAYOUTS.md` for the full financial mechanics:
- Eligibility rules
- Amount calculation (gross, tax withheld, net)
- Platform balance check before Stripe transfers
- Idempotency key (prevents duplicate transfers)
- Ledger integration (when ledger is updated for each payout type)
- Two-phase processing (build → execute)

---

## Related

- `docs/DOCROLEBASE/06-payments/PAYOUTS.md` — Financial mechanics, state machine, ledger integration
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution workflow
- [REVENUE.md](./REVENUE.md) — Revenue reporting
- [AUDIT_LOG.md](./AUDIT_LOG.md) — All payout events logged here
