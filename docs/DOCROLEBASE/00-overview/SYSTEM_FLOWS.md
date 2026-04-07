# System Flows

All major end-to-end flows through the DriveBook platform. Each flow shows the sequence of system actions, the entities involved, and what gets recorded.

---

## 1. Booking → Payment → Completion → Payout

There are two distinct booking creation paths:

**Path A — Instructor creates booking (wallet payment):**
```
1. Instructor opens booking form (/dashboard/bookings/new)
2. POST /api/bookings

   Path A1 — Client has account + sufficient wallet balance:
   └─ Booking created (CONFIRMED directly, no PENDING_PAYMENT)
   └─ Wallet debited atomically in same transaction
   └─ Transaction created (BOOKING_PAYMENT, COMPLETED)
   └─ Receipt email sent to student

   Path A2 — Client has no DriveBook account (client.userId is null):
   └─ Booking created (PENDING_PAYMENT, no wallet deduction)
   └─ "Claim your account" email sent to student with registration link
   └─ Student registers → tops up wallet → confirms booking from dashboard

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

AuditLog entries created: `BOOKING_CREATED` (instructor), `BOOKING_COMPLETED`, `PAYOUT_PAID`

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
