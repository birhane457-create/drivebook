# Control Guarantees

What the system guarantees, and the mechanism that enforces each guarantee.

---

## Financial Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| No double payouts | Idempotency check in `resolve` endpoint — 409 if payout already resolved |
| No negative wallet balance | `assertNonNegativeBalance()` in `ledger-service.ts` before any debit |
| No untracked transactions | All money movements create a `Transaction` record atomically |
| No payout before 24h buffer | `processedAt < now - 24h` check in payout eligibility query |
| No refund after payout (without override) | Status check in cancel/refund flow — SUPER_ADMIN required |
| Commission rate locked at payment time | Rate stored in Stripe metadata + `Booking.commissionRate` at creation |
| Withholding applied correctly | `withholdingTaxRate` set on every ABN status change — read at payout build time |
| Split resolution is atomic | `resolve-split` uses `prisma.$transaction()` — all-or-nothing |

---

## Operational Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| No silent state changes | All transitions go through API route handlers |
| Every critical action is audited | `AuditLog.create()` called in every mutation path |
| No orphan bookings | Slot expiry cron cleans PENDING_PAYMENT bookings after 10 minutes |
| Cron jobs don't double-run | Concurrency lock checked at start of each cron execution |
| Compliance failures are surfaced | Daily `recheck-abn` and `reconcile-stripe` crons + alert emails |
| Admin is always in control | All lifecycle transitions require ADMIN or SUPER_ADMIN session |

---

## Data Integrity Guarantees

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| Transactions are immutable | No `transaction.update()` calls — only new records with `parentTransactionId` |
| Wallet balance = transaction sum | Daily reconciliation cron verifies and alerts on mismatch |
| Ledger group coherence | `ledgerGroupId` links all transactions for a booking — reconstructable at any time |
| AuditLog is append-only | No update or delete routes exist for `AuditLog` |
| Resolution group traceability | `resolutionGroupId` on `Transaction` links all entries from a split/dispute resolution |

---

## What Is NOT Guaranteed (Known Gaps)

| Gap | Status |
|-----|--------|
| Stripe Connect automated transfer | Not yet configured — payouts are manual bank transfer |
| `sendReminder` in compliance route | Logs intent but does not send email yet |
| Staff governance stats API | `/api/admin/staff-governance/stats` endpoint not yet implemented |
| ~~STRIPE_WEBHOOK_SECRET~~ | **RESOLVED** — real secret set (test mode); replace with production secret at go-live |
| ~~Prisma client stale~~ | **RESOLVED** — `prisma generate` run March 2026; payout + ledger services functional |
| `wallet.balance` drift | Instructor booking path creates `WalletTransaction` but does not update stored `balance` field |
| AuditLog on booking creation | `POST /api/bookings` does not create an AuditLog entry |
| AuditLog on admin booking PATCH | Status changes (COMPLETED, NO_SHOW) are not audited |

---

## Related

- [FAILURE_HANDLING.md](./FAILURE_HANDLING.md) — What happens when guarantees are violated
- [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) — Where authoritative data lives
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Financial safety checklist

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

- Daily `recheck-abn` cron detects cancellation
- `abnVerified: false`, `withholdingTaxRate: 47` set automatically
- Alert email sent: `ABN_VERIFICATION_REVOKED`
- AuditLog: `ABN_VERIFICATION_REVOKED`
- Admin notified to contact instructor

---

## Booking Edge Cases

### Lesson Completed but Not Marked

- Transaction stays in `COMPLETED` (not `SETTLED`)
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


# Glossary

Terms used throughout DriveBook documentation and codebase.

---

## Roles

**CLIENT** — A learner driver who books lessons. Has a `User` record with `role: "CLIENT"` and optionally a `ClientWallet`.

**INSTRUCTOR** — A driving instructor. Has a `User` record with `role: "INSTRUCTOR"` and an `Instructor` record with profile, subscription, and branding data.

**ADMIN / SUPER_ADMIN** — Platform staff. Access to all admin routes at `/admin/*`.

**Guest** — A client who books via the public subdomain without a pre-existing account. An account is created automatically during booking.

---

## Booking

**Booking** — A time slot reservation between a client and instructor. Stored in the `Booking` model.

