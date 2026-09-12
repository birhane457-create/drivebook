# SYSTEM PRINCIPLES

**Purpose**: Define non-negotiable platform principles  
**Owner**: Founder  
**Last Updated**: March 4, 2026  
**Scope**: Core rules that govern all system behavior  

---

## 🔒 PRINCIPLE 1: FINANCIAL HISTORY IS IMMUTABLE

### Rule
No transaction updates. Only adjustment transactions.

### Why
- Audit trail integrity
- Regulatory compliance
- Dispute resolution
- Payout accuracy
- Historical reconstruction

### How It Works

**❌ WRONG**:
```typescript
// Mutating existing transaction
await transaction.update({
  where: { id: existingId },
  data: { amount: newAmount }  // NEVER DO THIS
})

✅ CORRECT:

// Create adjustment transaction
await transaction.create({
  data: {
    amount: difference,
    type: 'BOOKING_ADJUSTMENT',
    parentTransactionId: originalId,
    ledgerGroupId: groupId,
    reason: 'Duration increased from 1h to 2h'
  }
})
Enforcement

Code review for all transaction operations

Daily reconciliation checks ledger integrity

Audit log tracks all transaction creations

Consequences of Breaking

Financial reports become unreliable

Payout reconstruction impossible

Regulatory compliance failure

Loss of audit trail

💰 PRINCIPLE 2: MONEY CANNOT BE CREATED OR DESTROYED
Rule

Every dollar must flow: Client → Platform → Instructor OR Client → Refund → Client

Why

Financial integrity

Reconciliation accuracy

Platform trust

Regulatory compliance

Money Flow Paths

Path 1: Successful Booking

Client pays $140
  → Platform receives $140
  → Platform keeps $21 (15% fee)
  → Instructor receives $119 (85%)
Total: $140 in = $140 out ✅

Path 2: Cancelled Booking (100% refund)

Client pays $140
  → Platform receives $140
  → Client cancels (48h+ notice)
  → Client refunded $140
Total: $140 in = $140 out ✅

Path 3: Cancelled Booking (50% refund)

Client pays $140
  → Platform receives $140
  → Client cancels (24-48h notice)
  → Client refunded $70
  → Platform keeps $70
Total: $140 in = $140 out ✅
Reconciliation Formula
SUM(all CREDIT transactions) = SUM(all DEBIT transactions) + SUM(platform fees) + SUM(instructor payouts)
Enforcement

Daily reconciliation script

Wallet balance verification

Transaction sum validation

Alert on discrepancies

Consequences of Breaking

Platform loss or gain (both bad)

Wallet balance corruption

Payout errors

Financial chaos

⏳ PRINCIPLE 3: STATE MACHINE CONTROL
Rule

Every booking must follow strict state progression. No skipping states. No silent transitions.

State Flow
PENDING → CONFIRMED → COMPLETED → ELIGIBLE_FOR_PAYOUT → PAID → LOCKED
   ↓          ↓           ↓
CANCELLED  CANCELLED  CANCELLED
State Definitions
State	Meaning	Can Transition To	Cannot Do
PENDING	Payment not confirmed	CONFIRMED, CANCELLED	Edit, Complete
CONFIRMED	Lesson scheduled	COMPLETED, CANCELLED	Skip to PAID
COMPLETED	Lesson finished	ELIGIBLE_FOR_PAYOUT	Cancel, Edit
ELIGIBLE_FOR_PAYOUT	Ready for payout	PAID	Cancel, Edit
PAID	Instructor paid	LOCKED	Refund (except admin)
LOCKED	Final state	None	Any changes
CANCELLED	Booking cancelled	None	Reactivate
Transition Rules

Valid Transitions:

PENDING → CONFIRMED (payment received)

CONFIRMED → COMPLETED (check-out done)

COMPLETED → ELIGIBLE_FOR_PAYOUT (24h buffer passed)

ELIGIBLE_FOR_PAYOUT → PAID (payout processed)

PAID → LOCKED (final lock)

Any → CANCELLED (with policy)

Invalid Transitions:

PENDING → COMPLETED (must confirm first)

CONFIRMED → PAID (must complete first)

PAID → CANCELLED (refund blocked)

CANCELLED → CONFIRMED (cannot reactivate)

Enforcement

State machine validation in API

Database constraints

Audit log on every transition

Alert on invalid attempts

Consequences of Breaking

Booking chaos

Payment errors

Payout to incomplete bookings

Financial loss

🛑 PRINCIPLE 4: AFTER START TIME = FROZEN
Rule

Once booking.startTime passes, the booking is frozen. No edits, no price changes, no instructor cancellation. Only completion.

Why

Prevents manipulation

Protects client payment

Ensures fair pricing

Audit integrity

What's Blocked After Start
Action	Allowed Before Start	Allowed After Start
Edit duration	✅ Yes	❌ No
Edit price	✅ Admin only	❌ No
Instructor cancel	✅ Yes	❌ No
Client cancel	✅ Yes (with policy)	❌ No
Complete booking	❌ No	✅ Yes
Admin override	✅ Yes	✅ Yes (with reason)
Enforcement
if (new Date() >= booking.startTime) {
  if (!isAdmin) {
    throw new Error('Cannot edit booking after session has started');
  }
  if (!adminOverrideReason) {
    throw new Error('Admin override requires reason');
  }
  await auditLog.create({ ... });
}
Consequences of Breaking

Instructor price manipulation

Client payment disputes

Platform loss

Trust erosion

📜 PRINCIPLE 5: EVERY FINANCIAL ACTION MUST BE LOGGED
Rule

All financial operations must create an AuditLog entry with: who, when, what, before, after.

What Must Be Logged

Always Log:

Wallet credit/debit

Booking creation/cancellation

Transaction creation

Payout approval/processing

Admin overrides

Refund after payout

Price changes

Manual adjustments

Log Structure:

{
  action: 'WALLET_CREDIT_ADDED',
  actorId: userId,
  actorRole: 'ADMIN',
  targetType: 'WALLET',
  targetId: walletId,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: {
    before: { balance: 100 },
    after: { balance: 200 },
    amount: 100,
    reason: 'Promotional credit'
  },
  success: true,
  createdAt: '2026-03-04T10:30:00Z'
}
Enforcement

Middleware on financial routes

Service layer logging

Database triggers (if needed)

Daily audit log review

Consequences of Breaking

Cannot debug issues

Cannot prove actions

Regulatory compliance failure

Dispute resolution impossible

🎯 PRINCIPLE HIERARCHY

When principles conflict, follow this priority:

Financial Integrity (Principle 1 & 2)

State Machine Control (Principle 3)

Audit Trail (Principle 5)

Freeze After Start (Principle 4)

🚨 VIOLATION RESPONSE
If Principle Violated

Immediate: Stop the operation

Alert: Notify admin team

Log: Record violation attempt

Investigate: Determine cause (bug vs malicious)

Fix: Patch code or process

Review: Update validation rules

Violation Severity
Severity	Examples	Response Time
CRITICAL	Transaction mutation, money creation	Immediate
HIGH	State skip, frozen booking edit	<1 hour
MEDIUM	Missing audit log	<24 hours
LOW	Non-financial validation	<1 week
✅ COMPLIANCE CHECKLIST

Before deploying any financial feature:

 Transactions are immutable

 Money flow reconciles

 State machine validated

 Freeze-after-start enforced

 Audit logging implemented

 Unit tests cover violations

 Code review completed

 Documentation updated

RELATED DOCUMENTS

CORE_ESSENCE.md - System identity

STATE_MACHINE.md - Detailed state transitions

FINANCIAL_DOCTRINE.md - Money flow rules

LEDGER_RULES.md - Transaction details

INCIDENT_RESPONSE.md - Violation handling

These principles are non-negotiable. Violating them breaks the system foundation.


This is fully polished and **ready to be committed as `SYSTEM_PRINCIPLES.md`**.  

If you want, I can now create a **`SYSTEM_GUIDELINES.md`** file that acts as a **practical playbook** with **step-by-step rules, daily checks, monitoring procedures, and admin actions**, so your operations can run smoothly without getting lost in hundreds of documents.  

Do you want me to make that next?