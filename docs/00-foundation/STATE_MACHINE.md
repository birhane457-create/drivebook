# STATE MACHINE

**Purpose**: Define booking state transitions and rules  
**Owner**: Founder  
**Last Updated**: March 4, 2026  
**Scope**: Booking lifecycle and state control  

---

## NON-NEGOTIABLE RULES

1. **No state skipping** - Must follow progression
2. **No silent transitions** - All changes logged
3. **Frozen after start** - No edits after startTime
4. **One-way to CANCELLED** - Cannot reactivate
5. **PAID blocks refund** - Except admin override

---

## STATE DIAGRAM

```
┌─────────┐
│ PENDING │ (Booking created, payment not confirmed)
└────┬────┘
     │
     ├──→ CANCELLED (Payment timeout/failure)
     │
     ↓
┌─────────────────┐
│ PENDING_PAYMENT │ (Awaiting manual payment / payment link sent)
└────────┬────────┘
         │
         ├──→ CANCELLED
         │
         ↓
┌───────────┐
│ CONFIRMED │ (Payment received, lesson scheduled)
└─────┬─────┘
      │
      ├──→ CANCELLED (Client/instructor cancels)
      │
      ↓
┌───────────┐
│ COMPLETED │ (Lesson finished, check-out done)
└─────┬─────┘
      │
      └──→ CANCELLED (Admin override only)

┌─────────┐
│ EXPIRED │ (Booking passed without completion)
└─────────┘

┌──────────┐
│ NO_SHOW  │ (Client did not attend)
└──────────┘
```

**Note**: `ELIGIBLE_FOR_PAYOUT`, `PAID`, and `LOCKED` are NOT implemented states. Payout tracking is handled via the `Transaction` model and admin payout routes, not via booking status.

---

## STATE DEFINITIONS

### PENDING
**Meaning**: Booking created but payment not confirmed (Stripe payment initiated)

**Entry Conditions**:
- Public booking form submitted
- Stripe payment initiated
- Slot availability confirmed

**Allowed Actions**:
- Confirm (when payment received)
- Cancel (timeout or payment failure)
- Manual confirm (admin/instructor)

**Blocked Actions**:
- Edit booking details
- Complete booking
- Process payout

**Auto-Transition**:
- To CANCELLED after 30 minutes if unpaid

**Example**:
```typescript
{
  status: 'PENDING',
  isPaid: false,
  paymentIntentId: 'pi_123',
  createdAt: '2026-03-04T10:00:00Z'
}
```

---

### CONFIRMED
**Meaning**: Payment received, lesson scheduled

**Entry Conditions**:
- Payment confirmed (webhook or wallet deduction)
- OR instructor created booking (no payment)
- Slot still available

**Allowed Actions**:
- Edit booking (before startTime)
- Cancel (with refund policy)
- Check-in (at lesson time)
- Complete (after check-in)

**Blocked Actions**:
- Skip to PAID
- Edit after startTime (frozen)

**Transition To**:
- COMPLETED (after check-out)
- CANCELLED (client/instructor cancels)

**Example**:
```typescript
{
  status: 'CONFIRMED',
  isPaid: true,
  paidAt: '2026-03-04T10:05:00Z',
  startTime: '2026-03-10T14:00:00Z'
}
```

---

### PENDING_PAYMENT
**Meaning**: Booking created by instructor, awaiting manual payment or payment link

**Entry Conditions**:
- Instructor creates booking manually
- Payment link sent to client

**Allowed Actions**:
- Confirm (when payment received)
- Cancel

**Blocked Actions**:
- Complete booking

**Transition To**:
- CONFIRMED (payment received)
- CANCELLED

**Example**:
```typescript
{
  status: 'PENDING_PAYMENT',
  isPaid: false,
  createdBy: 'instructor'
}
```

---

### COMPLETED
**Meaning**: Lesson finished, check-out done

**Entry Conditions**:
- Check-in completed
- Check-out completed
- Actual duration recorded

**Allowed Actions**:
- Admin override cancel (rare)

**Blocked Actions**:
- Edit booking
- Client cancel
- Instructor cancel

**Transition To**:
- CANCELLED (admin override only)

**Example**:
```typescript
{
  status: 'COMPLETED',
  checkInTime: '2026-03-10T14:00:00Z',
  checkOutTime: '2026-03-10T15:00:00Z',
  actualDuration: 60
}
```

---

### EXPIRED
**Meaning**: Booking passed its scheduled time without being completed or cancelled