**Booking Status** — The lifecycle state of a booking:
- `PENDING` — Created but not yet confirmed (legacy/manual flows)
- `PENDING_PAYMENT` — Slot reserved, awaiting Stripe payment (max 10 min)
- `CONFIRMED` — Paid and confirmed, slot is locked
- `COMPLETED` — Lesson delivered
- `CANCELLED` — Cancelled by instructor, client, or admin
- `EXPIRED` — `PENDING_PAYMENT` not paid within 10 min
- `NO_SHOW` — Admin-tagged or auto-set 3h after end time with no check-in

**Slot** — A specific time window (startTime to endTime) on an instructor's calendar.

**Slot Hold** — When a booking is created as `PENDING_PAYMENT`, it holds the slot for 10 minutes while the client completes payment.

**Check-In** — The instructor (or client via mobile) marks the lesson as started. Required for the booking to auto-complete.

**Reschedule** — Moving a booking to a different time. Subject to notice period rules and potential wallet adjustments.

**Package Booking** — A bulk purchase of multiple lessons (e.g. 6, 10, or 15 hours). Stripe charges the full package amount; the wallet is credited with the total and debited per lesson.

**isFirstBooking** — Flag on a booking indicating it's the first lesson between this client and instructor. Affects commission rate (10% instead of standard rate).

**isNonRefundable** — Set to `true` when an instructor reschedules a booking within the 24-hour window. Means 0% refund on cancellation regardless of notice.

---

## Payments

**Wallet** — A client's credit balance on DriveBook. Stored in `ClientWallet`. Used to pay for lessons booked via the client dashboard.

**Wallet Balance** — Computed as: `SUM(CONFIRMED CREDIT transactions) - SUM(CONFIRMED DEBIT transactions)`. Never stored as a field.

**Top-Up** — Adding funds to a client wallet via Stripe. Creates a `WalletTransaction` of type `CREDIT`.

**Commission** — The percentage of a lesson price taken by the platform. Varies by instructor subscription tier. Configured via `/admin/pricing` and stored in `PlatformSettings`.

**Platform Fee** — The portion of the lesson price retained by DriveBook (= `price x commissionRate`).

**Instructor Payout** — The portion paid to the instructor (= `price - platformFee`). Locked at booking creation time.

**New Student Bonus** — A reduced commission rate applied to the first booking between a client and instructor. Configured per tier.

**GST** — Goods and Services Tax (10%). Applied to lesson prices. Governed by Australian tax law.

**PaymentIntent** — A Stripe object representing a payment in progress. Stored as `paymentIntentId` on the `Booking`.

**Webhook** — A Stripe event sent to `/api/stripe/webhook` when a payment succeeds or fails.

---

## Payouts

**Payout** — A record representing a batch payment from the platform to an instructor. Covers one or more eligible `Transaction` records. State machine: `ELIGIBLE -> PROCESSING -> PAID / FAILED / ON_HOLD`.

**PayoutTransaction** — An immutable join record linking a `Payout` to a `Transaction`. Transactions are never mutated — payout membership is tracked here only.

**idempotencyKey** — SHA-256 hash of the sorted transaction IDs included in a payout. Stored as a `@unique` DB constraint and passed to Stripe to prevent duplicate transfers on retry.

**ON_HOLD** — A payout state indicating an admin or dispute hold. The payout cannot be processed until explicitly released via `DELETE /api/admin/payouts/[payoutId]/hold`.

**withholdingTaxRate** — The ATO withholding percentage applied to an instructor's gross payout. 0% if ABN is verified; 47% (ATO statutory rate) if ABN is absent or unverified. Configurable platform-wide via `PlatformSettings`. TFN collection is not active.

**grossAmount** — Sum of `instructorPayout` across all transactions in a payout, before tax withholding.

**netAmount** — `grossAmount - taxWithheld`. The amount actually transferred to the instructor.

**payoutRef** — Human-readable payout reference, e.g. `PAYOUT-ABC123-1234567890`.

**Payout Snapshot** — When a `Payout` record is created (`buildPayout()`), the instructor's `payoutMethod` and `stripeAccountId` are copied onto the payout record at that moment. These values are immutable on the payout — changing payout settings later does not affect in-flight or completed payouts. This prevents mid-payout tampering and ensures a clean audit trail.

