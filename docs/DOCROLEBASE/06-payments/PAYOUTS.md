# Instructor Payouts

**Admin route:** `/admin/payouts`  
**APIs:** `GET /api/admin/payouts`, `POST /api/admin/payouts/process`, `POST /api/admin/payouts/process-all`  
**Hold/Release:** `POST /api/admin/payouts/[payoutId]/hold` (hold), `DELETE /api/admin/payouts/[payoutId]/hold` (release)  
**Manual transfer:** `POST /api/admin/payouts/[payoutId]/mark-sent`  
**Instructor settings:** `GET/POST /api/instructor/payout-settings`  
**Instructor UI:** `/dashboard/settings/payout`  
**Service:** `lib/services/payout-service.ts`  
**Ledger service:** `lib/services/ledger-service.ts`

---

## Payout State Machine

Two distinct paths depending on payout method:

```
Stripe Connect:
  ELIGIBLE → PROCESSING → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (dispute / admin hold)

Bank Transfer / Manual:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER → SENT → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (dispute / admin hold)
```

| State | Applies to | Meaning |
|---|---|---|
| `ELIGIBLE` | All | Lesson ended 24h+ ago, no open disputes, not yet paid |
| `PROCESSING` | All | Concurrency lock acquired |
| `PAID` | All | Money confirmed moved — Stripe transfer OR admin confirmed receipt |
| `FAILED` | All | Error — retryable, transactions untouched |
| `ON_HOLD` | All | Admin or dispute hold — must be explicitly released |
| `PENDING_TRANSFER` | Bank/Manual only | Approved, awaiting admin to physically transfer funds |
| `SENT` | Bank/Manual only | Admin recorded bank reference, awaiting confirmation of receipt |

**Core invariant:** A payout is never marked `PAID` unless money has actually moved. For Stripe Connect, this is the Stripe transfer confirmation. For bank/manual, this is the admin explicitly confirming receipt via the "Confirm Received" action.

State lives on the `Payout` model. Transactions are immutable financial records — their status never changes after creation. Payout membership is tracked via the `PayoutTransaction` join table only.

---

## Eligibility Rules

A transaction becomes eligible for payout when ALL of the following are true:

1. `Transaction.status = SETTLED` (payment captured via Stripe webhook)
2. `Booking.endTime` is 24+ hours in the past (fraud buffer)
3. `Booking.status` is `CONFIRMED` or `COMPLETED`
4. `Booking.deletedAt` is null
5. Not already linked to a `PROCESSING`, `PAID`, `ON_HOLD`, `PENDING_TRANSFER`, or `SENT` payout record
6. No open dispute on the booking
7. If instructor has an ABN on file, it must be `abnVerified = true` — unverified ABN blocks payout (code: `ABN_NOT_VERIFIED`)

Instructors with no ABN on file proceed to payout with 47% ATO withholding applied.

---

## Payout Amount Calculation

```
grossAmount  = sum of transaction.instructorPayout across linked transactions
taxWithheld  = grossAmount × (instructor.withholdingTaxRate / 100)
netAmount    = grossAmount − taxWithheld
gstAmount    = grossAmount / 11   (only if instructor.gstRegistered = true, informational)
```

`instructorPayout` per transaction is locked at booking creation:
```
instructorPayout = booking.price × (1 − commissionRate / 100)
```

---

## Platform Balance Check

Before every Stripe transfer, `assertSufficientBalance(netAmount)` is called:

```
availableBalance = totalCollected − totalPaidOut − totalRefunded
```

If `netAmount > availableBalance`, the payout fails with `Insufficient platform balance`. This prevents overpayment even if Stripe would otherwise allow the transfer.

The `PlatformLedger` singleton tracks these running totals in real time. See `lib/services/ledger-service.ts`.

---

## Idempotency

Every `Payout` record has an `idempotencyKey` = SHA-256 of the sorted transaction IDs. This is:
- Stored as a `@unique` DB constraint — concurrent creates fail with a unique violation, caught and resolved by returning the existing record
- Passed directly to `stripe.transfers.create()` — Stripe deduplicates on retry, no duplicate transfer ever occurs

Retrying a failed payout with the same transactions is always safe.

---

## Payout Methods

Instructors choose their method at `/dashboard/settings/payout`:

