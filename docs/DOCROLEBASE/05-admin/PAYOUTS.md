# Admin Payouts

**Route:** `/admin/payouts`  
**Auth required:** ADMIN or SUPER_ADMIN  
**File:** `app/admin/payouts/page.tsx`  
**APIs:**
- `GET /api/admin/payouts` — list payouts (includes pendingTransferPayouts + sentPayouts)
- `POST /api/admin/payouts/process` — process single payout
- `POST /api/admin/payouts/process-all` — process all eligible
- `POST /api/admin/payouts/resolve` — resolve dispute (single action)
- `POST /api/admin/payouts/resolve-split` — atomic split resolution (refund + approve in one operation)
- `POST /api/admin/payouts/[payoutId]/hold` — place on hold
- `DELETE /api/admin/payouts/[payoutId]/hold` — release hold
- `POST /api/admin/payouts/[payoutId]/mark-sent` — mark bank transfer sent or confirm receipt

---

## Overview

The payouts page manages instructor payouts for completed lessons. Payouts are held for 24 hours after lesson completion before becoming eligible. The two-phase system (`buildPayout` + `executePayout`) ensures no duplicate Stripe transfers and no overpayment of the platform balance.

**Payout method split:** Stripe Connect payouts execute immediately and are marked `PAID` once the Stripe transfer confirms. Bank transfer and manual payouts enter a manual queue (`PENDING_TRANSFER`) — the admin must physically transfer funds, record the bank reference, and confirm receipt before the payout is marked `PAID` and the ledger is updated. This enforces the invariant: **a payout is never marked PAID unless money has actually moved.**

**ABN Verification Gate:** An instructor's payout is blocked unless their ABN is verified (`abnVerified = true`). This applies to both single and bulk payout processing. Instructors with an unverified or missing ABN are skipped in bulk runs and blocked in single-payout calls. Admin must verify the ABN at `/admin/instructors/[id]` before the payout can proceed.

**Bank Transfer Risk:** For instructors using `bank_transfer`, BSB and account number are validated for format only — there is no Australian API to verify bank account ownership. Admin must manually confirm bank details before processing the first bank transfer payout. Stripe Connect is strongly recommended for scale as Stripe handles identity and bank account verification.

**ABN Edge Case — Unchanged Fields:** The payout settings route only recalculates `withholdingTaxRate` when the `abn` field itself changes. Saving other fields (e.g. bank details, payout method) without touching the ABN field preserves the existing `withholdingTaxRate` and `abnVerified` state. This prevents accidental withholding resets when instructors update unrelated settings.

---

## ABN Verification — What "Verified" Means

ABN verification is a two-step process:

1. Instructor submits their ABN at `/dashboard/settings/payout`
2. The ABN is checked against the ABR (Australian Business Register) API via `POST /api/abn/verify`

An ABN is considered verified (`abnVerified = true`) only when:
- The ABR API returns `abnStatus: ACTIVE`, AND
- The entity name from ABR matches the instructor's name at a similarity score ≥ 0.8 (Jaccard), OR
- An admin manually marks it verified via `POST /api/admin/instructors/[id]/verify-abn`

Name match outcomes:
- Score ≥ 0.8 → `MATCHED` — auto-approved
- Score 0.5–0.79 → `REVIEW_REQUIRED` — admin must confirm before payouts are enabled
- Score < 0.5 → `NO_MATCH` — admin review required

`abnStatus` values:
- `PENDING` — submitted, not yet checked
- `ACTIVE` — confirmed active by ABR
- `CANCELLED` — ABN is cancelled per ABR records; payout blocked
- `REVIEW_REQUIRED` — ABR returned a mismatch; admin must manually verify

If an ABN becomes invalid after verification, the weekly cron (`GET /api/cron/recheck-abn`) detects it automatically: clears `abnVerified`, sets `abnStatus = CANCELLED`, reverts `withholdingTaxRate` to 47%, and logs `ABN_VERIFICATION_REVOKED` to `AuditLog`. This blocks the next payout run without any manual intervention.

---

## Eligibility Criteria

A transaction is eligible for payout when ALL of the following are true:

1. `transaction.status = SETTLED` — set by Stripe webhook on payment success
2. `transaction.type = BOOKING_PAYMENT`
3. `booking.status` is `CONFIRMED` or `COMPLETED`
4. `booking.endTime` is more than 24 hours ago (payout buffer)
5. `booking.deletedAt` is null
6. The transaction is NOT already linked to a `PROCESSING`, `PAID`, `ON_HOLD`, `PENDING_TRANSFER`, or `SENT` payout via `PayoutTransaction`
7. The instructor's ABN is verified (`abnVerified = true`) — or no ABN is on file (47% withholding applies)