**abnVerified** — Boolean on the `Instructor` model. `true` only after an admin or the ABR API confirms the ABN is active and matches the instructor's name.

**abnStatus** — The current ABR status of the instructor's ABN. Possible values:
- `PENDING` — ABN submitted but not yet verified
- `ACTIVE` — ABN confirmed active by ABR
- `CANCELLED` — ABN is cancelled per ABR records
- `REVIEW_REQUIRED` — ABN lookup returned a mismatch or ambiguous result; admin must manually verify

**abnEntityName** — The legal entity name returned by the ABR for the instructor's ABN. Used for name-match verification and audit records.

**ABN Name Match Score** — A Jaccard similarity score (0–1) comparing the instructor's registered name against the ABR entity name. Computed in `lib/utils/abn-validation.ts`:
- ≥ 0.8 — auto-approved (`MATCHED`)
- 0.5–0.79 — flagged for admin review (`REVIEW_REQUIRED`)
- < 0.5 — no match (`NO_MATCH`)

**ABN Drift** — The risk that an ABN becomes cancelled after it was verified. Mitigated by a weekly cron job (`GET /api/cron/recheck-abn`) that rechecks all verified ABNs against the ABR. If cancelled, `abnVerified` is cleared, `withholdingTaxRate` reverts to 47%, and an `ABN_VERIFICATION_REVOKED` audit entry is created.

**BSB** — Bank State Branch code. A 6-digit Australian bank routing number (format: XXX-XXX). Validated for format only — there is no official Australian API to verify BSB ownership. The platform maps known BSB prefixes to bank names for UX feedback (e.g. `062` → Commonwealth Bank). Account ownership is confirmed manually by admin before the first bank transfer payout.

**bankAccountName** — The account holder name provided by the instructor for bank transfer payouts. Not verified against the bank — admin must confirm before processing.

---

## Platform Ledger

**PlatformLedger** — A singleton DB record (key = `"default"`) tracking running financial totals for the platform. Updated atomically on every payment, payout, and refund event.

| Field | Meaning |
|---|---|
| `totalCollected` | Total money received from students |
| `totalReserved` | Money earmarked for instructor payouts (not yet paid) |
| `totalPaidOut` | Total paid to instructors |
| `totalRefunded` | Total refunded to clients |
| `totalTaxWithheld` | Total ATO withholding retained |
| `availableBalance` | `totalCollected - totalPaidOut - totalRefunded` (computed on read) |

**LedgerEntry** — An append-only record of every financial event. Never updated after creation. Types:
- `PAYMENT_COLLECTED` — student payment captured; increases `totalCollected` and `totalReserved`
- `PAYOUT_PAID` — net payout transferred to instructor; decreases `totalPaidOut`
- `TAX_WITHHELD` — ATO withholding retained by platform; increases `totalTaxWithheld`
- `REFUND_ISSUED` — refund back to client; increases `totalRefunded`
- `ADJUSTMENT` — manual correction or post-payout deduction (e.g. instructor owes platform after a refund was issued post-payout). Amount is negative. Recovered from the instructor's next payout.

**availableBalance** — The safe payout ceiling. No payout can exceed this value. Computed as `totalCollected - totalPaidOut - totalRefunded`.

---

## Subscriptions

**Tier** — The instructor's subscription level: `BASIC`, `PRO`, or `BUSINESS`.

**Trial** — A free period before payment is required. BASIC/PRO: 14 days. BUSINESS: 30 days.

**trialEndsAt** — The date the trial expires. Stored on both `Instructor` and `Subscription` models.

**subscriptionStatus** — Current state: `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`.

**billingCycle** — `monthly` or `annual`. Annual plans are discounted.

**cancelAtPeriodEnd** — If `true`, the subscription cancels at the end of the current billing period rather than immediately.

**Stripe Price ID** — The Stripe product price identifier for each tier/cycle combination. Set in `.env` as `STRIPE_BASIC_MONTHLY_PRICE_ID` etc.

---

## Branding

