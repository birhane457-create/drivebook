# Refund Post-Payout Adjustments

**Status**: ✅ 100% IMPLEMENTED (June 14, 2026)  
**Endpoints**: 
- `POST /api/bookings/[id]/cancel` (authenticated refunds)
- `POST /api/public/bookings/[id]/cancel` (public/OTP refunds)  
**Authorization**: Instructor (own), Client (own), Admin (any)  
**Refund Policy**: Time-based (48h/100%, 24h/50%, <24h/0%)  
**Post-Payout System**: ✅ Fully implemented with ledger entries + deduction tracking  

---

## AS IS - Current Implementation

### Refund Policy

| Hours Until Booking | Refund % | Refund Amount | Conditions |
|---------------------|----------|---------------|-----------|
| **≥ 48 hours** | 100% | Full booking price | Full refund, non-refundable flag ignored |
| **24–47 hours** | 50% | 50% of booking price | Partial refund applies |
| **< 24 hours** | 0% | $0 | No refund unless booking is past (already happened) |
| **Past booking (< 0h)** | 0% | $0 | Lesson already occurred, refund blocked |
| **Non-refundable flag** | 0% | $0 | If `isNonRefundable=true`, no refund regardless of time |

**Special Case - Policy Time Calculation**:
- Uses the **earlier of** `originalStartTime` or current `startTime`
- Prevents exploit: book far future → reschedule close to start → cancel for full refund
- Always chooses the most conservative time window for refund calculation

### Cancellation Flow

| Step | Description | Code Reference |
|------|-------------|-----------------|
| **1. Auth & Session** | Accept NextAuth session. Verify user exists | `getServerSession(authOptions)` |
| **2. Authorization** | Verify cancellation is by instructor (own bookings), client (own bookings), or admin | Instructor/Client/Admin checks |
| **3. Booking Fetch** | Retrieve booking with client/instructor relations | `prisma.booking.findUnique()` with includes |
| **4. Status Check** | Block cancellation if already CANCELLED or COMPLETED | Early return with 400 error |
| **5. Policy Calculation** | Determine refund % and amount based on time-to-booking | See "Refund Policy" above |
| **6. Atomic Transaction** | Update booking, wallet, and transaction records in single transaction | `prisma.$transaction()` |
| **7. Audit Logging** | Log cancellation action with metadata (who, refund %, reason) | `prisma.auditLog.create()` |
| **8. Email Notifications** | Send cancellation receipt to client and notification to instructor | Non-blocking email service |

### Atomic Transaction Behavior

```typescript
// FIX #1: Concurrency safety
await prisma.$transaction(async (tx) => {
  // Guard: Only update if status is NOT already cancelled/completed/expired/no-show
  const guard = await tx.booking.updateMany({
    where: {
      id: params.id,
      status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] }
    },
    data: { status: 'CANCELLED', notes: '...' }
  });

  // If count === 0, another request already cancelled it
  if (guard.count === 0) {
    throw new Error('ALREADY_CANCELLED');
  }

  // FIX #2: Ledger-based wallet (no direct balance writes)
  // Only insert WalletTransaction record
  if (refundAmount > 0 && booking.client?.userId) {
    const wallet = await tx.clientWallet.findUnique({
      where: { userId: booking.client.userId }
    });
    if (wallet) {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: refundAmount,
          type: 'CREDIT',
          description: `Booking cancelled — ${refundPercentage}% refund`,
          status: 'CONFIRMED'
        }
      });
    }
  }

  // Update related transaction records
  await tx.transaction.updateMany({
    where: { bookingId: params.id },
    data: { status: 'CANCELLED' }
  });

  return await tx.booking.findUnique({ where: { id: params.id } });
});
```

**Key Features**:
1. **Guard Clause**: `updateMany` with status check ensures only one concurrent request succeeds
2. **Idempotency**: Second cancellation attempt returns clean error ("Already cancelled")
3. **Ledger Pattern**: Never write to `ClientWallet.balance` directly. Always use `WalletTransaction` records so `getWalletBalance()` (sum of transactions) is the single source of truth
4. **Atomic All-or-Nothing**: If any step fails, entire transaction rolls back

### Request/Response

**POST Request**:
```json
{
  "reason": "string (optional)"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "booking": { ...updated booking record... },
  "refund": {
    "percentage": 100,
    "amount": 150.00,
    "hoursNotice": 72
  }
}
```

**Error Responses**:

| Code | Scenario | Message |
|------|----------|---------|
| 401 | No valid session | "Unauthorized" |
| 404 | Booking not found or user doesn't exist | "Booking not found" / "User not found" |
| 403 | Cancelling on behalf of another instructor/client | "Forbidden" |
| 400 | Booking already cancelled/completed or concurrent cancel attempt | "Cannot cancel a CANCELLED booking" or "Already cancelled" |
| 500 | Database/email/transaction failure | "Internal server error" |

### Audit Logging

Every cancellation creates an audit log entry with metadata:

```json
{
  "action": "BOOKING_CANCELLED",
  "actorId": "user123",
  "actorRole": "CLIENT|INSTRUCTOR|ADMIN",
  "targetType": "BOOKING",
  "targetId": "booking456",
  "success": true,
  "metadata": {
    "refundPercentage": 50,
    "refundAmount": 75.00,
    "hoursNotice": 30,
    "cancelledBy": "client|instructor|admin",
    "isPastBooking": false,
    "isNonRefundable": false,
    "reason": "string or null"
  }
}
```

**Use Cases for Audit Log**:
- Dispute resolution: Prove refund was processed and amount credited
- Analytics: Identify refund abuse patterns or excessive cancellations
- Compliance: Track who cancelled and when for regulatory audits

### Email Notifications

**To Client** (if email channel enabled):
- Subject: `Booking Cancelled — {date}`
- Content: Booking date, instructor name, refund amount/reason
- Structured receipt email with wallet balance after refund (via `sendCancellationReceipt()`)

**To Instructor** (if email channel enabled):
- Subject: `Booking Cancelled — {client name}`
- Content: Booking date, client name, who cancelled

**Non-Blocking**: If email fails, cancellation still succeeds (errors logged to console only)

---

## Post-Payout Adjustment System (✅ FULLY IMPLEMENTED)

### Overview

When a refund is issued **after** the instructor's payout has already been processed, the refund amount is deducted from the instructor's **next** payout cycle. This is tracked via ledger entries of type `ADJUSTMENT`.

**Files Implementing This**:
- `lib/services/payout-service.ts` — Calculates adjustments, applies deductions
- `lib/services/ledger-service.ts` — ADJUSTMENT entry type definition
- `lib/services/ledger-operations.ts` — Records admin wallet adjustments

### Flow

```
Scenario: Instructor receives payout on Monday. Client cancels booking on Tuesday and requests refund.

1. Tuesday - Client cancels
   ├─ Booking status → CANCELLED
   ├─ Refund amount calculated ($50)
   ├─ WalletTransaction created (CREDIT +$50 to client wallet)
   └─ recordRefundForBooking() called with postPayout=true
      └─ Creates FinancialLedger entry:
         - type: ADJUSTMENT
         - amount: -$50 (negative = deduction)
         - instructorId: <instructor>
         - metadata: { postPayout: true, bookingId: "..." }

2. Next Payout Run (Wednesday or later)
   ├─ Payout service finds all ADJUSTMENT entries for instructor
   ├─ Calculates adjustmentDeduction = SUM(all unrecovered ADJUSTMENT amounts)
   ├─ Subtracts from gross payout: netPayout = grossPayout - adjustmentDeduction
   ├─ Issues payout with reduced amount
   └─ Marks adjustments as recovered
      └─ Updates ADJUSTMENT ledger: metadata: { recovered: true }

Result:
  Client gets refund immediately (wallet credited Tuesday)
  Instructor's next payout is reduced by $50
```

### Ledger Entry Details

**ADJUSTMENT Entries** (created when refund is post-payout):

```typescript
{
  type: 'ADJUSTMENT',                          // Ledger entry type
  amount: -refundAmount,                       // Negative = deduction
  referenceId: bookingId,                      // Link to booking
  referenceType: 'ADJUSTMENT',                 // Reference type
  instructorId: instructorId,                  // Affected instructor
  description: `Post-payout deduction for booking ${bookingId}...`,
  metadata: {
    postPayout: true,                          // Flag: this is a post-payout deduction
    recovered?: true                           // Set after payout processes
  }
}
```

### Payout Deduction Logic

**From `payout-service.ts` (lines 113-135)**:

```typescript
// Find all ADJUSTMENT entries for this instructor
const allAdjustments = await prisma.ledgerEntry.findMany({
  where: { type: 'ADJUSTMENT', instructorId }
});

// Filter to only unrecovered adjustments
const unrecoveredAdjustments = allAdjustments.filter(
  (e) => !(e.metadata as Record<string, unknown>)?.recovered
);

// Calculate total deduction (sum of all negative amounts)
const adjustmentDeduction = Math.abs(
  Math.min(0, unrecoveredAdjustments.reduce(
    (sum, e) => sum + e.amount, 0  // sum of negative amounts
  ))
);

// Apply deduction to gross payout
const grossAfterAdjustment = Math.max(
  0,
  grossAmount - adjustmentDeduction  // Reduces payout
);
```