Point 6 is enforced by `buildPayout()` which queries `PayoutTransaction` to exclude already-covered transactions before building the idempotency key. This prevents double inclusion.

---

## Two-Phase Processing

### Phase 1 — `buildPayout()`
- Queries eligible transactions for the instructor
- Computes SHA-256 idempotency key from sorted transaction IDs
- Returns existing payout record if already built (safe to call twice)
- Creates `Payout` record in `ELIGIBLE` state with a snapshot of:
  - `payoutMethod` — copied from instructor at build time
  - `stripeAccountId` — copied from instructor at build time
  - `grossAmount`, `taxWithheld`, `netAmount`, `gstAmount`
- Creates `PayoutTransaction` join records (immutable links)
- No Stripe calls in this phase

**Payout Snapshot:** The instructor's `payoutMethod` and `stripeAccountId` are locked onto the payout record at creation time. Changing payout settings after `buildPayout()` runs does not affect in-flight or completed payouts. This prevents mid-payout tampering and ensures a clean audit trail.

### Phase 2 — `executePayout()`
- Acquires atomic concurrency lock: `ELIGIBLE/FAILED → PROCESSING` via `updateMany` with status guard
- If 0 rows updated: another process holds the lock — returns current state (safe, no duplicate)
- Calls `assertSufficientBalance(netAmount)` — fails if `netAmount > availableBalance`
- **Stripe Connect:** executes Stripe transfer → marks `PAID` → updates ledger → audit log `PAYOUT_PAID` → SMS instructor
- **Bank/Manual:** no Stripe call → marks `PENDING_TRANSFER` → no ledger update → audit log `PAYOUT_PENDING_TRANSFER`

### Bank/Manual — Admin Steps After Processing

Once a payout is `PENDING_TRANSFER`, it appears in the **Manual Transfers** tab:

1. Admin transfers `netAmount` to the instructor's BSB/account shown on screen
2. Admin clicks **Mark Sent** → enters bank transaction reference → status moves to `SENT`
3. Admin clicks **Confirm Received** once instructor confirms → status moves to `PAID` → ledger updated

The ledger is only updated at step 3. This is the financial invariant: ledger = real money movement.

---

## Concurrency Safety

Both single and bulk payout calls go through the same `buildPayout()` + `executePayout()` path. The atomic lock in `executePayout()` (`updateMany` with status guard) means:

- If two admins trigger the same payout simultaneously, only one will acquire the lock
- The second call returns the current payout state without executing a Stripe transfer
- Bulk `process-all` uses `Promise.allSettled` — each instructor is processed independently; one failure does not block others

---

## Financial Invariants

The system enforces these invariants before every payout:

```
availableBalance = totalCollected − totalPaidOut − totalRefunded
netAmount ≤ availableBalance   (enforced by assertSufficientBalance)
availableBalance ≥ 0           (enforced by assertNonNegativeBalance after every refund)
```

The ledger is populated by:
- `recordPaymentCollected()` — called from Stripe webhook on `payment_intent.succeeded`; increments `totalCollected` and `totalReserved`
- `executePayout()` — increments `totalPaidOut`, decrements `totalReserved`
- `recordRefundIssued()` — increments `totalRefunded`; then calls `assertNonNegativeBalance()` — if the balance goes negative (e.g. post-payout refund cascade), an error is thrown and logged, and all subsequent payouts are blocked until an admin resolves the discrepancy

If `STRIPE_WEBHOOK_SECRET` is not set, webhook signature verification is skipped and a warning is logged. In production, this must be set to a real value from the Stripe Dashboard.

**Ledger initialization warning:** If `buildPayout()` is called and `PlatformLedger.totalCollected = 0`, a console warning is emitted: `[LEDGER WARNING] ... Stripe webhook is not calling recordPaymentCollected()`. This is a non-blocking safety net — the payout will still fail at `assertSufficientBalance()` if the balance is genuinely zero, but the warning surfaces the root cause (webhook not firing) rather than just "insufficient balance".

---

## Tabs

### Eligible
Transactions meeting all 7 eligibility criteria above.

Each row shows: instructor name, lesson date, client, lesson price, platform fee, gross payout, tax withheld, net payout.