**Subdomain** — An instructor's public booking page at `[slug].drivebook.com.au`. Configured via `customDomain` on the `Instructor` model.

**Branded Booking Page** — When `showBrandingOnBookingPage: true`, the subdomain page shows the instructor's logo, colors, and name instead of the DriveBook defaults. Requires PRO or BUSINESS tier.

**brandColorPrimary / brandColorSecondary** — Hex color codes for the instructor's brand. Applied to the subdomain page.

---

## Technical

**Prisma** — The ORM used to interact with MongoDB. Schema at `prisma/schema.prisma`.

**PlatformSettings** — A singleton DB record (key = `"default"`) storing all admin-configurable rates and fees, including commission rates per tier, `withholdingTaxRate`, and surcharges. Accessed via `lib/services/platform-pricing.ts`.

**AuditLog** — An append-only record of every significant action (booking created, cancelled, payout state transitions, etc.). Never deleted.

**WebhookEvent** — Idempotency record for Stripe webhooks. Prevents double-processing on duplicate delivery.

**CRON_SECRET** — Bearer token required to call cron endpoints (e.g. `/api/cron/cleanup-expired-bookings`, `/api/cron/recheck-abn`).

**NextAuth** — Authentication library. Session-based auth for web. JWT-based auth for mobile.

**Capacitor** — Framework used to wrap the Next.js app as a native iOS/Android app.

---

## Locations

**Perth / AWST** — All times stored in UTC in the database. Displayed in `Australia/Perth` (UTC+8) timezone.

**serviceAreas** — A string field on `Instructor` describing the geographic areas they cover.

**serviceRadiusKm** — The radius (in km) from the instructor's base address within which they operate.

**pickupAddress** — The client's requested pickup location for a lesson.


# State Machines

All entity state transitions in DriveBook. Every transition is explicit — no implicit or silent state changes.

---

## Booking States

```
PENDING_PAYMENT
    │
    ├─► EXPIRED          (10-minute slot hold elapsed, no payment)
    │
    └─► CONFIRMED        (payment captured — Stripe webhook or wallet debit)
            │
            ├─► COMPLETED    (admin marks lesson done)
            │
            ├─► NO_SHOW      (admin marks no-show)
            │
            └─► CANCELLED    (client, instructor, or admin cancels)
```

### Transition Rules

| From | To | Who | Condition |
|------|----|-----|-----------|
| PENDING_PAYMENT | CONFIRMED | System | Payment captured (Stripe webhook or wallet confirm) |
| PENDING_PAYMENT | EXPIRED | System | 10-minute hold elapsed without payment |
| CONFIRMED | COMPLETED | Admin | `endTime <= now` |
| CONFIRMED | NO_SHOW | Admin | `startTime <= now` |
| CONFIRMED | CANCELLED | Client / Instructor / Admin | Any time before lesson |
| COMPLETED | CANCELLED | SUPER_ADMIN only | Requires override reason |

COMPLETED and CANCELLED are terminal states. No further transitions except SUPER_ADMIN override.

**No-show party:** When a booking is marked `NO_SHOW`, the `noShowParty` field on the `Booking` record is set to `'instructor'`, `'client'`, or `'both'`. This determines the resolution path in the Payouts admin panel.

---

## Instructor States

```
PENDING
    │
    ├─► APPROVED         (admin approves after document review)
    │       │
    │       └─► SUSPENDED    (admin suspends)
    │               │
    │               └─► APPROVED    (admin reinstates)
    │
    └─► REJECTED         (admin rejects — terminal)
```

### Transition Rules

| From | To | Who | Condition |
|------|----|-----|-----------|
| PENDING | APPROVED | Admin | Documents verified, ABN checked |
| PENDING | REJECTED | Admin | Failed compliance check |
| APPROVED | SUSPENDED | Admin | Policy violation or compliance failure |
| SUSPENDED | APPROVED | Admin | Issue resolved |

Suspended instructors: cannot accept new bookings, existing confirmed bookings are not affected.

---

## Transaction States

There are two booking creation paths with different transaction flows:

**Path A — Instructor wallet booking** (instructor creates booking for client):
```
Created as COMPLETED directly
    │
    └─► SETTLED      (booking confirmed, eligible for payout)
            │
            ├─► CANCELLED    (booking cancelled — refund issued)
            └─► REFUNDED     (dispute resolution — partial or full refund)
```