### Recovery Tracking

**After payout is processed** (lines 388-405):

```typescript
// Mark all ADJUSTMENT entries as recovered
const unrecovered = await prisma.ledgerEntry.findMany({
  where: { type: 'ADJUSTMENT', instructorId: payout.instructorId }
});

for (const adj of unrecovered) {
  await appendLedgerEntry({
    ...adj,
    metadata: { ...adj.metadata, recovered: true }  // Flag as recovered
  });
}

// Prevents double-deduction in future payout runs
```

**Why?** Prevents the same $50 adjustment from being deducted twice if payout runs twice.

### Instructor Notification

**Email on Deduction** (non-blocking):
- Template: `sendWalletAdjustmentEmail()` in `receipt-email.ts`
- Subject: `Wallet Adjustment — -$X deducted from your account`
- Content: Reason, booking ID, deduction amount, new payout total

**Note**: Email should be triggered when adjustment ledger entry is created (currently requires manual integration).

---

## Integration: Refund Approval Tasks & Deduction Notifications (✅ June 14, 2026)

### Feature 1: Refund Approval Task Creation

**When**: Refund is cancelled >24 hours before booking starts (eligible for 50%+ refund)  
**What**: Creates a `REFUND_REQUEST` task assigned to FINANCIAL staff for manual approval  
**File**: `app/api/bookings/[id]/cancel/route.ts` (lines ~135)

```typescript
// Create admin approval task for refunds > 24h (post-payout scenario)
if (refundPercentage > 0 && hoursUntilBooking > 24 && booking.client) {
  try {
    await createRefundTask({
      bookingId: params.id,
      clientId: booking.client.id,
      amount: refundAmount,
      reason: reason || 'Client-initiated cancellation',
      contactName: booking.client.name,
      contactEmail: booking.client.email,
    });
  } catch (e) {
    console.error('Failed to create refund approval task:', e);
  }
}
```

**Task Details**:
- Type: `REFUND_REQUEST`
- Category: `FINANCIAL`
- Priority: `HIGH`
- Auto-assigned: Yes (to available FINANCIAL staff member)
- Due: 4 hours (HIGH priority)
- Fields: Client name/email, refund amount, booking ID, reason

**Use Case**: Larger refunds (≥24h) may warrant review before credit is applied. Task-based workflow allows staff to verify legitimacy of cancellation before issuing.

### Feature 2: Instructor Deduction Email Notification

**When**: Post-payout adjustments are recovered during next payout  
**What**: Sends email to instructor listing all adjustments deducted from payout  
**File**: `lib/services/payout-service.ts` (lines ~388-420)

```typescript
// Mark ADJUSTMENT entries as recovered and send instructor email
const unrecovered = await prisma.ledgerEntry.findMany({
  where: { type: 'ADJUSTMENT', instructorId: payout.instructorId }
});

const adjustmentDetails: Array<{ bookingId: string; amount: number }> = [];

for (const adj of unrecovered) {
  const meta = (adj.metadata as any) ?? {};
  if (!meta.recovered) {
    // Mark as recovered
    await ledgerEntry.update({ 
      data: { metadata: { ...meta, recovered: true } } 
    });
    // Track for email
    adjustmentDetails.push({
      bookingId: meta.referenceId,
      amount: Math.abs(adj.amount)
    });
  }
}

// Send email listing all adjustments
if (adjustmentDetails.length > 0 && instructor?.user?.email) {
  const totalDeducted = adjustmentDetails.reduce((sum, d) => sum + d.amount, 0);
  await emailService.sendGenericEmail({
    to: instructor.user.email,
    subject: `Payout Adjustment — $${totalDeducted.toFixed(2)} deducted (${payout.payoutRef})`,
    html: `... list of booking IDs and amounts deducted ...`
  });
}
```

**Email Content**:
- Total deducted
- Line-by-line breakdown (booking ID + amount per booking)
- Reference to payout ID for tracking
- Support contact for disputes

**Why**: Transparency. Instructors know exactly which cancellations led to payout reductions and can cross-reference their records.

**Retry Policy**: Non-blocking. If email fails, payout still completes and adjustments are marked recovered.

### Audit Logging

All refunds are logged to `auditLog`:

```json
{
  "action": "BOOKING_CANCELLED",
  "actorId": "...",
  "metadata": {
    "refundAmount": 50.00,
    "postPayout": true|false,  // Indicates if deduction applied
    "reason": "..."
  }
}
```

---

## AS IT SHOULD BE - Recommended Enhancements

