# 02 — Finance & Payments

> Source of thresholds: `lib/config/governance.ts`  
> Source of configurable values: `PlatformSettings` DB table  
> Last updated: 2026-07-22

---

## Payouts

**Admin page:** `/admin/payouts`  
**Automated cron:** Every Monday 6pm UTC = Tuesday 2am AWST (`cron/weekly-payouts`)  
**Auth:** Bearer `CRON_SECRET`

### Payout state machine

```
Stripe Connect:
  ELIGIBLE → PROCESSING → PAID
                       └→ FAILED  (retryCount++, CRITICAL alert)

Bank / Manual:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER
                              ↓ admin records bank ref
                           SENT
                              ↓ admin confirms receipt
                           PAID  (ledger updated here)

Any ELIGIBLE or FAILED state:
  → ON_HOLD  (admin freezes; holdReason set)
  → ELIGIBLE (admin releases)
```

### Admin payouts page — four tabs

| Tab | What it shows | Key actions |
|---|---|---|
| **Eligible** | SETTLED transactions past dispute buffer, not yet in a payout, grouped by instructor | "Pay" (individual) or "Process All Eligible" button |
| **Manual Transfers** | PENDING_TRANSFER payouts (awaiting bank send) + SENT (awaiting confirmation) | "Mark Sent" modal (enter bank ref) → "Confirm Received" (updates ledger) |
| **Withheld** | CANCELLED/NO_SHOW bookings with SETTLED transactions | "Resolve" modal — 5 resolution actions |
| **Disputes** | NO_SHOW bookings where `noShowParty = 'both'` | Same Resolve modal |

### Resolve modal — 5 actions

| Action | Effect |
|---|---|
| `refund_client` | Refunds full `txn.amount` to client wallet; marks REFUNDED; writes audit log + ledger |
| `approve_for_payout` | Marks transaction SETTLED; enters next eligible payout run |
| `split` | Partial refund to client AND partial payout to instructor (atomic) |
| `charge_instructor` | Marks CANCELLED; writes negative ADJUSTMENT ledger entry (recovered from next payout) |
| `void` | Marks CANCELLED; no money moves; writes audit log |

### Eligibility (system enforces automatically):

- `Transaction.status = 'SETTLED'` and `type = 'BOOKING_PAYMENT'`
- `Booking.status IN ('CONFIRMED', 'COMPLETED')` and `endTime <= bufferCutoff`
- Buffer = `PlatformSettings.lateCancellationWindowHours × 2` (default 48h, DB-backed)
- `instructor.payoutHold = false` — no open dispute freeze
- ABN verified (or no ABN — 47% withholding applies)
- Offline bookings excluded (`source ≠ 'offline'`)
- Not already covered by PROCESSING/PAID/ON_HOLD/PENDING_TRANSFER/SENT payout

### Payout amount calculation:

```
grossAmount         = Σ transaction.instructorPayout (eligible transactions)
adjustmentDeduction = Σ unrecovered ADJUSTMENT ledger entries (post-payout clawbacks)
grossAfterAdj       = max(0, gross - adjustmentDeductions)
taxWithheld         = grossAfterAdj × (instructor.withholdingTaxRate / 100)
netAmount           = grossAfterAdj - taxWithheld
```

### Before triggering a manual payout:

- [ ] Check automated run log first — avoid double-payment (idempotency key prevents it at DB level, but avoids confusion)
- [ ] Confirm Stripe Connect onboarding complete (`chargesEnabled = true`, `payoutsEnabled = true`)
- [ ] Check `payoutHold` — **never override a payout hold without dispute resolution**
- [ ] Verify ABN status if payout > $0
- [ ] Check approval threshold:

| Amount | Who |
|---|---|
| ≤ $200 | ADMIN |
| $200 – $1,000 | SUPERVISOR or ADMIN |
| > $1,000 | SUPER_ADMIN only |

> **Note:** These thresholds are policy — they are NOT enforced in the API code. Admin role check is the only code gate. SUPER_ADMIN approval for large payouts is an operational requirement, not a technical one.

### `PAYOUT_BATCH_SIZE` env var

Default: 20. The weekly cron processes at most this many instructors per invocation (Vercel 60s timeout protection). If the platform has >20 instructors with eligible transactions, excess are deferred to the next weekly run (not lost). A WARNING alert fires when deferral occurs. Increase `PAYOUT_BATCH_SIZE` as the platform grows.

### Failed payouts

When a payout reaches `FAILED` status:
- `retryCount` is incremented on the `Payout` record
- A CRITICAL alert fires to ops team
- The payout stays in `FAILED` state — admin must review and retry manually from `/admin/payouts`
- No automatic retry currently exists