| Method | Execution | Recommended |
|---|---|---|
| `stripe_connect` | Automatic `stripe.transfers.create()` to `instructor.stripeAccountId` | ✅ Yes — Stripe verifies identity and bank account |
| `bank_transfer` | Admin manually transfers to BSB/account on file | Fallback only — format validation only, no ownership check |
| `manual` | Admin arranges payment — payout marked PAID by admin | Last resort |

### Stripe Connect Onboarding

Instructors connect their bank account via Stripe's hosted onboarding — the platform never sees their bank details.

**Flow:**
1. Instructor clicks "Connect with Stripe" at `/dashboard/settings/payout`
2. Platform calls `POST /api/instructor/stripe-connect/onboard` — creates a Stripe Express account and generates a secure onboarding link
3. Instructor is redirected to Stripe's own hosted page (stripe.com) — they enter their bank details directly
4. Stripe verifies bank account ownership (micro-deposits or instant verification) and identity
5. Instructor is redirected back to `/dashboard/settings/payout?stripe=success`
6. Stripe fires `account.updated` webhook — platform sets `payoutMethod: stripe_connect` automatically
7. Future payouts execute via `stripe.transfers.create()` directly to the instructor's verified account

**API:** `POST /api/instructor/stripe-connect/onboard`  
**Webhook:** `account.updated` → `handleConnectAccountUpdated()` in `app/api/stripe/webhook/route.ts`

### Bank Transfer (Fallback)

For instructors who cannot use Stripe Connect. BSB and account number are validated for format only — there is no Australian API to verify bank account ownership. Admin must manually confirm bank details before processing the first bank transfer payout.

---

## Tax Withholding (ATO — Western Australia)

| Situation | Withholding Rate |
|---|---|
| ABN verified (`abnVerified = true`) | 0% |
| ABN on file but not yet verified | 47% (ATO default) |
| No ABN | 47% (ATO default) |

The platform-level default is configurable in Admin → Pricing → Tax & Surcharges (`withholdingTaxRate` on `PlatformSettings`).

Instructors provide their ABN at `/dashboard/settings/payout`.

> TFN collection is not currently implemented. The `taxFileNumber` field is commented out in the schema and can be activated if legally required in future.

---

## Payout Snapshot

When `buildPayout()` creates the `Payout` record, it snapshots the instructor's current `payoutMethod` and `stripeAccountId` onto the record. If the instructor changes their payout method after the payout is built, the existing payout still executes using the original method. This prevents mid-flight tampering and ensures a clean audit trail.

---

## GST

If `instructor.gstRegistered = true`, `gstAmount` (1/11 of gross) is recorded on the `Payout` for reporting. It is informational only — it is not deducted from `netAmount` and is not remitted by the platform. The instructor is responsible for remitting GST to the ATO via their own BAS.

---

## Processing Flow (Two-Phase)

Phase 1 — `buildPayout()` (no Stripe, safe to call multiple times):
1. Find eligible `SETTLED` transactions (24h+ buffer, not already in an active/paid payout)
2. Compute amounts (gross, tax, net, GST)
3. Generate SHA-256 idempotency key from sorted transaction IDs
4. Atomically create `Payout` record in `ELIGIBLE` state via DB unique constraint
5. Concurrent race → unique violation caught, existing record returned
6. Audit log: `PAYOUT_CREATED` with amounts and transaction count

Phase 2 — `executePayout()` (Stripe transfer or bank queue):
1. Atomic `updateMany` moves `ELIGIBLE/FAILED → PROCESSING` — if 0 rows updated, another process holds the lock → abort
2. Audit log: `PAYOUT_PROCESSING`
3. `assertSufficientBalance(netAmount)` — throws if platform balance insufficient
4. **If `stripe_connect`:** `stripe.transfers.create()` with idempotency key → `PAID` → ledger updated → audit log `PAYOUT_PAID` → SMS instructor
5. **If `bank_transfer` or `manual`:** no Stripe call → `PENDING_TRANSFER` → no ledger update yet → audit log `PAYOUT_PENDING_TRANSFER`
6. On any error → `FAILED`, `failureReason` stored, `retryCount++`, audit log `PAYOUT_FAILED` — transactions untouched

### Bank/Manual — Admin Steps After `executePayout()`

Once a payout is `PENDING_TRANSFER`, the admin must:

