# Admin Payouts

**Route:** `/admin/payouts`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/payouts/page.tsx`  
**APIs:** `GET /api/admin/payouts`, `POST /api/admin/payouts/process`, `POST /api/admin/payouts/process-all`, `POST /api/admin/payouts/resolve`, `POST /api/admin/payouts/resolve-split`, `POST /api/admin/payouts/[payoutId]/hold`, `POST /api/admin/payouts/[payoutId]/mark-sent`  
**Last updated:** 2026-07-22

---

## Purpose

The Payouts page is the primary admin tool for paying instructors. It shows all eligible earnings, withheld transactions, disputes, and manual bank transfer queues in one place.

---

## Tabs

### Eligible

Shows instructors with SETTLED transactions past the dispute buffer (default 48h after lesson end), not yet in an active payout.

- Each row: name, phone, transaction count, total amount, expandable per-lesson breakdown
- "Pay" → `POST /api/admin/payouts/process` for that instructor
- "Process All Eligible" button → `POST /api/admin/payouts/process-all` (runs for all eligible at once; has `payoutHold` and ABN checks)
- Stripe Connect instructors: money transfers immediately → `PAID`
- Bank/manual instructors: moves to `PENDING_TRANSFER` → appears in Manual Transfers tab

### Manual Transfers

For instructors using bank transfer (not Stripe Connect). **These are NOT processed by the automated weekly cron** — admin must manually review this tab every Tuesday.

**Pending Transfer** — payout approved, awaiting admin to physically transfer funds:
- Shows masked BSB + account (`****XXX`), account name, net/gross/tax withheld
- "Mark Sent" → modal requires bank transaction reference → payout moves to `SENT`
- "Hold" → `POST /api/admin/payouts/[payoutId]/hold` → moves to `ON_HOLD`

**Sent — Awaiting Confirmation** — bank reference recorded, waiting for instructor to receive:
- "Confirm Received" → `POST /api/admin/payouts/[payoutId]/mark-sent` with `{ action: "confirm" }` → moves to `PAID`, **updates ledger** (for bank transfers, ledger is only updated at confirmation, not at the send step)

> ⚠️ The displayed bank account is masked to `****XXX`. To get the full BSB/account for the transfer, navigate to `/admin/instructors/[id]` → Overview tab → Payout Method section.

### Withheld

Transactions that cannot be paid — no-shows and cancellations where the booking has a SETTLED transaction but the booking status is `CANCELLED` or `NO_SHOW`.

Each case card shows:
- No-show party badge (Instructor no-show / Client no-show / Disputed — based on `booking.noShowParty`)
- Client + instructor contact details, pickup address, notes
- Money breakdown (lesson price, platform fee, instructor payout)
- "Resolve this case" → Resolve Modal

### Disputes

Transactions where `booking.noShowParty = 'both'` — both parties claim the other didn't attend. Requires manual investigation before resolving.

---

## Resolve Modal

5 resolution actions (all write to AuditLog):

| Action | Effect |
|---|---|
| `refund_client` | Returns `txn.amount` to client wallet as REFUND; marks transaction REFUNDED; ledger entry |
| `approve_for_payout` | Marks transaction SETTLED; enters next eligible payout run |
| `split` | Partial refund + partial payout (atomic) → `POST /api/admin/payouts/resolve-split` |
| `charge_instructor` | Marks CANCELLED; writes negative ADJUSTMENT ledger entry; recovered from next payout |
| `void` | Marks CANCELLED; no money moves; transaction closed |

The modal also shows the recommended action based on `noShowParty` (e.g., instructor no-show → suggest refund_client).

---

## Payout State Machine

```
Stripe Connect:
  ELIGIBLE → PROCESSING → PAID
                       └→ FAILED  (retryCount++, CRITICAL alert)

Bank / Manual:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER
                              ↓ admin Mark Sent
                           SENT  (bank ref recorded)
                              ↓ admin Confirm Received
                           PAID  (ledger updated here — NOT at PENDING_TRANSFER)

Any ELIGIBLE or FAILED state:
  → ON_HOLD  (admin hold; holdReason set)
  → ELIGIBLE (release — must be done manually, no button currently in UI)
```

---

## Hold / Release

Place a payout on hold:
```
POST /api/admin/payouts/[payoutId]/hold
```
Works on payouts in ELIGIBLE, PENDING_TRANSFER, or FAILED state. Sets `ON_HOLD`, writes `holdReason`, audit-logged.

To release: no UI button exists yet — call `POST /api/admin/payouts/process` with `{ instructorId }` (this calls `buildPayout` which creates a new ELIGIBLE payout from remaining SETTLED transactions). Alternatively, for admin console use the Resolve actions.

---

## Dispute Buffer

Transactions are only eligible after `PlatformSettings.lateCancellationWindowHours × 2` hours past lesson end (default 48h). This is configurable via `/admin/pricing`. Both the weekly cron and manual "Process" / "Process All" respect this DB-backed value.

---

## Payout Amount

```
grossAmount  = Σ transaction.instructorPayout (eligible transactions)
               − any unrecovered ADJUSTMENT ledger entries (post-payout clawbacks)
taxWithheld  = grossAfterAdj × instructor.withholdingTaxRate%
netAmount    = grossAfterAdj − taxWithheld
```

---

## Failed Payouts

- Appear in the summary stats bar (failed count)
- No dedicated retry tab — call `POST /api/admin/payouts/process` with `{ instructorId }` to retry
- `retryCount` increments on each failure
- CRITICAL alert fires automatically when a payout fails

---

## Post-Payout Clawback

If a refund is issued after an instructor has already been paid for that booking:
1. Negative ADJUSTMENT ledger entry is created
2. Next time `buildPayout()` runs for that instructor, the adjustment is deducted from gross
3. Instructor receives an email listing the deductions
4. ADJUSTMENT marked `recovered` — never double-deducted

---

## Related

- `docs/operations/02-finance.md` — full operational guide including manual transfer weekly workflow
- [DISPUTES.md](./DISPUTES.md) — dispute resolution workflow
- [REVENUE.md](./REVENUE.md) — revenue reporting
- [AUDIT_LOG.md](./AUDIT_LOG.md) — all payout events logged here