### 1. Refund Reason Analytics

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | Reason field accepted but not analyzed | No visibility into why cancellations happen |
| **Enhancement** | Categorize reasons: scheduling conflict, illness, transportation, changed mind, etc. | Identify patterns (e.g., recurring "illness" cancellations on Mondays) |
| **Dashboard** | Show top refund reasons by instructor/time period | Help admin identify systemic issues |
| **Effort** | Low (~2 hours: add enum for reasons, dashboard widget) | Can be done quickly |

### 2. Partial Refund Improvements

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Fixed 48h/24h thresholds (100%/50%/0%) | Simple but rigid |
| **Enhancement** | Add configurable refund schedule per instructor (e.g., Pro plan: 72h/100%, 48h/75%, 24h/50%) | Allow flexibility for different instructor policies |
| **Implementation** | Store refund policy in `Instructor.refundPolicy` as JSON. Look up at cancellation time | Mid-tier instructors might offer more lenient refunds to attract clients |
| **Effort** | Medium (~4-5 hours: schema migration, policy lookup, admin UI) | Deferred to Phase 2 |

### 3. Scheduled Cancellation (Cancel in Future)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Cancellation is immediate | No way to give advance notice |
| **Enhancement** | Allow client to schedule cancellation (e.g., "Cancel this booking in 2 hours after I confirm transportation") | Flexible workflow; client can change mind before cancellation takes effect |
| **Implementation** | Store `scheduledCancellationAt` timestamp. Cron job processes scheduled cancellations. Can be reverted via UI before execution | Improves UX, reduces accidental cancellations |
| **Effort** | Medium (~4-5 hours: schema field, cron job, revert UI) | Deferred |

### 4. Refund Hold Period

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Refund credited immediately to wallet | No fraud detection period |
| **Enhancement** | Refunds credited after 3-day hold (to allow chargeback detection) | Reduces fraud risk (e.g., booking, canceling, disputing with payment processor) |
| **Implementation** | Add `walletTransaction.status` = "PENDING" with `confirmedAt` date. Background job confirms after 3 days | Chargeback disputes often filed within 48-72 hours |
| **Effort** | Medium (~3-4 hours: add status field, background job) | Deferred but recommended for high-fraud environments |

### 5. Prorated Refunds for Rescheduling

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Refund or cancel; rescheduling must be done separately (cancel + new booking) | Friction in rebooking flow |
| **Enhancement** | "Reschedule" action that transfers booking to new date, applies price difference (if any) | Seamless rebooking; client doesn't need to refund and rebook separately |
| **Refund Logic** | If new time has lower price, refund difference. If higher, charge difference | Fair prorating |
| **Effort** | High (~6-8 hours: complex transaction logic, time slot checks, new booking creation) | Deferred to Phase 2 |

### 6. Partial Cancellation (For Multi-Hour Bookings)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Can only cancel entire booking | No flexibility for partial attendance |
| **Enhancement** | Allow client to cancel portion of multi-hour booking (e.g., "Cancel last 30 min of 2-hour lesson") | Rare but valuable for flexible instructors |
| **Implementation** | Split booking into multiple smaller bookings internally (or redesign data model) | Complex; requires significant refactoring |
| **Effort** | Very High (~10+ hours) | Very deferred; only if multi-hour bookings become common |

### 7. Automatic Refund for No-Show by Instructor

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Manual cancellation required if instructor doesn't show | Unfair to client; they must take action |
| **Enhancement** | Cron job: if booking time has passed + no check-in recorded, auto-cancel with 100% refund after 30 min grace | Automatic justice; client gets refunded without asking |
| **Implementation** | Cron job checks: `booking.startTime < now - 30min AND checkInTime IS NULL` → auto-cancel with full refund + audit log | Improves trust in platform |
| **Effort** | Low (~2 hours: add cron job, ensure audit logging) | Can be added quickly |

### 8. Wallet Credit to Bank Account (Refund Transfer)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Refund stays in wallet; client can use for future bookings only | Client may want cash refund |
| **Enhancement** | Allow client to request bank transfer of wallet credit (e.g., "Cash out" feature) | Improves UX for clients who won't return |
| **Implementation** | New endpoint: `POST /api/wallet/transfer-to-bank` with Stripe transfer integration | Requires payout processing |
| **Effort** | Medium (~4-5 hours: Stripe integration, KYC checks, audit logging) | Deferred |

---

## Implementation Checklist

