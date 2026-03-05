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
│ PENDING │ (Payment not confirmed)
└────┬────┘
     │
     ├──→ CANCELLED (Payment timeout/failure)
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
      ├──→ CANCELLED (Rare: admin override only)
      │
      ↓
┌────────────────────┐
│ ELIGIBLE_FOR_PAYOUT│ (24h buffer passed)
└─────────┬──────────┘
          │
          ↓
     ┌────────┐
     │  PAID  │ (Instructor paid)
     └────┬───┘
          │
          ↓
     ┌────────┐
     │ LOCKED │ (Final state, immutable)
     └────────┘
```

---

## STATE DEFINITIONS

### PENDING
**Meaning**: Booking created but payment not confirmed

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

### COMPLETED
**Meaning**: Lesson finished, check-out done

**Entry Conditions**:
- Check-in completed
- Check-out completed
- Actual duration recorded

**Allowed Actions**:
- Process payout (after 24h buffer)
- Admin override cancel (rare)

**Blocked Actions**:
- Edit booking
- Client cancel
- Instructor cancel

**Transition To**:
- ELIGIBLE_FOR_PAYOUT (after 24h)
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

### ELIGIBLE_FOR_PAYOUT
**Meaning**: Ready for instructor payout

**Entry Conditions**:
- Status = COMPLETED
- 24 hours passed since completion
- Transaction status = COMPLETED

**Allowed Actions**:
- Process payout (admin approval)

**Blocked Actions**:
- Edit booking
- Cancel booking
- Refund (blocked)

**Transition To**:
- PAID (after payout processed)

**Example**:
```typescript
{
  status: 'ELIGIBLE_FOR_PAYOUT',
  completedAt: '2026-03-10T15:00:00Z',
  eligibleForPayoutAt: '2026-03-11T15:00:00Z'
}
```

---

### PAID
**Meaning**: Instructor has been paid

**Entry Conditions**:
- Payout processed
- Transaction status = PAID
- Money transferred to instructor

**Allowed Actions**:
- Lock booking (final state)
- Admin override refund (with reason)

**Blocked Actions**:
- Edit booking
- Cancel booking
- Regular refund

**Transition To**:
- LOCKED (automatic after 30 days)

**Example**:
```typescript
{
  status: 'PAID',
  paidAt: '2026-03-12T10:00:00Z',
  payoutAmount: 119.00
}
```

---

### LOCKED
**Meaning**: Final immutable state

**Entry Conditions**:
- Status = PAID
- 30 days passed since payout

**Allowed Actions**:
- View only
- Audit review

**Blocked Actions**:
- Any modifications
- Any state changes

**Transition To**:
- None (final state)

**Example**:
```typescript
{
  status: 'LOCKED',
  lockedAt: '2026-04-11T10:00:00Z'
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
| CONFIRMED | COMPLETED | Check-out | Check-in done first |
| CONFIRMED | CANCELLED | Cancel request | Before startTime OR admin override |
| COMPLETED | ELIGIBLE_FOR_PAYOUT | Time passed | 24h since completion |
| COMPLETED | CANCELLED | Admin override | Rare, requires reason |
| ELIGIBLE_FOR_PAYOUT | PAID | Payout processed | Admin approved |
| PAID | LOCKED | Time passed | 30 days since payout |
| Any | CANCELLED | Cancel request | Policy-dependent |

### Invalid Transitions

| From | To | Why Invalid |
|------|----| ------------|
| PENDING | COMPLETED | Must confirm first |
| CONFIRMED | PAID | Must complete first |
| PAID | CANCELLED | Refund blocked (except admin) |
| CANCELLED | CONFIRMED | Cannot reactivate |
| LOCKED | Any | Final state |

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
    CONFIRMED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['ELIGIBLE_FOR_PAYOUT', 'CANCELLED'],
    ELIGIBLE_FOR_PAYOUT: ['PAID'],
    PAID: ['LOCKED', 'CANCELLED'],  // CANCELLED only with admin override
    LOCKED: [],  // No transitions allowed
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

### 2. COMPLETED → ELIGIBLE_FOR_PAYOUT (Buffer)

**Trigger**: Payout processing script

**Logic**:
```typescript
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

const eligibleBookings = await prisma.booking.findMany({
  where: {
    status: 'COMPLETED',
    checkOutTime: { lt: twentyFourHoursAgo }
  }
});

// Update to ELIGIBLE_FOR_PAYOUT
for (const booking of eligibleBookings) {
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'ELIGIBLE_FOR_PAYOUT' }
  });
}
```

### 3. PAID → LOCKED (Finalization)

**Trigger**: Monthly cleanup script

**Logic**:
```typescript
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

await prisma.booking.updateMany({
  where: {
    status: 'PAID',
    paidAt: { lt: thirtyDaysAgo }
  },
  data: {
    status: 'LOCKED',
    lockedAt: new Date()
  }
});
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
// PAID bookings must be COMPLETED
const paidNotCompleted = await prisma.booking.findMany({
  where: {
    status: 'PAID',
    checkOutTime: null
  }
});

if (paidNotCompleted.length > 0) {
  ALERT('PAID bookings that are not COMPLETED');
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