**Path B — Stripe payment booking** (client books via /book):
```
Created in initial state
    │
    └─► SETTLED      (Stripe webhook: payment_intent.succeeded)
            │
            ├─► CANCELLED    (booking cancelled — refund issued)
            └─► REFUNDED     (dispute resolution — partial or full refund)
```

**Key facts:**
- `SETTLED` is the status that makes a transaction payout-eligible (not `COMPLETED`)
- `CANCELLED` is used when a booking is cancelled (not `REFUNDED`)
- `REFUNDED` is only used via the dispute resolve endpoint for partial/full dispute refunds
- Transactions are immutable — status is the only mutable field. All adjustments create new linked transaction records.

---

## Payout States

Two paths depending on payout method:

```
Stripe Connect:
  ELIGIBLE → PROCESSING → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (admin hold)

Bank Transfer / Manual:
  ELIGIBLE → PROCESSING → PENDING_TRANSFER → SENT → PAID
                       ↘ FAILED   (retryable)
                       ↘ ON_HOLD  (admin hold)
```

| State | Meaning |
|---|---|
| `ELIGIBLE` | Lesson ended 24h+ ago, not yet paid |
| `PROCESSING` | Concurrency lock acquired |
| `PAID` | Money confirmed moved (Stripe transfer OR admin confirmed receipt) |
| `FAILED` | Error — retryable, transactions untouched |
| `ON_HOLD` | Admin hold — must be explicitly released |
| `PENDING_TRANSFER` | Bank/manual only — approved, awaiting admin to physically transfer |
| `SENT` | Bank/manual only — admin recorded bank ref, awaiting confirmation |

**Invariant:** `PAID` is only set when money has actually moved. For Stripe Connect, this is the Stripe transfer confirmation. For bank/manual, this is the admin explicitly confirming receipt via `POST /api/admin/payouts/[payoutId]/mark-sent` with `action: "confirm"`. The ledger is only updated at that point.

A payout stuck in `PROCESSING` for >10 minutes is flagged by the reconciliation cron and triggers an alert.

---

## ABN Verification States

```
UNVERIFIED (default)
    │
    ├─► ACTIVE           (ABR confirms valid ABN, name match ≥0.8)
    │       │
    │       └─► REVIEW_REQUIRED   (daily recheck finds issue)
    │               │
    │               ├─► ACTIVE    (admin re-verifies)
    │               └─► UNVERIFIED (admin revokes)
    │
    └─► REVIEW_REQUIRED  (name match 0.5–0.79, or ABR lookup inconclusive)
            │
            ├─► ACTIVE    (admin manually verifies)
            └─► UNVERIFIED (admin rejects)
```

`withholdingTaxRate` is set automatically on every transition: ACTIVE → 0%, anything else → 47%.

---

## Client Wallet States

```
ACTIVE (balance > 0)
    │
    ├─► ZERO_BALANCE     (balance = 0, cannot book)
    │       │
    │       └─► ACTIVE   (top-up or admin credit)
    │
    └─► NEGATIVE         (edge case — refund dispute or admin deduction)
            │
            └─► ACTIVE   (admin investigation + correction)
```

Negative balance blocks new bookings. Requires admin investigation via Audit Log.

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — What triggers each transition
- `docs/00-foundation/STATE_MACHINE.md` — Full booking state diagram with `validTransitions` code


# System Flows

All major end-to-end flows through the DriveBook platform. Each flow shows the sequence of system actions, the entities involved, and what gets recorded.

---

## 1. Booking → Payment → Completion → Payout

There are two distinct booking creation paths:

**Path A — Instructor creates booking (wallet payment):**
```
1. Instructor opens booking form (/dashboard/bookings/new)
2. POST /api/bookings → Booking created (CONFIRMED directly, no PENDING_PAYMENT)
   └─ Wallet debited atomically in same transaction
   └─ Transaction created (BOOKING_PAYMENT, COMPLETED)
3. Lesson occurs
4. Admin marks booking COMPLETED (/admin/bookings)
   └─ PATCH /api/admin/bookings → status: COMPLETED
   └─ AuditLog: BOOKING_COMPLETED
   └─ Transaction becomes payout-eligible after 24h buffer (status stays COMPLETED until payout)
5. Admin processes payout (/admin/payouts)
   └─ POST /api/admin/payouts/process → Payout created, Transaction → SETTLED
   └─ AuditLog: PAYOUT_PAID (Stripe) or PAYOUT_PENDING_TRANSFER (bank)
```

**Path B — Client books via public flow (Stripe payment):**
```
1. Client searches instructors (/book)
2. Client selects slot → POST /api/public/bookings → Booking created (PENDING_PAYMENT)
   └─ Slot held for 10 minutes
3. Client pays via Stripe
   └─ POST /api/payments/create-intent → PaymentIntent created
   └─ Stripe webhook (payment_intent.succeeded) → Booking → CONFIRMED
   └─ Transaction → SETTLED (payout-eligible immediately after 24h buffer)
4. Lesson occurs
5. Admin marks booking COMPLETED → same as Path A steps 4–5
```

AuditLog entries created: `BOOKING_COMPLETED`, `PAYOUT_PAID`

Note: `BOOKING_CREATED` is not currently logged for instructor-created bookings (known gap — low priority).

---

## 2. Cancellation Flow

```
1. Booking cancelled (client, instructor, or admin)
   └─ POST /api/bookings/[id]/cancel
2. Refund calculated via cancellation policy:
   ├─ ≥48h notice → 100% refund
   ├─ 24–48h notice → 50% refund
   └─ <24h notice → 0% refund
   Note: policy applies to min(originalStartTime, currentStartTime)
         to prevent reschedule-then-cancel exploit
3. Single atomic transaction:
   ├─ Wallet credited (if refund > 0)
   ├─ Booking → CANCELLED
   └─ Transaction → CANCELLED (not REFUNDED — REFUNDED is only for dispute resolutions)
4. AuditLog: BOOKING_CANCELLED (includes refundPercentage, refundAmount, cancelledBy)
5. Email sent to client and instructor
```

Note: If instructor has already been paid, refund requires SUPER_ADMIN override and creates a `REFUND_AFTER_PAYOUT` audit entry.

---

## 3. No-Show Flow

```
1. Admin marks booking as NO_SHOW (/admin/bookings)
   └─ Admin selects responsible party: instructor / client / both
2. PATCH /api/admin/bookings → status: NO_SHOW
   └─ booking.noShowParty = 'instructor' | 'client' | 'both' (proper field)
   └─ Transaction description tagged for backward compat: [INSTRUCTOR_NO_SHOW] etc.
3. AuditLog: BOOKING_NO_SHOW (includes noShowParty)
4. Booking appears in Payouts admin:
   ├─ noShowParty = 'client' → Withheld tab (instructor may still be paid)
   ├─ noShowParty = 'instructor' → Withheld tab (client should be refunded)
   └─ noShowParty = 'both' → Disputes tab (manual resolution required)
5. Admin resolves via Payouts → Withheld or Disputes tab
```

---

## 4. Dispute Flow

```
1. Dispute raised:
   ├─ Stripe chargeback → webhook triggers dispute flag
   └─ Manual admin action (/admin/payouts → dispute)
2. Payout placed on hold
   └─ POST /api/admin/payouts/[payoutId]/hold
   └─ AuditLog: PAYOUT_HELD
3. Admin investigates via Audit Log + booking detail
4. Admin resolves:
   ├─ Full refund → POST /api/admin/payouts/resolve (action: refund)
   ├─ Approve for payout → POST /api/admin/payouts/resolve (action: approve_for_payout)
   └─ Split → POST /api/admin/payouts/resolve-split (atomic DB transaction)
              resolutionGroupId links all related entries in AuditLog
5. AuditLog: DISPUTE_RESOLVED with resolution metadata
```

---

## 5. Reconciliation Flow (Daily Cron)

