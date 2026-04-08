# Failure Handling

How the system detects, surfaces, and recovers from failures.

---

## Stripe Failures

### Payment Intent Fails

- Stripe does not fire `payment_intent.succeeded`
- Booking stays in `PENDING_PAYMENT`
- Slot hold expires after 10 minutes → booking → `EXPIRED`
- Client must retry

### Webhook Not Received

- Booking stays in `PENDING_PAYMENT` indefinitely
- Daily reconciliation cron detects: completed booking with no transaction
- Alert email sent to admin
- Admin manually confirms payment via Stripe Dashboard and creates adjustment transaction

### Stripe Chargeback / Dispute

- Stripe fires `charge.dispute.created` webhook
- Payout placed on hold automatically
- Admin investigates via `/admin/payouts` and `/admin/audit-log`
- Resolved via `resolve` or `resolve-split` endpoint
- AuditLog: `DISPUTE_RESOLVED`

---

## Payout Failures

### Transfer Fails

- Payout status → `FAILED`
- Alert email sent via `alert-service`
- Admin retries manually from `/admin/payouts`
- AuditLog: `PAYOUT_FAILED`

### Payout Stuck in PROCESSING

- Reconciliation cron detects payouts in `PROCESSING` for >10 minutes (not 24h — the threshold is `STUCK_THRESHOLD_MINUTES = 10` in `reconcile-stripe/route.ts`)
- Creates `ReconciliationReport` entry with issue
- Alert email sent
- Admin investigates and either retries or marks as failed

### Withholding Applied Incorrectly

- If `withholdingTaxRate` is wrong at payout time, payout-service logs a warning
- Admin can correct via `verify-abn` endpoint to reset the rate
- Adjustment transaction created for the difference

---

## ABN Failures

### ABR API Unavailable

- ABN validation falls back to format-only check
- `abnStatus` set to `REVIEW_REQUIRED`
- Admin manually verifies via `POST /api/admin/instructors/[id]/verify-abn`

### ABN Cancelled After Verification

- Weekly `recheck-abn` cron (Mondays 2am AEST) detects cancellation
- `abnVerified: false`, `withholdingTaxRate: 47` set automatically
- Alert email sent: `ABN_VERIFICATION_REVOKED`
- AuditLog: `ABN_VERIFICATION_REVOKED`
- Admin notified to contact instructor

---

## Booking Edge Cases

### Lesson Completed but Not Marked

- Transaction stays in `COMPLETED` (instructor wallet path) or `SETTLED` (Stripe path)
- Not payout-eligible until admin marks booking `COMPLETED`
- No automated resolution — admin action required

### Duplicate Booking Attempt

- Slot availability checked at booking creation — both outside (fast rejection) and inside the `$transaction` (definitive, prevents TOCTOU race)
- Concurrent requests: the in-transaction check ensures only one succeeds
- Second request receives 409 Conflict

### Reschedule After Payment

- New slot checked for availability
- Booking updated, original transaction retained
- No new payment unless price changes (adjustment transaction created)

---

## Wallet Failures

### Balance Mismatch Detected

- Daily reconciliation compares `ClientWallet.balance` vs sum of `WalletTransaction`
- Alert email sent on mismatch
- Admin creates `MANUAL_ADJUSTMENT` transaction to correct
- AuditLog: `MANUAL_RECONCILIATION`

### Insufficient Balance at Booking

- `assertNonNegativeBalance()` throws before debit
- Booking creation fails with 400
- Client prompted to top up wallet

### Wallet Top-Up Stripe Failure

- If Stripe intent creation fails, the PENDING `WalletTransaction` is deleted immediately
- No orphaned PENDING records accumulate
- Client sees an error and can retry

---

## Cron Job Failures

### Cron Does Not Run

- Vercel cron schedule defined in `vercel.json`
- If cron misses, no automatic retry — admin can trigger manually via direct API call with `CRON_SECRET` header
- Missing runs are visible as gaps in `ReconciliationReport` records

### Cron Runs Twice (Race Condition)

- Concurrency lock checked at start of each cron
- Second invocation exits immediately if lock is held
- Lock released on completion or error

---

## Alert Channels

All alerts go to the admin email configured in `PlatformSettings.adminEmail` via `alert-service.ts`.

| Alert Type | Trigger |
|------------|---------|
| `PAYOUT_FAILED` | Payout transfer fails |
| `ABN_VERIFICATION_REVOKED` | ABN cancelled on recheck |
| `RECONCILIATION_ISSUE` | Any reconciliation check fails |
| `NEGATIVE_BALANCE` | Wallet balance goes negative |

Alerts are throttled to 1 per hour per alert type to prevent email flooding.

---

## Manual Recovery Procedures

### Stuck Payout

1. Check `/admin/payouts` for payout status
2. Check `/admin/audit-log` for `PAYOUT_FAILED` entries
3. Verify Stripe Dashboard for transfer status
4. If Stripe transfer succeeded but DB not updated: create adjustment + audit entry
5. If Stripe transfer failed: retry from admin UI

### Missing Transaction

1. Check `/admin/audit-log` for booking events
2. Check Stripe Dashboard for payment intent status
3. If payment succeeded: create `BOOKING_PAYMENT` transaction manually via admin
4. AuditLog: `MANUAL_RECONCILIATION` with explanation

### Negative Wallet Balance

1. Check `/admin/clients/[id]` for wallet transaction history
2. Identify the transaction that caused the negative balance
3. Determine if it's a refund dispute or admin error
4. Create `MANUAL_ADJUSTMENT` to correct
5. AuditLog: `WALLET_ADJUSTED`

---

## Related

- [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) — What the system prevents
- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — Normal flow paths
- `docs/05-admin/AUDIT_LOG.md` — How to investigate failures
- `docs/05-admin/PAYOUTS.md` — Payout retry and dispute resolution
