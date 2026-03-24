# System Flows

All major end-to-end flows through the DriveBook platform. Each flow shows the sequence of system actions, the entities involved, and what gets recorded.

---

## 1. Booking → Payment → Completion → Payout

```
1. Client searches instructors (/book)
2. Client selects slot and submits booking form
3. POST /api/bookings → Booking created (PENDING_PAYMENT)
   └─ Slot held for 10 minutes
4. Client pays via Stripe or wallet
   ├─ Stripe: POST /api/payments/create-intent → PaymentIntent created
   │          Stripe webhook (payment_intent.succeeded) → Booking → CONFIRMED
   │          Transaction created (BOOKING_PAYMENT, COMPLETED)
   └─ Wallet: POST /api/bookings/[id]/confirm → Wallet debited atomically
              Booking → CONFIRMED, Transaction created
5. Lesson occurs
6. Admin marks booking COMPLETED (/admin/bookings)
   └─ POST /api/admin/bookings → status: COMPLETED
   └─ Transaction becomes payout-eligible (after 24h buffer)
7. Admin processes payout (/admin/payouts)
   └─ POST /api/admin/payouts/process → Payout created
   └─ POST /api/admin/payouts/resolve (action: approve_for_payout) → Transaction → SETTLED
   └─ AuditLog: APPROVE_FOR_PAYOUT
8. Stripe Connect transfer (if configured) or manual bank transfer
   └─ AuditLog: PAYOUT_PAID
```

AuditLog entries created: `BOOKING_CREATED`, `BOOKING_CONFIRMED`, `BOOKING_COMPLETED`, `APPROVE_FOR_PAYOUT`, `PAYOUT_PAID`

---

## 2. Cancellation Flow

```
1. Booking cancelled (client, instructor, or admin)
   └─ POST /api/bookings/[id]/cancel
2. Refund calculated via cancellation policy:
   ├─ ≥48h notice → 100% refund
   ├─ 24–48h notice → 50% refund
   └─ <24h notice → 0% refund
3. Refund transaction created (type: REFUND, negative amount)
   └─ Linked to original transaction via parentTransactionId
4. Wallet credited (if wallet booking) or Stripe refund issued
5. Booking → CANCELLED
6. AuditLog: BOOKING_CANCELLED, REFUND_ISSUED
```

Note: If instructor has already been paid, refund requires SUPER_ADMIN override and creates a `REFUND_AFTER_PAYOUT` audit entry.

---

## 3. No-Show Flow

```
1. Admin marks booking as NO_SHOW (/admin/bookings)
   └─ Admin selects responsible party: CLIENT / INSTRUCTOR / DISPUTED
2. Transaction tagged accordingly:
   ├─ CLIENT_NO_SHOW → client forfeits payment, instructor may still be paid
   ├─ INSTRUCTOR_NO_SHOW → client refunded, instructor not paid
   └─ DISPUTED → routed to dispute resolution
3. Payout adjusted based on no-show party
4. AuditLog: NO_SHOW_MARKED with metadata (party, bookingId)
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
   ├─ Check 1: Completed bookings with no transaction record
   ├─ Check 2: SETTLED transactions with no Stripe transfer
   └─ Check 3: Payouts stuck in PROCESSING >24h
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
5. Daily cron (GET /api/cron/recheck-abn) re-validates all active ABNs
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
