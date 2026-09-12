# Disputes & Chargebacks Automation

## Overview
The Disputes & Chargebacks system handles Stripe dispute webhooks and automatically manages payout freezes, ledger entries, and staff task creation. When a payment dispute is opened, funds are reserved and the financial team is notified.

**Status**: ⚠️ Partially Implemented  
**Code**: `lib/services/chargebackAutomation.ts`  
**Features**: Webhook handling, payout freeze, ledger entries, task creation  
**Gaps**: Chargeback defense submission is placeholder  

---

## AS IS - Current Implementation

### Event Flow

| Event | Handler | Action | Ledger | Task |
|-------|---------|--------|--------|------|
| **dispute.opened** | handleChargebackEvent() | Freeze payout, reserve funds | DISPUTE_OPENED | PAYMENT_DISPUTE |
| **dispute.won** | handleDisputeResolution() | Release hold, credit instructor | DISPUTE_WON | None |
| **dispute.lost** | handleDisputeResolution() | Deduct from platform, reverse | DISPUTE_LOST | None |

### Event Types & Handlers

**1. Dispute Opened** (chargebackAutomation.ts lines 33-120)

```typescript
async function handleChargebackEvent(event: ChargebackEvent) {
  const { disputeId, instructorId, bookingId, amount } = event
  
  // Step 1: Freeze instructor payout
  // Find any pending payout for this instructor
  const payout = await prisma.payout.findFirst({
    where: {
      instructorId,
      status: { in: ['ELIGIBLE', 'BUILDING', 'READY'] }
    }
  })
  
  if (payout) {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'HELD', heldReason: `Dispute: ${disputeId}` }
    })
  }
  
  // Step 2: Create ledger entry
  await appendLedgerEntry({
    type: 'DISPUTE_OPENED',
    amount,
    referenceId: disputeId
  })
  
  // Step 3: Update platform ledger (reserve funds)
  await incrementLedger({ totalReserved: amount })
  
  // Step 4: Create task for financial team
  await createPaymentDisputeTask({
    clientId: dispute.clientId,
    bookingId,
    amount,
    reason: 'Stripe dispute opened',
    contactName: clientName,
    contactEmail: clientEmail
  })
  
  // Step 5: Send alert to admin
  await sendAlert({
    to: adminEmail,
    subject: `Dispute Opened: $${amount}`,
    message: `Dispute ${disputeId} opened for $${amount}...`
  })
}
```

**Behaviors**:
- Finds ANY pending payout for instructor (not just this booking)
- Marks it HELD (blocks payout execution)
- Records DISPUTE_OPENED in ledger
- Reserves funds in platform ledger (totalReserved += amount)
- Creates PAYMENT_DISPUTE task (URGENT category, auto-assigned to FINANCIAL staff)
- Sends admin alert email

**Step-by-Step**:
1. ✅ Fetch pending payouts for instructor
2. ✅ Mark payout as HELD
3. ✅ Create ledger entry (DISPUTE_OPENED)
4. ✅ Update platform reserve
5. ✅ Create staff task
6. ✅ Send alert

---

**2. Dispute Resolution - Won** (chargebackAutomation.ts lines 126-172)

```typescript
async function handleDisputeResolution(event: DisputeResolutionEvent) {
  const { disputeId, outcome, amount } = event
  
  if (outcome === 'WON') {
    // Release the hold
    const payout = await prisma.payout.findFirst({
      where: {
        heldReason: `Dispute: ${disputeId}`
      }
    })
    
    if (payout) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'ELIGIBLE' }
      })
    }
    
    // Create ledger entry (we won, funds safe)
    await appendLedgerEntry({
      type: 'DISPUTE_WON',
      amount,
      referenceId: disputeId
    })
    
    // Release reserve
    await incrementLedger({ totalReserved: -amount })
    
    // Notify staff
    await sendAlert({
      to: financialTeamEmail,
      subject: `Dispute Won: $${amount}`,
      message: 'Dispute resolved in our favor...'
    })
  }
}
```

**Behaviors**:
- Finds the HELD payout (by heldReason)
- Updates status back to ELIGIBLE (resumes payout)
- Creates DISPUTE_WON ledger entry
- Releases reserve from platform ledger
- Sends alert to financial team

---

**3. Dispute Resolution - Lost** (chargebackAutomation.ts lines 173-210)

```typescript
async function handleDisputeResolution(event: DisputeResolutionEvent) {
  const { disputeId, outcome, amount } = event
  
  if (outcome === 'LOST') {
    // ❌ We lost: Deduct from instructor
    if (!dispute.adjustmentCreated) {
      // Create ADJUSTMENT ledger entry
      await appendLedgerEntry({
        type: 'DISPUTE_LOST',
        amount,
        referenceId: disputeId
      })
      
      // Deduct from platform revenue (we lose booking + Stripe fee)
      await incrementLedger({
        totalCollected: -amount,
        totalReserved: -amount
      })
      
      // Mark adjustment created (prevent double deduction)
      await prisma.stripeDispute.update({
        where: { id: disputeId },
        data: { adjustmentCreated: true }
      })
    }
    
    // Cancel the held payout (money already lost)
    const payout = await prisma.payout.findFirst({
      where: { heldReason: `Dispute: ${disputeId}` }
    })
    
    if (payout) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'CANCELLED', notes: 'Chargeback lost' }
      })
    }
  }
}
```

**Behaviors**:
- Creates DISPUTE_LOST ledger entry
- Deducts amount from both totalCollected and totalReserved
- Sets adjustmentCreated flag (idempotency - prevent double deduction)
- Cancels the held payout (funds gone to Stripe)
- Does NOT create a task (resolution is automatic)

---

### Ledger Entries Created