```
1. GET /api/cron/reconcile-stripe runs at 19:00 UTC (03:00 AWST)
   └─ Concurrency lock prevents double-run
2. Three checks performed:
   ├─ Check 1: Stripe payment_intent.succeeded events with no corresponding LedgerEntry(PAYMENT_COLLECTED)
   ├─ Check 2: PAID payouts with stripeTransferId not found in Stripe
   └─ Check 3: Payouts stuck in PROCESSING >10 minutes (not 24h — threshold is `STUCK_THRESHOLD_MINUTES = 10`)
3. Results stored in ReconciliationReport (DB)
4. If any issues found:
   └─ Alert email sent via alert-service
5. Admin reviews /admin/audit-log for RECONCILIATION_ISSUE entries
6. Manual resolution if needed (admin creates adjustment transaction)
```

---

## 6. ABN Verification Flow

```
1. Instructor submits ABN in payout settings (/dashboard/settings/payout)
   └─ POST /api/instructor/payout-settings
2. ABN validated via ABR API (lib/utils/abn-validation.ts)
   ├─ Format check (11 digits, checksum)
   └─ ABR lookup: entity name, status, GST registration
3. Name match scored (Jaccard similarity):
   ├─ ≥0.8 → AUTO_APPROVED (abnVerified: true, withholdingTaxRate: 0)
   ├─ 0.5–0.79 → REVIEW_REQUIRED (admin must manually verify)
   └─ <0.5 → NO_MATCH (abnVerified: false, withholdingTaxRate: 47)
4. Admin can manually verify/revoke:
   └─ POST /api/admin/instructors/[id]/verify-abn
   └─ AuditLog: ABN_VERIFIED or ABN_VERIFICATION_REVOKED
5. Weekly cron (GET /api/cron/recheck-abn, runs Mondays 02:00 AWST) re-validates all active ABNs
   └─ If previously verified ABN is now cancelled → revoke + alert
```

---

## 7. Instructor Onboarding Flow

```
1. Instructor registers (/register)
   └─ User created, Instructor record created (approvalStatus: PENDING)
2. Instructor uploads documents (/dashboard/settings)
3. Admin reviews documents (/admin/documents/review/[instructorId])
   └─ Traffic light per document (valid / expiring / expired)
   └─ Admin sets expiry dates, uploads replacements if needed
   └─ POST /api/admin/documents/instructor/[instructorId]/approve
4. Admin approves instructor (/admin/instructors)
   └─ POST /api/admin/instructors/[id]/approve
   └─ approvalStatus: APPROVED, isVerified: true
   └─ Approval email sent to instructor
5. Instructor configures payout settings + ABN
6. Instructor is live and bookable
```

---

## Related

- [STATE_MACHINES.md](./STATE_MACHINES.md) — Valid transitions for each entity
- [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) — Where each data point lives
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Financial rules governing flows 2, 3, 4


# System of Record

For every domain, there is exactly one authoritative source of truth. When data conflicts, this table resolves it.

---

## Authoritative Sources

| Domain | Source of Truth | Notes |
|--------|----------------|-------|
| Bookings | `Booking` collection (MongoDB) | Status, timing, participants |
| Payments | Stripe + `Transaction` collection | Stripe is authoritative for payment status; Transaction is authoritative for platform accounting |
| Client wallet balance | `ClientWallet.balance` | Derived from `WalletTransaction` sum — reconciled daily |
| Instructor earnings | `Transaction.instructorPayout` sum | Not stored as a running total — always computed |
| Payouts | `Payout` + `PayoutTransaction` collections | Payout system is authoritative for what has been paid |
| Commission rates | `PlatformSettings` (DB) | Never stored on `Instructor` — always fetched at payment time |
| Withholding tax rate | `Instructor.withholdingTaxRate` | Set by ABN verification status — 0% or 47% |
| ABN status | `Instructor.abnVerified` + `Instructor.abnStatus` | Set by ABR API or admin manual override |
| Document compliance | `Instructor` document fields + `workingHours.expiry` | Expiry dates stored in `workingHours` JSON |
| Audit history | `AuditLog` collection | Immutable — never updated, only appended |
| Reconciliation results | `ReconciliationReport` collection | Written by daily cron |
| Platform settings | `PlatformSettings` (DB) | Single record — managed via `/admin/settings` |
| Subscription status | `Instructor.subscriptionTier` + Stripe subscription | Stripe is authoritative for billing; DB mirrors for fast reads |