**Entry Conditions**:
- Booking startTime passed
- Status was CONFIRMED but no check-in/check-out occurred

**Allowed Actions**:
- View only
- Admin review

**Transition To**:
- None (terminal state)

**Example**:
```typescript
{
  status: 'EXPIRED',
  startTime: '2026-03-10T14:00:00Z'
}
```

---

### NO_SHOW
**Meaning**: Client did not attend the scheduled lesson

**Entry Conditions**:
- Instructor marks client as no-show
- Lesson time passed

**Allowed Actions**:
- View only
- Admin review

**Transition To**:
- None (terminal state)

**Example**:
```typescript
{
  status: 'NO_SHOW',
  startTime: '2026-03-10T14:00:00Z'
}
```

---

### CANCELLED
**Meaning**: Booking cancelled

**Entry Conditions**:
- Client cancels (with policy)
- Instructor cancels (before start)
- Admin cancels
- Auto-cancel (PENDING timeout)

**Allowed Actions**:
- View only
- Audit review

**Blocked Actions**:
- Reactivate
- Edit
- Complete

**Transition To**:
- None (terminal state)

**Example**:
```typescript
{
  status: 'CANCELLED',
  cancelledAt: '2026-03-08T12:00:00Z',
  cancelledBy: 'client',
  refundAmount: 140.00,
  refundPercentage: 100
}
```

---

## TRANSITION RULES

### Valid Transitions

| From | To | Trigger | Conditions |
|------|----|---------| ----------|
| PENDING | CONFIRMED | Payment received | Webhook success OR wallet deducted |
| PENDING | CANCELLED | Timeout/failure | 30 min passed OR payment failed |
| PENDING_PAYMENT | CONFIRMED | Payment received | Manual payment confirmed |
| PENDING_PAYMENT | CANCELLED | Cancel request | Before startTime |
| CONFIRMED | COMPLETED | Check-out | Check-in done first |
| CONFIRMED | CANCELLED | Cancel request | Before startTime OR admin override |
| CONFIRMED | EXPIRED | Time passed | startTime passed, no check-in |
| CONFIRMED | NO_SHOW | Instructor marks | Client did not attend |
| COMPLETED | CANCELLED | Admin override | Rare, requires reason |
| Any | CANCELLED | Cancel request | Policy-dependent |

### Invalid Transitions

| From | To | Why Invalid |
|------|----| ------------|
| PENDING | COMPLETED | Must confirm first |
| CANCELLED | CONFIRMED | Cannot reactivate |
| EXPIRED | Any | Terminal state |
| NO_SHOW | Any | Terminal state |

---

## TRANSITION VALIDATION

### Code Implementation

```typescript
function validateTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus,
  context: TransitionContext
): ValidationResult {
  
  // Define valid transitions
  const validTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'],
    COMPLETED: ['CANCELLED'],  // CANCELLED only with admin override
    EXPIRED: [],   // Terminal state
    NO_SHOW: [],   // Terminal state
    CANCELLED: []  // Terminal state
  };
  
  // Check if transition is valid
  if (!validTransitions[currentStatus].includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`
    };
  }
  
  // Additional context-based validation
  if (newStatus === 'COMPLETED' && !context.checkInTime) {
    return {
      valid: false,
      error: 'Must check-in before completing'
    };
  }
  
  if (newStatus === 'CANCELLED' && currentStatus === 'PAID') {
    if (!context.isAdmin) {
      return {
        valid: false,
        error: 'Cannot cancel after payout (admin only)'
      };
    }
    if (!context.adminOverrideReason) {
      return {
        valid: false,
        error: 'Admin override requires reason'
      };
    }
  }
  
  return { valid: true };
}
```

---

## FREEZE-AFTER-START RULE

### What Gets Frozen

Once `booking.startTime` passes:

| Action | Before Start | After Start |
|--------|-------------|-------------|
| Edit duration | ✅ Yes | ❌ No |
| Edit price | ✅ Admin only | ❌ No |
| Edit time | ✅ Yes | ❌ No |
| Instructor cancel | ✅ Yes | ❌ No |
| Client cancel | ✅ Yes (policy) | ❌ No |
| Complete booking | ❌ No | ✅ Yes |
| Admin override | ✅ Yes | ✅ Yes (with reason) |

### Implementation

```typescript
function checkFrozen(booking: Booking, action: string, isAdmin: boolean) {
  const now = new Date();
  const isFrozen = now >= booking.startTime;
  
  if (!isFrozen) {
    return { allowed: true };
  }
  
  // After start time
  const allowedActions = ['complete', 'check-in', 'check-out'];
  
  if (allowedActions.includes(action)) {
    return { allowed: true };
  }
  
  if (isAdmin) {
    // Admin can override but must provide reason
    return { 
      allowed: true, 
      requiresReason: true 
    };
  }
  
  return {
    allowed: false,
    error: 'Booking is frozen after start time'
  };
}
```

---

## AUTO-TRANSITIONS

### 1. PENDING → CANCELLED (Timeout)

**Trigger**: Cron job every 5 minutes

**Logic**:
```typescript
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