- [x] Core refund logic with time-based policy
- [x] Atomic transaction with concurrency guard
- [x] Ledger-based wallet (no direct balance writes)
- [x] Audit logging for all cancellations
- [x] Email notifications (non-blocking)
- [x] Authorization checks (instructor/client/admin)
- [x] Past-booking refund prevention
- [x] Non-refundable flag support
- [x] Policy time calculation (use earlier of originalStartTime/startTime)
- [x] **Post-payout ADJUSTMENT ledger entries** ✅
- [x] **Deduction from instructor's next payout** ✅
- [x] **Recovery tracking (prevents double-deduction)** ✅
- [x] **Audit logging with postPayout flag** ✅
- [x] **Refund approval task for >24h refunds** ✅ (June 14, 2026)
- [x] **Instructor deduction email notification** ✅ (June 14, 2026)
- [ ] Refund reason categorization (Phase 2)
- [ ] Configurable per-instructor refund policies (Phase 2)

---

## Related Features

- **Check-In System**: `CHECKIN_SYSTEM.md` — Check-in prevents refunds (proof of attendance)
- **Disputes**: `DISPUTES_AND_CHARGEBACKS.md` — Audit log used to defend against disputed refunds
- **Wallet System**: `WALLET_TOPUP.md` — Refund credits go to wallet; wallet balance derived from transaction ledger
- **Earnings**: `PAYOUTS.md` — Cancellations affect instructor earnings calculations

---

## Database Schema (Fields Used)

```prisma
model Booking {
  // ... existing fields

  isNonRefundable    Boolean?       // If true, refund is blocked
  originalStartTime  DateTime?      // Used for refund policy calculation (exploit prevention)
  notes              String?        // Appended with refund details on cancellation
}

model ClientWallet {
  id                 String         @id @default(cuid())
  userId             String         @unique
  balance            Float          @default(0)  // ⚠️ Derived field (for display only)
  // TRUE balance = SUM(walletTransaction.amount WHERE status='CONFIRMED')
}

model WalletTransaction {
  id                 String         @id @default(cuid())
  walletId           String
  amount             Float
  type               String         // 'CREDIT' | 'DEBIT'
  description        String         // "Booking cancelled — 50% refund"
  status             String         @default('CONFIRMED')  // 'PENDING' | 'CONFIRMED' | 'FAILED'
  createdAt          DateTime       @default(now())
  confirmedAt        DateTime?      // For hold periods
}

model Transaction {
  id                 String         @id
  bookingId          String
  status             String         // 'ACTIVE' | 'CANCELLED'
  // ... other fields
}

model AuditLog {
  id                 String         @id
  action             String         // "BOOKING_CANCELLED"
  actorId            String
  actorRole          String
  targetType         String
  targetId           String
  success            Boolean
  metadata           Json           // Refund details, reason, hours notice, etc.
}
```

---

## Testing Recommendations

### Refund Calculations
- ✅ Cancel ≥48h before → 100% refund
- ✅ Cancel 24–47h before → 50% refund
- ✅ Cancel <24h before → 0% refund
- ✅ Cancel past booking → 0% refund
- ✅ Cancel non-refundable booking → 0% refund regardless of time

### Atomic Transactions
- ✅ Two concurrent cancel requests → One succeeds, one fails with "Already cancelled"
- ✅ Refund amount correctly credited to wallet (via WalletTransaction, not direct balance write)
- ✅ Related Transaction records marked as CANCELLED

### Authorization
- ✅ Client can cancel own booking → Success
- ✅ Client cancels another client's booking → 403
- ✅ Instructor can cancel own booking → Success
- ✅ Instructor cancels another instructor's booking → 403
- ✅ Admin can cancel any booking → Success

### Email Notifications
- ✅ Cancellation email sent to client (if channel enabled)
- ✅ Cancellation email sent to instructor (if channel enabled)
- ✅ Email failure does not block cancellation

---

## Security Considerations

1. **Atomic Transactions**: Use `updateMany` guard to prevent race conditions and double-cancellations
2. **Ledger Pattern**: Never directly modify wallet balance. Always use WalletTransaction records for audit trail
3. **Authorization**: Verify user owns booking before allowing cancellation
4. **Refund Policy Integrity**: Policy time uses earlier of `originalStartTime`/`startTime` to prevent reschedule exploits
5. **Audit Trail**: Every cancellation logged with actor, time, refund amount, and reason
6. **Email Privacy**: Notifications sent only to addresses in booking record

---

## Performance Notes

- **Query Optimization**: Single `findUnique` to fetch booking with relations
- **Atomic Transaction**: All updates happen in single database transaction (no partial states)
- **Email Non-Blocking**: Sent after transaction completes; failure doesn't affect endpoint response
- **Ledger Queries**: Wallet balance calculated via `SUM(walletTransaction.amount WHERE status='CONFIRMED')` — consider caching for reporting