---

## What Is NOT Authoritative

| What | Why |
|------|-----|
| `Instructor.commissionRate` | Does not exist — always derived from `PlatformSettings` |
| `Instructor.newStudentBonus` | Does not exist — always derived from `PlatformSettings` |
| UI-displayed balances | Always fetched from DB — never cached client-side for financial decisions |
| Stripe metadata | Informational only — DB is authoritative for platform state |

---

## Conflict Resolution

If data conflicts between two sources:

1. Stripe vs Transaction: Stripe wins for payment status. Run reconciliation to sync.
2. Wallet balance vs WalletTransaction sum: WalletTransaction sum wins. Correct `balance` via admin adjustment.
3. AuditLog vs other sources: AuditLog is the historical record — it does not override current state, but it explains how current state was reached.
4. PlatformSettings vs hardcoded defaults: PlatformSettings wins if a record exists. Hardcoded defaults are fallback only.

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — How data moves between sources
- [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) — How consistency is enforced
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Ledger reconstruction and reconciliation


# System Overview

**Platform:** drivebook.com.au  
**Governing Law:** Western Australia  
**Timezone:** Australia/Perth (AWST, UTC+8)  
**Stack:** Next.js 14, PostgreSQL (Supabase), Prisma, Stripe, Vercel

---

## What DriveBook Is

DriveBook is a controlled operational and financial platform connecting driving instructors with learner drivers. It is not a simple booking app — it is a system with:

- Explicit state machines for all entities
- A ledger-based financial layer (every dollar tracked)
- Full audit trail on all critical actions
- Admin as the single control authority
- Automated reconciliation and alerting

---

## Core Principles

| Principle | What It Means |
|-----------|---------------|
| Admin is the source of control | All entity lifecycle transitions go through admin APIs |
| Ledger is the source of financial truth | No balance is stored without a corresponding transaction |
| AuditLog is the source of accountability | Every critical action is logged with actor, target, and metadata |
| APIs are the only mutation layer | No direct DB writes from UI — all changes go through route handlers |
| No silent state changes | Every transition is explicit, logged, and reversible only via admin |

---

## System Domains

| Domain | Responsibility |
|--------|---------------|
| Bookings | Lifecycle from creation to completion or cancellation |
| Payments | Stripe capture, wallet debit, transaction recording |
| Payouts | Instructor earnings calculation, withholding, transfer |
| Wallet | Client credit balance — internal payment method |
| Compliance | Instructor document verification and ABN status |
| Audit | Immutable log of all critical system actions |
| Reconciliation | Daily automated check of ledger vs Stripe vs DB |
| Alerting | Email notifications for financial and compliance failures |

---

## Roles

| Role | Access |
|------|--------|
| PUBLIC | Browse instructors, initiate booking |
| CLIENT | Book lessons, manage wallet, view history |
| INSTRUCTOR | Manage bookings, view earnings, configure profile |
| ADMIN | Full operational control — all pages, all actions |
| SUPER_ADMIN | Admin + system overrides (financial safeguard bypass) |

---

## Key Constraints

- `commissionRate` and `newStudentBonus` are never stored on `Instructor` — always derived from `PlatformSettings`
- `withholdingTaxRate` is set by ABN verification status: verified = 0%, unverified = 47%
- Transactions are immutable — no updates, only new adjustment records
- Refund after payout requires SUPER_ADMIN and creates an audit entry
- Payout requires 24-hour buffer after booking completion
- All cron jobs use concurrency locks to prevent double-execution

---

## Related

- [SYSTEM_FLOWS.md](./SYSTEM_FLOWS.md) — End-to-end flows for all major scenarios
- [STATE_MACHINES.md](./STATE_MACHINES.md) — All entity state diagrams
- [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) — Authoritative data sources per domain
- [CONTROL_GUARANTEES.md](./CONTROL_GUARANTEES.md) — What the system guarantees and how
- [FAILURE_HANDLING.md](./FAILURE_HANDLING.md) — How failures are detected and resolved
- `docs/00-foundation/FINANCIAL_DOCTRINE.md` — Deep financial rules and ledger reconstruction