await prisma.booking.updateMany({
  where: {
    status: 'PENDING',
    createdAt: { lt: thirtyMinutesAgo },
    isPaid: false,
    OR: [
      { paymentIntentId: null },
      { paymentCaptured: false }
    ]
  },
  data: {
    status: 'CANCELLED',
    notes: 'Auto-cancelled - payment not completed within 30 minutes'
  }
});
```

### 2. CONFIRMED → EXPIRED (Timeout)

**Trigger**: Cron job (not yet implemented)

**Logic**:
```typescript
// Bookings that passed their start time without check-in
const expiredBookings = await prisma.booking.findMany({
  where: {
    status: 'CONFIRMED',
    startTime: { lt: new Date() },
    // no check-in recorded
  }
});

for (const booking of expiredBookings) {
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'EXPIRED' }
  });
}
```

---

## STATE CONSISTENCY CHECKS

### Daily Validation

**1. No Orphaned States**
```typescript
// COMPLETED bookings must have transactions
const completedWithoutTx = await prisma.booking.findMany({
  where: {
    status: 'COMPLETED',
    transactions: { none: {} }
  }
});

if (completedWithoutTx.length > 0) {
  ALERT('Completed bookings without transactions');
}
```

**2. No Invalid Combinations**
```typescript
// COMPLETED bookings should have transactions
const completedWithoutTx = await prisma.booking.findMany({
  where: {
    status: 'COMPLETED',
    transactions: { none: {} }
  }
});

if (completedWithoutTx.length > 0) {
  ALERT('COMPLETED bookings without transactions');
}
```

**3. No Stale PENDING**
```typescript
// PENDING older than 1 hour
const stalePending = await prisma.booking.findMany({
  where: {
    status: 'PENDING',
    createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }
  }
});

if (stalePending.length > 0) {
  ALERT('Stale PENDING bookings found');
}
```

---

## AUDIT LOGGING

### Log Every Transition

```typescript
await prisma.auditLog.create({
  data: {
    action: 'BOOKING_STATE_CHANGED',
    actorId: userId,
    actorRole: userRole,
    targetType: 'BOOKING',
    targetId: bookingId,
    metadata: {
      from: oldStatus,
      to: newStatus,
      reason: reason,
      timestamp: new Date()
    }
  }
});
```

### Required Metadata

- **from**: Previous state
- **to**: New state
- **reason**: Why transition occurred
- **actor**: Who triggered it
- **timestamp**: When it happened

---

## ERROR HANDLING

### Invalid Transition Attempt

```typescript
try {
  const validation = validateTransition(
    booking.status,
    newStatus,
    context
  );
  
  if (!validation.valid) {
    // Log attempt
    await prisma.auditLog.create({
      data: {
        action: 'INVALID_STATE_TRANSITION',
        actorId: userId,
        targetId: bookingId,
        success: false,
        errorMessage: validation.error,
        metadata: {
          from: booking.status,
          to: newStatus
        }
      }
    });
    
    throw new Error(validation.error);
  }
  
  // Proceed with transition
  await updateBookingStatus(bookingId, newStatus);
  
} catch (error) {
  return {
    error: error.message,
    status: 400
  };
}
```

---

## STATE MACHINE CHECKLIST

Before deploying state-related changes:

- [ ] All transitions validated
- [ ] Invalid transitions blocked
- [ ] Freeze-after-start enforced
- [ ] Auto-transitions scheduled
- [ ] Audit logging implemented
- [ ] Consistency checks added
- [ ] Error handling complete
- [ ] Tests cover all states

---

## RELATED DOCUMENTS

- `CORE_ESSENCE.md` - System identity
- `SYSTEM_PRINCIPLES.md` - State machine principle
- `FINANCIAL_DOCTRINE.md` - Transaction states
- `../03-operations/INCIDENT_RESPONSE.md` - State conflicts

---

**The state machine ensures predictable booking behavior. Violations create chaos.**