Actions:
- Process individual payout → calls `buildPayout()` then `executePayout()`
  - Stripe Connect: completes immediately, payout is `PAID`
  - Bank/Manual: queues to `PENDING_TRANSFER`, UI auto-switches to Manual Transfers tab
- Process all eligible payouts (bulk) → `Promise.allSettled` per instructor, failures don't block others

Bulk payout response per instructor includes a `status` field:
- `PAID` — Stripe transfer completed
- `PENDING_TRANSFER` — bank/manual payout queued, admin action required
- `FAILED` — Stripe or system error (retryable)
- `SKIPPED` — instructor's ABN is on file but not verified; includes `reason` field with `abnStatus`

### Manual Transfers
Bank transfer and manual payouts that require admin action. Two sub-sections:

**Pending Transfer** — payout approved, admin has not yet sent funds:
- Shows instructor name, BSB, account number, account name, net amount, tax withheld
- **Mark Sent** button → modal prompts for bank transaction reference → status moves to `SENT`

**Sent — Awaiting Confirmation** — admin has recorded bank ref, waiting for instructor to confirm receipt:
- Shows bank reference, sent date, net amount
- **Confirm Received** button → status moves to `PAID`, ledger updated

### Failed
Payouts in `FAILED` state. Shows `failureReason` and `retryCount`. Admin can retry — idempotency key prevents duplicate Stripe transfers on retry.

**Retry behavior:** Manual only — admin clicks retry in the UI. No automatic retry or backoff. The idempotency key passed to Stripe ensures a retry never creates a duplicate transfer even if the previous attempt partially succeeded on Stripe's side.

**Stripe partial failure:** If Stripe succeeds but the DB update fails, the payout remains `PROCESSING`. On retry, `executePayout()` will fail to acquire the lock (status is not `ELIGIBLE` or `FAILED`) and return the current state. Admin must manually inspect and resolve via the Stripe Dashboard if needed.

### On Hold
Payouts in `ON_HOLD` state. Shows `holdReason` and when the hold was placed.

Actions:
- Release hold → `DELETE /api/admin/payouts/[payoutId]/hold` → status returns to `ELIGIBLE`

### Disputes
Bookings tagged with `INSTRUCTOR_NO_SHOW`, `CLIENT_NO_SHOW`, or `DISPUTED` by admin.

---

## Placing a Hold

Admin can hold any `ELIGIBLE` or `FAILED` payout:

```
POST /api/admin/payouts/[payoutId]/hold
{ "reason": "Dispute raised by client on 2026-03-20" }
```

The payout moves to `ON_HOLD`. It cannot be processed until released. Every hold and release is logged to `AuditLog`.

Use cases:
- Client raises a dispute
- Compliance review required
- Instructor account under investigation

---

## Releasing a Hold

```
DELETE /api/admin/payouts/[payoutId]/hold
```

Moves the payout back to `ELIGIBLE`. Admin can then process it normally.

---

## Resolve Dispute

### Single-action resolution

Admin calls `POST /api/admin/payouts/resolve`:

```json
{
  "transactionId": "string",
  "action": "refund_client | approve_for_payout | charge_instructor | void",
  "reason": "optional note"
}
```

| Action | Effect on Transaction | Ledger Impact |
|--------|----------------------|---------------|
| `refund_client` | → `REFUNDED`; client wallet credited with full booking amount | `totalRefunded++`, `availableBalance` decreases |
| `approve_for_payout` | → `SETTLED`; transaction enters next payout run | No Stripe call here — payout layer handles execution |
| `charge_instructor` | → `CANCELLED`; `ADJUSTMENT` ledger entry created (negative, deducted from next payout) | `ADJUSTMENT` entry appended |
| `void` | → `CANCELLED`; no money moves | No ledger entry |

**`approve_for_payout` semantics:** This action marks the transaction as payout-eligible. It does NOT execute a Stripe transfer. The admin must then go to the Eligible tab and process the payout. The UI shows a banner: "Approved for payout — go to Eligible tab to process." This is intentional — the dispute layer decides who should be paid; the payout layer moves the money.

**Legacy alias:** `pay_instructor` is accepted as a backward-compatible alias for `approve_for_payout`. It is deprecated in the UI but still handled by the API.

**Idempotency:** Terminal states (`REFUNDED`, `CANCELLED`) return HTTP 409. `approve_for_payout` on an already-`SETTLED` transaction also returns 409.

### Atomic split resolution

For disputed bookings where fault is shared, admin calls `POST /api/admin/payouts/resolve-split`:

```json
{
  "transactionId": "string",
  "refundAmount": 50.00,
  "payoutAmount": 30.00,
  "reason": "optional note"
}
```