### Do NOT:

- Trigger payout for instructor with `payoutHold = true`
- Process bank transfer payouts via Stripe route — bank transfer instructors go to Manual tab
- Pay same instructor twice in one week without checking cron run log
- Modify `payoutsEnabled` / `chargesEnabled` directly — set by Stripe webhook
- Mark a bank transfer as "Confirmed Received" unless money has actually moved — this is the ledger update event

---

## Refunds

### Automatic tiers (DB-configured via `PlatformSettings.lateCancellationWindowHours`):

| Notice | Refund |
|---|---|
| ≥ 2× `lateCancellationWindowHours` | 100% to wallet |
| 1× to 2× window | 50% to wallet |
| < 1× window | 0% |
| PENDING_PAYMENT (unpaid) | 0% — slot released, no money moved |

### Manual override thresholds:

| Override amount | Who |
|---|---|
| ≤ $50 goodwill | ADMIN |
| ≤ $100 | ADMIN |
| $100 – $500 | SUPERVISOR or SUPER_ADMIN |
| > $500 | SUPER_ADMIN only |

Monthly override cap: **$200 per staff member per month**. Justification required (≥ 20 chars).

### Post-payout refund clawback:

If a refund is issued after the instructor has already been paid for that booking:
1. A negative `ADJUSTMENT` ledger entry is created for the instructor
2. On the next payout run, `buildPayout()` automatically deducts unrecovered adjustments from gross
3. Instructor receives an email detailing the deduction
4. The ADJUSTMENT entry is marked `recovered = true` — never double-deducted

### Do NOT:

- Issue refund by directly editing `ClientWallet.balance` — use the refund API (ledger integrity)
- Issue refund on already-refunded booking — check `refundedAt` first
- Override $0 refund (under-window cancellation) without SUPER_ADMIN approval
- Issue refund while `payoutHold = true` — resolve dispute first

---

## Pricing Changes

### Commission rate changes:

- Prospective only — never retroactive. Existing confirmed bookings keep the rate locked at booking creation.
- Notify instructors at least 7 days before any increase
- **SUPER_ADMIN approval required**
- Document reason in audit log
- All four tier rates (Basic/Pro/Studio/Business) are configurable via `/admin/pricing`

### Platform fee changes:

- Affects student-facing prices immediately at booking time
- Test `/admin/pricing` preview after change
- **SUPER_ADMIN approval required**

### Cancellation window (`lateCancellationWindowHours`) changes:

- Controls BOTH refund tier thresholds AND the dispute buffer for payout eligibility
- Changing it affects: cancel routes, cancellation-policy API, weekly-payouts cron, `buildPayout()`, CancelDialog UI
- Announce to instructors and students before changing

### Do NOT:

- Change `PlatformSettings` directly in DB — use `/admin/pricing` so change is logged
- Apply new rate to already-paid bookings

---

## Financial Reconciliation

### Daily (automated — `cron/reconcile-stripe`, 3am AWST):

- Check Stripe succeeded payments vs DB ledger entries
- Detect missing transfers for PAID payouts
- Flag stuck payouts (PROCESSING > 10 min)
- Auto-confirm clear-cut missed webhooks
- Backfill FinancialLedger gaps

**Admin action when reconciliation flags issues:**
- Review `/admin/reconciliation` report
- For `missingPayments`: verify booking status, check Stripe dashboard
- For `stuckPayouts`: check Stripe transfer status; resolve manually if needed
- For `missingTransfers`: verify with Stripe; do NOT double-pay (idempotency key prevents it at API level)

### Weekly (automated — every Tuesday):

- Payout cron processes all eligible Stripe Connect instructors (batch cap applies)
- Review payout summary for failures in cron log / CRITICAL alerts
- Bank/manual transfer instructors are NOT automatically processed — admin must check Manual tab weekly

### Monthly (manual):

- [ ] Total platform revenue vs Stripe dashboard balance
- [ ] Total wallet credits issued vs wallet transactions
- [ ] Refund rate vs revenue (flag if > 10%)
- [ ] Failed payout count and reasons — check if any are stuck in FAILED
- [ ] Open disputes count and amounts

### Annual:

- [ ] Full ledger audit
- [ ] ABN withholding summary for ATO
- [ ] GST reconciliation
- [ ] Audit log archival verification

---

## Wallet Adjustments

| Amount | Who |
|---|---|
| ≤ $50 | ADMIN |
| $50 – $200 | SUPERVISOR |
| > $200 | SUPER_ADMIN |

**Do NOT** add wallet credit by editing `ClientWallet.balance` directly — always use the wallet transaction API (ledger consistency).