1. Physically transfer `netAmount` to the instructor's BSB/account
2. Call `POST /api/admin/payouts/[payoutId]/mark-sent` with `{ action: "sent", bankReference: "..." }` → status moves to `SENT`, `bankReference` + `sentAt` + `sentBy` recorded
3. Once instructor confirms receipt, call `POST /api/admin/payouts/[payoutId]/mark-sent` with `{ action: "confirm" }` → status moves to `PAID`, ledger updated, audit log `PAYOUT_CONFIRMED`

**Ledger is only updated at step 3.** This enforces the invariant: ledger reflects real money movement, not admin intent.

---

## Admin Hold / Release

```
POST   /api/admin/payouts/[payoutId]/hold   { reason: string }  → ON_HOLD
DELETE /api/admin/payouts/[payoutId]/hold                       → ELIGIBLE
```

Only `ELIGIBLE` or `FAILED` payouts can be placed on hold. `ON_HOLD` payouts cannot be processed until released. Every hold/release is logged to `AuditLog`.

---

## Ledger Integration

Every financial event updates both the `PlatformLedger` singleton and appends an immutable `LedgerEntry`:

| Event | LedgerEntry type | PlatformLedger delta | When |
|---|---|---|---|
| Payment captured | `PAYMENT_COLLECTED` | `totalCollected++`, `totalReserved++` | Stripe webhook |
| Stripe payout paid | `PAYOUT_PAID` | `totalPaidOut++`, `totalReserved--` | Stripe transfer confirmed |
| Bank payout confirmed | `PAYOUT_PAID` | `totalPaidOut++`, `totalReserved--` | Admin confirms receipt |
| Tax withheld | `TAX_WITHHELD` | `totalTaxWithheld++` | Same time as PAYOUT_PAID |
| Refund issued | `REFUND_ISSUED` | `totalRefunded++` | Refund processed |
| Post-payout refund | `ADJUSTMENT` | `totalRefunded++` | Post-payout refund |

**Bank/manual payouts:** The ledger is NOT updated when the payout moves to `PENDING_TRANSFER` or `SENT`. It is only updated when the admin confirms receipt (`SENT → PAID`). This ensures the ledger always reflects real money movement.

---

## Failure Handling

Failed payouts appear in the admin payouts page under a "Failed" tab. Admin can retry — the idempotency key ensures no duplicate Stripe transfer. Common failure reasons:

- Invalid or unverified Stripe Connect account
- Insufficient platform balance
- Network/API timeout

---

## Payout Model Fields

| Field | Type | Description |
|---|---|---|
| `status` | `String` | State machine value |
| `grossAmount` | `Float` | Sum of instructorPayout |
| `taxWithheld` | `Float` | ATO withholding deducted |
| `netAmount` | `Float` | Amount actually transferred |
| `gstAmount` | `Float` | GST component (informational) |
| `idempotencyKey` | `String` | `@unique` — prevents duplicate Stripe transfers |
| `stripeTransferId` | `String?` | Set on successful Stripe transfer |
| `bankReference` | `String?` | Bank transaction ref entered by admin (bank/manual only) |
| `sentAt` | `DateTime?` | When admin clicked "Mark Sent" |
| `sentBy` | `String?` | Admin userId who marked sent |
| `confirmedAt` | `DateTime?` | When admin confirmed receipt |
| `confirmedBy` | `String?` | Admin userId who confirmed |
| `failureReason` | `String?` | Error message if FAILED |
| `holdReason` | `String?` | Reason if ON_HOLD |
| `retryCount` | `Int` | Number of failed attempts |
| `payoutRef` | `String` | Human-readable reference (e.g. `PAYOUT-ABC123-1234567890`) |
| `approvedBy` | `String` | Admin user ID who triggered the payout |
| `approvedAt` | `DateTime` | When the payout was approved |
| `paidAt` | `DateTime?` | When the payout was confirmed paid |

---

## Related

- `docs/DOCROLEBASE/05-admin/PAYOUTS.md` — Admin payout management UI
- `docs/DOCROLEBASE/06-payments/COMMISSIONS.md` — Commission rate calculation
- `docs/DOCROLEBASE/06-payments/REFUNDS.md` — Post-payout refund handling
- `docs/DOCROLEBASE/06-payments/STRIPE.md` — Stripe Connect setup