Both legs (wallet refund + transaction SETTLED) execute inside a single DB `$transaction`. If either fails, neither applies — no partial state is possible.

| Field | Constraint |
|-------|-----------|
| `refundAmount` | 0 to `transaction.amount` |
| `payoutAmount` | 0 to `transaction.instructorPayout` |
| At least one | Must be > 0 |

Response includes `resolutionGroupId` (e.g. `RES-GRP-A1B2C3D4`) which links both legs in the audit log.

**Idempotency:** If `resolutionStatus = COMPLETED` already exists on the transaction, returns HTTP 409 with the existing `resolutionGroupId`.

**Schema fields added to `Transaction`:**
- `resolutionGroupId String?` — shared ID across both legs of a split
- `resolutionStatus String?` — `PENDING | PARTIAL | COMPLETED | FAILED`

All resolutions create an `AuditLog` entry with `targetType: 'TRANSACTION'`, `targetId`, and full metadata including amounts and reason.

---

## Refund Ledger Impact

| Event | LedgerEntry type | PlatformLedger delta |
|---|---|---|
| Normal refund (pre-payout) | `REFUND_ISSUED` | `totalRefunded++` |
| Post-payout refund | `REFUND_ISSUED` + `ADJUSTMENT` | `totalRefunded++` |

Post-payout refunds create an `ADJUSTMENT` ledger entry against the instructor. This is recovered from their next payout automatically. See `docs/06-payments/REFUNDS.md` for full details.

---

## Platform Balance

Before every payout execution, the system checks the platform ledger:

```
availableBalance = totalCollected − totalPaidOut − totalRefunded
```

If the payout `netAmount` exceeds `availableBalance`, the payout fails with `Insufficient platform balance`. The current balance is visible on the Revenue page (`/admin/revenue`).

Note: `totalReserved` tracks money earmarked for instructor payouts but not yet paid. It is informational — the hard constraint is `netAmount ≤ availableBalance`.

---

## Payout Buffer

24-hour buffer after `COMPLETED` status before a booking appears in the Eligible tab. This allows time for disputes to be raised before funds are released.

---

## Audit Trail

Every state transition is logged to `AuditLog` with `actorId`, `actorRole: 'ADMIN'`, `targetType: 'PAYOUT'`, `targetId`, `success`, and a `metadata` object:

| Action | Trigger | Key metadata |
|---|---|---|
| `PAYOUT_CREATED` | `buildPayout()` completes | `payoutRef`, `grossAmount`, `taxWithheld`, `netAmount`, `transactionCount` |
| `PAYOUT_PROCESSING` | Lock acquired in `executePayout()` | `lockedAt` |
| `PAYOUT_PAID` | Stripe transfer confirmed | `stripeTransferId`, `netAmount`, `transactionCount` |
| `PAYOUT_PENDING_TRANSFER` | Bank/manual payout queued | `payoutRef`, `netAmount`, `payoutMethod`, `transactionCount` |
| `PAYOUT_SENT` | Admin records bank reference | `bankReference` |
| `PAYOUT_CONFIRMED` | Admin confirms receipt | `bankReference`, `netAmount`, `taxWithheld` |
| `PAYOUT_FAILED` | Stripe or system error | `failureReason` |
| `PAYOUT_HELD` | Admin places hold | `reason` |
| `PAYOUT_RELEASED` | Admin releases hold | — |
| `DISPUTE_RESOLVED_REFUND_CLIENT` | `resolve` — refund action | `amount`, `reason`, `bookingId` |
| `DISPUTE_RESOLVED_APPROVE_FOR_PAYOUT` | `resolve` — approve action | `instructorPayout`, `reason`, `bookingId` |
| `DISPUTE_RESOLVED_CHARGE_INSTRUCTOR` | `resolve` — penalty action | `penaltyAmount`, `reason`, `bookingId` |
| `DISPUTE_RESOLVED_VOID` | `resolve` — void action | `amount`, `reason`, `bookingId` |
| `DISPUTE_RESOLVED_SPLIT` | `resolve-split` | `resolutionGroupId`, `refundAmount`, `payoutAmount`, `reason`, `bookingId` |

`SKIPPED` instructors in bulk runs are not logged to `AuditLog` — they are returned in the API response only. No `Payout` record is created for a skipped instructor.

---

## Reconciliation

A daily cron job runs at 03:00 AWST (19:00 UTC) via `GET /api/cron/reconcile-stripe`.