| Entry Type | Amount | When | Platform Impact |
|------------|--------|------|-----------------|
| **DISPUTE_OPENED** | +amount | Dispute webhook received | totalReserved += amount (freeze funds) |
| **DISPUTE_WON** | -amount | Chargeback defended | totalReserved -= amount (release freeze) |
| **DISPUTE_LOST** | -amount | Chargeback lost | totalCollected -= amount, totalReserved -= amount (permanent loss) |

---

### Payout Hold Mechanism

**When Dispute Opened**:
- Find pending payout(s) for instructor
- Mark as HELD (status = 'HELD', heldReason = 'Dispute: {disputeId}')
- Payout execution skips HELD payouts

**When Dispute Won**:
- Find HELD payout (by heldReason)
- Restore to ELIGIBLE (resume execution)

**When Dispute Lost**:
- Find HELD payout
- Mark as CANCELLED (payout never happens)

---

### Implemented Features (✅)

- ✅ Webhook handling (dispute.opened, dispute.won, dispute.lost)
- ✅ Payout freeze/release logic
- ✅ Ledger entries (DISPUTE_OPENED, DISPUTE_WON, DISPUTE_LOST)
- ✅ Platform ledger updates (reserve + collected)
- ✅ Task creation (PAYMENT_DISPUTE)
- ✅ Admin alerts via email

### Missing/Incomplete Features (❌)

- ❌ **Chargeback Defense Submission**: `processChargebackDefense()` is placeholder (only logs message)
- ❌ Admin dashboard for dispute management
- ❌ Dispute evidence upload UI
- ❌ Webhook retry logic (if webhook fails to process)
- ❌ Dispute status tracking (no view of pending disputes)
- ❌ Instructor notification (when payout frozen)
- ❌ Automatic recovery workflow (after dispute resolved)

---

## AS IT SHOULD BE - Recommended Implementation

### 1. Chargeback Defense Submission

**Current**: Function is placeholder (`processChargebackDefense` just logs message)

**Implementation Needed**:
```typescript
export async function processChargebackDefense(disputeId: string) {
  const dispute = await prisma.stripeDispute.findUnique({
    where: { stripeDisputeId: disputeId },
    include: { booking: { include: { checkInData: true } } }
  })
  
  if (!dispute) return
  
  // Gather evidence
  const evidence = {
    check_in_data: dispute.booking.checkInData,
    completion_proof: dispute.booking.completionPhoto,
    instructor_confirmation: dispute.booking.checkInBy,
    timestamp: dispute.booking.checkInTime
  }
  
  // Submit to Stripe
  const submission = await stripe.disputes.submit(disputeId, {
    evidence: formatForStripe(evidence)
  })
  
  // Track submission
  await prisma.stripeDispute.update({
    where: { id: dispute.id },
    data: {
      defenseSubmitted: true,
      defenseSubmittedAt: new Date(),
      stripeDefenseEvidence: submission
    }
  })
}
```

**Effort**: 3-4 hours

### 2. Admin Dispute Dashboard

**What's Needed**: View pending/resolved disputes, submit evidence, track status

**Implementation**:
- Page: `/admin/disputes`
- Show: List of open disputes (sortable by amount, date)
- Actions: View evidence, submit defense, mark as resolved

**Effort**: 4-5 hours

### 3. Instructor Notifications

**What's Needed**: Email when payout frozen, when resolved

**Implementation**:
- On dispute.opened: "Your payout for {date} has been temporarily held due to a payment dispute..."
- On dispute.resolved: "The dispute has been resolved. Your payout will resume..." or "Unfortunately, the dispute was not in our favor..."

**Effort**: 1-2 hours

### 4. Webhook Retry Logic

**What's Needed**: If webhook fails, retry after delay

**Implementation**:
- Store failed webhooks in table
- Cron job retries after 5 min, 15 min, 1 hour
- Max 3 retries, then alert admin

**Effort**: 2-3 hours

### 5. Dispute Recovery Workflow

**What's Needed**: Automatic or manual process to recover from lost dispute

**Implementation**:
- Option 1: Auto-deduct from instructor next payout
- Option 2: Create refund task for financial team to manually handle
- Option 3: Block instructor from receiving future payouts until recovered

**Effort**: 2-3 hours (depends on policy)

---

## Implementation Checklist

- [x] Webhook handling (open/won/lost)
- [x] Payout freeze mechanism
- [x] Ledger entries
- [x] Platform reserve updates
- [x] Task creation
- [x] Admin alerts
- [ ] Chargeback defense submission (currently placeholder)
- [ ] Evidence gathering/upload
- [ ] Admin dashboard
- [ ] Instructor notifications
- [ ] Webhook retry logic
- [ ] Dispute recovery workflow
- [ ] Pending dispute reporting

---

## Related Features

- **Task Management**: Creates PAYMENT_DISPUTE task in FINANCIAL category
- **Ledger System**: Writes DISPUTE_OPENED/WON/LOST entries
- **Payouts**: Freezes/cancels payouts when dispute active
- **Notifications**: Alerts admin, should notify instructor (not yet)

---

## Testing Recommendations

- ✅ Dispute opened → Payout marked HELD, ledger entry created, task created
- ✅ Dispute won → Payout status restored to ELIGIBLE, reserve released
- ✅ Dispute lost → Payout cancelled, amount deducted from platform
- ❌ Dispute evidence submission → Currently placeholder, test after implementation
- ❌ Duplicate dispute handling → Not tested (idempotency unclear)

---

## Notes

**Incomplete Features**: Chargeback defense submission needs implementation. Currently, when a dispute is opened, the function does nothing (placeholder only).

**Impact if Not Implemented**: Disputes can be frozen but cannot be defended, leading to automatic losses.