**Detection only — never auto-fixes.** All issues are flagged for admin review. No ledger entries, refunds, or payouts are created automatically.

### Three checks per run

| Check | What it detects |
|-------|----------------|
| Missing payments | Stripe `payment_intent.succeeded` with no `LedgerEntry(PAYMENT_COLLECTED)` — webhook likely failed |
| Missing transfers | `PAID` payout with `stripeTransferId` not found in Stripe — DB/Stripe desync |
| Stuck payouts | `status = PROCESSING` for > 10 minutes — DB update failed after Stripe transfer |

### Window

Each run checks the previous 25 hours (1-hour overlap to catch edge cases near the boundary).

### Concurrency lock

If a `RUNNING` report already exists, the new run returns immediately with `skipped: true`. This prevents overlapping runs from producing duplicate flags.

### Results stored in `ReconciliationReport`

```
ReconciliationReport {
  id, startedAt, completedAt
  status: RUNNING | SUCCESS | WARNING | FAILED
  windowStart, windowEnd
  paymentsChecked, missingPayments
  transfersChecked, missingTransfers
  stuckPayouts
  metadata: { flaggedMissingPayments[], flaggedMissingTransfers[], flaggedStuckPayouts[] }
}
```

`WARNING` status means at least one issue was found. `SUCCESS` means all checks passed. `FAILED` means the job itself errored (Stripe API down, DB error, etc.).

### What to do when issues are found

| Flag | Likely cause | Admin action |
|------|-------------|--------------|
| `missingPayments` | Stripe webhook didn't fire | Check Stripe webhook logs; manually call `recordPaymentCollected()` if confirmed |
| `missingTransfers` | Stripe transfer exists but DB stuck in PROCESSING | Verify in Stripe Dashboard; manually update payout status |
| `stuckPayouts` | DB write failed after Stripe transfer | Check Stripe for the transfer; resolve manually |

Alerting (email notification on WARNING/FAILED) is wired in the alerting system (#4).

---

## Alerting

The alerting system (`lib/services/alert-service.ts`) sends email to `ADMIN_EMAIL` when critical financial events occur. Alerts never block core flows — if the email send fails, the error is logged and execution continues.

### Alert types

| Type | Severity | Trigger | Source |
|------|----------|---------|--------|
| `NEGATIVE_BALANCE` | CRITICAL | `availableBalance < 0` after a refund | `assertNonNegativeBalance()` in `ledger-service.ts` |
| `PAYOUT_FAILED` | CRITICAL | `executePayout()` catches an error | `payout-service.ts` catch block |
| `ABN_REVOKED` | CRITICAL | Weekly cron finds a cancelled ABN | `recheck-abn` cron |
| `RECONCILIATION_ISSUES` | WARNING | Daily cron finds missing payments/transfers or stuck payouts | `reconcile-stripe` cron |

### Throttle

The same alert type + entity ID will not fire more than once per hour. Throttle state is in-memory — it resets on cold start. This is intentional for v1: cold starts are rare in production, and the 1-hour window prevents alert spam during incident cascades.

### Email format

```
Subject: [CRITICAL] DriveBook: Payout failed: PAYOUT-ABC123-1711234567890

Type:            PAYOUT_FAILED
Time:            24 Mar 2026, 03:00 AWST
Message:         Payout failed: PAYOUT-ABC123-...
Entity ID:       payout_xyz
payoutRef:       PAYOUT-ABC123-...
instructorId:    inst_abc
netAmount:       120
failureReason:   Insufficient Stripe balance
Action required: Yes — immediate review required
```

### Configuration

| Env var | Required | Description |
|---------|----------|-------------|
| `ADMIN_EMAIL` | Yes | Recipient for all alerts |
| `NEXTAUTH_URL` | Yes | Used to generate the "Open Admin" link in the email body |

If `ADMIN_EMAIL` is not set, alerts are skipped with a `console.warn`. No error is thrown.

### Phase 2 (not yet implemented)

- Slack webhook integration
- Alert dashboard in `/admin`
- Severity filtering
- Per-alert-type recipient routing

---

## Related

- [REVENUE_REPORTING.md](./REVENUE_REPORTING.md) — Platform ledger and revenue overview
- [DISPUTES.md](./DISPUTES.md) — Dispute resolution action types
- `/admin/audit-log` — Full audit log UI with filtering and metadata drill-down
- `docs/06-payments/PAYOUTS.md` — Payout mechanics and state machine
- `docs/06-payments/REFUNDS.md` — Refund policy and post-payout adjustments
