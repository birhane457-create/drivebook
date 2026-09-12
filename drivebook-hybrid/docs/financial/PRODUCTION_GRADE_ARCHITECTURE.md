# PRODUCTION-GRADE MARKETPLACE ARCHITECTURE

**Date:** February 24, 2026  
**Status:** A+ Level Infrastructure Design  
**Purpose:** Structural upgrades for scale

---

## 🎯 THE SHIFT

**From:** A-level marketplace (good policies)  
**To:** A+ production-grade infrastructure (enforced systems)

This document addresses the **structural gaps** that separate:
- Policy documents → Enforced state machines
- Live calculations → Batch entities
- Combined metrics → Separated concerns
- Reactive handling → Proactive automation
- Admin dashboards → Control towers
- Good practices → Absolute rules

---

## 🧠 1. FINANCIAL STATE MACHINE (Non-Negotiable)

### Current Problem
Policies are defined but not enforced. Bookings can jump states. Manual overrides bypass rules.

### Solution: Enforced State Transitions

**State Machine:**
```
CREATED 
  ↓ (payment captured)
FUNDED
  ↓ (lesson scheduled)
SCHEDULED
  ↓ (lesson ends)
COMPLETED
  ↓ (evaluation window starts)
LOCKED
  ↓ (48h evaluation passes)
RELEASE_READY
  ↓ (payout processed)
PAID_OUT

OR (dispute path):
COMPLETED → DISPUTED → RESOLVED → REFUNDED_FULL/PARTIAL
```

### State Transition Rules

**CREATED → FUNDED:**
- Requires: Payment captured
- Ledger: 3 entries created
- Cannot skip

**FUNDED → SCHEDULED:**
- Requires: Booking confirmed by both parties
- Cannot reverse without refund

**SCHEDULED → COMPLETED:**
- Requires: Lesson end time passed
- Requires: No active disputes
- Auto-transition after endTime

**COMPLETED → LOCKED:**
- Auto-transition immediately
- Starts 48h evaluation window
- No payouts allowed

**LOCKED → RELEASE_READY:**
- Requires: 48h passed
- Requires: No open disputes
- Requires: No pending refund requests
- Auto-transition

**RELEASE_READY → PAID_OUT:**
- Requires: Payout batch processed
- Ledger: 2 payout entries created
- Irreversible (except via negative balance)

### Enforcement Rules

**❌ NEVER ALLOW:**
- Jumping states (CREATED → COMPLETED)
- Payout before RELEASE_READY
- Refund after PAID_OUT without negative balance entry
- Manual override without ledger record
- State rollback without reversal entries

**✅ ALWAYS REQUIRE:**
- Sequential state progression
- Ledger entry for each transition
- Audit log for manual interventions
- Reason for any exception

### Implementation

```prisma
model Booking {
  // ... existing fields
  
  financialState    FinancialState @default(CREATED)
  stateTransitions  Json[]         // History of state changes
  lockedAt          DateTime?      // When evaluation started
  releaseReadyAt    DateTime?      // When eligible for payout
  paidOutAt         DateTime?      // When payout processed
  
  @@index([financialState])
  @@index([releaseReadyAt])
}

enum FinancialState {
  CREATED
  FUNDED
  SCHEDULED
  COMPLETED
  LOCKED
  RELEASE_READY
  PAID_OUT
  DISPUTED
  RESOLVED
  REFUNDED_FULL
  REFUNDED_PARTIAL
}
```

**State Transition Service:**
```typescript
class BookingStateMachine {
  async transition(
    bookingId: string,
    toState: FinancialState,
    reason: string,
    adminId?: string
  ): Promise<void> {
    // Validate transition is allowed
    // Create ledger entries if needed
    // Log audit trail
    // Update state
    // Trigger webhooks/notifications
  }
  
  canTransition(
    fromState: FinancialState,
    toState: FinancialState
  ): boolean {
    // Enforce allowed transitions
  }
}
```

### Benefits
- Prevents double refunds
- Prevents early payouts
- Prevents inconsistent states
- Prevents admin mistakes
- Complete audit trail
- Automated enforcement

---

## 🧾 2. PAYOUT BATCH ENTITY (Critical)

### Current Problem
Payouts calculated live from balance. No historical records. Cannot re-run failed batches. No accounting exports.

### Solution: Payout Batching System

**Database Schema:**
```prisma
model PayoutBatch {
  id                  String   @id @default(auto()) @map("_id") @db.ObjectId
  periodStart         DateTime // Monday 00:00
  periodEnd           DateTime // Sunday 23:59
  evaluationClosedAt  DateTime // Tuesday 23:59
  
  totalGross          Float    // Sum of all instructor earnings
  totalPenalties      Float    // Sum of all penalties
  totalCarryForward   Float    // Sum of carried negative balances
  totalNet            Float    // Actual payout amount
  
  status              PayoutBatchStatus @default(PREPARING)
  
  preparedAt          DateTime?
  lockedAt            DateTime?
  processingStartedAt DateTime?
  completedAt         DateTime?
  failedAt            DateTime?
  failureReason       String?
  
  instructorPayouts   InstructorPayout[]
  
  createdBy           String   // Admin or SYSTEM
  createdAt           DateTime @default(now())
  
  @@index([status])
  @@index([periodStart, periodEnd])
}

enum PayoutBatchStatus {
  PREPARING    // Calculating amounts
  LOCKED       // Ready for review
  PROCESSING   // Sending to Stripe
  COMPLETED    // All payouts successful
  FAILED       // Batch failed
  PARTIAL      // Some payouts failed
}

model InstructorPayout {
  id                  String   @id @default(auto()) @map("_id") @db.ObjectId
  batchId             String   @db.ObjectId
  batch               PayoutBatch @relation(fields: [batchId], references: [id])
  
  instructorId        String   @db.ObjectId
  instructor          Instructor @relation(fields: [instructorId], references: [id])
  
  grossAmount         Float    // Total earnings this period
  penaltyAmount       Float    // Penalties this period
  carryForwardAmount  Float    // Negative balance from previous period
  netAmount           Float    // Actual payout (can be 0)
  
  transactionIds      String[] // Transactions included
  penaltyIds          String[] // Penalties applied
  
  status              InstructorPayoutStatus @default(PENDING)
  stripePayoutId      String?  @unique
  
  processedAt         DateTime?
  failedAt            DateTime?
  failureReason       String?
  failureCode         String?
  
  retryCount          Int      @default(0)
  maxRetries          Int      @default(3)
  
  createdAt           DateTime @default(now())
  
  @@index([batchId])
  @@index([instructorId])
  @@index([status])
}

enum InstructorPayoutStatus {
  PENDING      // Not yet processed
  PROCESSING   // Sending to Stripe
  COMPLETED    // Successfully paid
  FAILED       // Failed (will retry)
  CANCELLED    // Manually cancelled
}
```

**Batch Creation Flow:**
```typescript
// Monday morning: Create batch for previous week
async function createWeeklyPayoutBatch() {
  const periodStart = lastMonday();
  const periodEnd = lastSunday();
  
  const batch = await prisma.payoutBatch.create({
    data: {
      periodStart,
      periodEnd,
      evaluationClosedAt: addDays(periodEnd, 2), // Tuesday
      status: 'PREPARING',
      createdBy: 'SYSTEM'
    }
  });
  
  // Calculate each instructor's payout
  const instructors = await getInstructorsWithEarnings(periodStart, periodEnd);
  
  for (const instructor of instructors) {
    const gross = await calculateGrossEarnings(instructor.id, periodStart, periodEnd);
    const penalties = await calculatePenalties(instructor.id, periodStart, periodEnd);
    const carryForward = await getCarryForwardBalance(instructor.id);
    const net = Math.max(0, gross - penalties - carryForward);
    
    await prisma.instructorPayout.create({
      data: {
        batchId: batch.id,
        instructorId: instructor.id,
        grossAmount: gross,
        penaltyAmount: penalties,
        carryForwardAmount: carryForward,
        netAmount: net,
        transactionIds: [...],
        penaltyIds: [...],
        status: 'PENDING'
      }
    });
  }
  
  // Update batch totals
  await updateBatchTotals(batch.id);
  
  // Lock batch for review
  await prisma.payoutBatch.update({
    where: { id: batch.id },
    data: { 
      status: 'LOCKED',
      lockedAt: new Date()
    }
  });
}
```

**Batch Processing Flow:**
```typescript
// Tuesday evening: Process batch
async function processPayoutBatch(batchId: string) {
  const batch = await prisma.payoutBatch.findUnique({
    where: { id: batchId },
    include: { instructorPayouts: true }
  });
  
  if (batch.status !== 'LOCKED') {
    throw new Error('Batch must be LOCKED before processing');
  }
  
  await prisma.payoutBatch.update({
    where: { id: batchId },
    data: { 
      status: 'PROCESSING',
      processingStartedAt: new Date()
    }
  });
  
  let successCount = 0;
  let failCount = 0;
  
  for (const payout of batch.instructorPayouts) {
    if (payout.netAmount === 0) {
      // Skip zero payouts
      await prisma.instructorPayout.update({
        where: { id: payout.id },
        data: { status: 'COMPLETED' }
      });
      continue;
    }
    
    try {
      // Send to Stripe
      const stripePayout = await stripe.payouts.create({
        amount: Math.round(payout.netAmount * 100),
        currency: 'usd',
        destination: instructor.stripeAccountId,
        metadata: {
          batchId,
          instructorId: payout.instructorId,
          periodStart: batch.periodStart,
          periodEnd: batch.periodEnd
        }
      });
      
      // Record in ledger
      await recordPayout(tx, {
        payoutId: payout.id,
        instructorId: payout.instructorId,
        amount: payout.netAmount,
        stripePayoutId: stripePayout.id,
        transactionIds: payout.transactionIds,
        createdBy: 'SYSTEM'
      });
      
      // Update payout status
      await prisma.instructorPayout.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          stripePayoutId: stripePayout.id,
          processedAt: new Date()
        }
      });
      
      successCount++;
    } catch (error) {
      await prisma.instructorPayout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error.message,
          failureCode: error.code,
          retryCount: { increment: 1 }
        }
      });
      
      failCount++;
    }
  }
  
  // Update batch status
  const finalStatus = failCount === 0 ? 'COMPLETED' : 
                      successCount === 0 ? 'FAILED' : 'PARTIAL';
  
  await prisma.payoutBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      completedAt: new Date()
    }
  });
}
```

### Benefits
- Historical payout records
- Can re-run failed batches
- Accounting exports
- Audit proof
- Retry logic
- Partial success handling
- Clear status tracking

---

## 🛑 3. PERFORMANCE vs RISK SEPARATION

### Current Problem
Reliability score combines quality behavior and financial danger. High-quality instructor with one chargeback treated same as low-quality instructor.

### Solution: Separate Scoring Systems

**Reliability Score = Quality Behavior**
- No-show rate
- Cancellation rate
- Completion rate
- Average rating
- Response time

**Risk Score = Financial Danger**
- Chargebacks
- Dispute monetary value
- Rapid booking spikes
- Repeated refunds
- Abnormal earnings growth
- Negative balance history

**Implementation:**
```prisma
model InstructorReliability {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  instructorId    String   @unique @db.ObjectId
  
  // Reliability Score (0-100)
  reliabilityScore     Int
  noShowRate           Float
  cancellationRate     Float
  completionRate       Float
  averageRating        Float
  responseTimeMinutes  Int
  
  // Risk Score (0-100, higher = more risk)
  riskScore            Int
  chargebackCount      Int
  chargebackAmount     Float
  disputeCount         Int
  disputeAmount        Float
  refundRate           Float
  earningsGrowthRate   Float
  negativeBalanceCount Int
  
  // Combined Assessment
  tier                 InstructorTier
  status               InstructorStatus
  
  lastCalculated       DateTime
  
  @@index([reliabilityScore])
  @@index([riskScore])
  @@index([tier])
}
```

**Decision Matrix:**
```typescript
function determineInstructorAction(
  reliability: number,
  risk: number
): Action {
  if (risk > 80) {
    return 'FREEZE_PAYOUT'; // High risk regardless of reliability
  }
  
  if (reliability > 90 && risk < 20) {
    return 'PROMOTE_TO_PREMIUM';
  }
  
  if (reliability > 75 && risk < 40) {
    return 'STANDARD'; // Normal operations
  }
  
  if (reliability < 60 || risk > 60) {
    return 'FLAG_FOR_REVIEW';
  }
  
  if (reliability < 40 || risk > 80) {
    return 'SUSPEND';
  }
  
  return 'MONITOR';
}
```

**Example Scenarios:**

**Scenario 1: High Reliability, High Risk**
- Reliability: 95 (excellent service)
- Risk: 85 (recent chargeback spike)
- Action: FREEZE_PAYOUT + INVESTIGATE
- Reason: Protect platform from financial loss

**Scenario 2: Low Reliability, Low Risk**
- Reliability: 55 (poor service)
- Risk: 15 (no financial issues)
- Action: WARNING + TRAINING
- Reason: Quality issue, not financial threat

**Scenario 3: High Reliability, Low Risk**
- Reliability: 92
- Risk: 12
- Action: PROMOTE_TO_PREMIUM
- Reason: Ideal instructor

### Benefits
- Protects platform from financial loss
- Doesn't punish quality instructors for isolated incidents
- Separates quality coaching from financial protection
- Clear escalation paths
- Automated decision-making

---

## 💳 4. CHARGEBACK HANDLING (Critical)

### Current Problem
No chargeback handling. If client disputes with bank, system breaks.

### Solution: Complete Chargeback Flow

**Database Schema:**
```prisma
model Chargeback {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  bookingId         String   @db.ObjectId @unique
  booking           Booking  @relation(fields: [bookingId], references: [id])
  
  stripeChargebackId String  @unique
  amount            Float
  reason            String   // fraud, duplicate, product_not_received, etc.
  
  status            ChargebackStatus @default(RECEIVED)
  
  receivedAt        DateTime
  dueDate           DateTime // When we must respond
  respondedAt       DateTime?
  resolvedAt        DateTime?
  
  outcome           String?  // won, lost, withdrawn
  
  // Financial Impact
  instructorPaidOut Boolean  // Was instructor already paid?
  reversalAmount    Float    // Amount to reverse from instructor
  platformFee       Float    // Stripe chargeback fee ($15)
  
  // Evidence
  evidenceSubmitted Boolean  @default(false)
  evidenceFiles     String[] // URLs to evidence
  
  createdAt         DateTime @default(now())
  
  @@index([status])
  @@index([dueDate])
}

enum ChargebackStatus {
  RECEIVED         // Chargeback received from Stripe
  INVESTIGATING    // Gathering evidence
  RESPONDED        // Evidence submitted
  WON              // Chargeback won
  LOST             // Chargeback lost
  WITHDRAWN        // Client withdrew chargeback
}
```

**Chargeback Flow:**
```typescript
// Stripe webhook receives chargeback
async function handleChargebackReceived(
  stripeChargebackId: string,
  bookingId: string,
  amount: number,
  reason: string
) {
  await prisma.$transaction(async (tx) => {
    // 1. Create chargeback record
    const chargeback = await tx.chargeback.create({
      data: {
        bookingId,
        stripeChargebackId,
        amount,
        reason,
        status: 'RECEIVED',
        receivedAt: new Date(),
        dueDate: addDays(new Date(), 7), // 7 days to respond
        platformFee: 15.00 // Stripe fee
      }
    });
    
    // 2. Update booking state
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        financialState: 'DISPUTED',
        stateTransitions: {
          push: {
            from: 'PAID_OUT',
            to: 'DISPUTED',
            reason: 'Chargeback received',
            timestamp: new Date()
          }
        }
      }
    });
    
    // 3. Check if instructor was already paid
    const payout = await tx.instructorPayout.findFirst({
      where: {
        transactionIds: { has: bookingId },
        status: 'COMPLETED'
      }
    });
    
    const instructorPaidOut = !!payout;
    
    // 4. Reverse instructor payable in ledger
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { instructor: true, client: true }
    });
    
    await createLedgerEntry(tx, {
      debitAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, booking.instructorId),
      creditAccount: AccountType.PLATFORM_ESCROW,
      amount: booking.instructorPayout,
      description: 'Chargeback reversal - instructor payout',
      idempotencyKey: generateIdempotencyKey('chargeback-reversal', bookingId),
      bookingId,
      instructorId: booking.instructorId,
      metadata: {
        chargebackId: chargeback.id,
        stripeChargebackId,
        reason,
        instructorPaidOut
      },
      createdBy: 'SYSTEM'
    });
    
    // 5. If already paid, create negative balance
    if (instructorPaidOut) {
      await tx.instructorPenalty.create({
        data: {
          instructorId: booking.instructorId,
          bookingId,
          penaltyAmount: booking.instructorPayout + 15.00, // Include Stripe fee
          penaltyType: 'CHARGEBACK',
          status: 'APPLIED',
          reason: `Chargeback: ${reason}`,
          carriedForward: true,
          appliedAt: new Date()
        }
      });
      
      // Freeze account
      await tx.instructor.update({
        where: { id: booking.instructorId },
        data: { approvalStatus: 'SUSPENDED' }
      });
    }
    
    // 6. Notify admin
    await notifyAdmin({
      type: 'CHARGEBACK_RECEIVED',
      chargebackId: chargeback.id,
      bookingId,
      amount,
      reason,
      dueDate: chargeback.dueDate,
      instructorPaidOut
    });
    
    // 7. Notify instructor
    await notifyInstructor({
      instructorId: booking.instructorId,
      type: 'CHARGEBACK_RECEIVED',
      bookingId,
      amount,
      dueDate: chargeback.dueDate
    });
  });
}

// Admin submits evidence
async function submitChargebackEvidence(
  chargebackId: string,
  evidence: {
    customerName: string;
    customerEmail: string;
    productDescription: string;
    serviceDate: Date;
    serviceDocumentation: string[];
    customerSignature?: string;
    customerCommunication: string[];
  }
) {
  const chargeback = await prisma.chargeback.findUnique({
    where: { id: chargebackId }
  });
  
  // Submit to Stripe
  await stripe.disputes.update(chargeback.stripeChargebackId, {
    evidence: {
      customer_name: evidence.customerName,
      customer_email_address: evidence.customerEmail,
      product_description: evidence.productDescription,
      service_date: evidence.serviceDate.toISOString(),
      service_documentation: evidence.serviceDocumentation.join('\n'),
      customer_signature: evidence.customerSignature,
      customer_communication: evidence.customerCommunication.join('\n')
    }
  });
  
  // Update record
  await prisma.chargeback.update({
    where: { id: chargebackId },
    data: {
      status: 'RESPONDED',
      evidenceSubmitted: true,
      evidenceFiles: evidence.serviceDocumentation,
      respondedAt: new Date()
    }
  });
}

// Chargeback resolved (webhook)
async function handleChargebackResolved(
  stripeChargebackId: string,
  outcome: 'won' | 'lost' | 'withdrawn'
) {
  const chargeback = await prisma.chargeback.findUnique({
    where: { stripeChargebackId }
  });
  
  await prisma.$transaction(async (tx) => {
    // Update chargeback
    await tx.chargeback.update({
      where: { id: chargeback.id },
      data: {
        status: outcome === 'won' ? 'WON' : 'LOST',
        outcome,
        resolvedAt: new Date()
      }
    });
    
    if (outcome === 'won') {
      // We won - restore instructor payable
      const booking = await tx.booking.findUnique({
        where: { id: chargeback.bookingId }
      });
      
      await createLedgerEntry(tx, {
        debitAccount: AccountType.PLATFORM_ESCROW,
        creditAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, booking.instructorId),
        amount: booking.instructorPayout,
        description: 'Chargeback won - restore instructor payout',
        idempotencyKey: generateIdempotencyKey('chargeback-won', chargeback.bookingId),
        bookingId: chargeback.bookingId,
        instructorId: booking.instructorId,
        metadata: {
          chargebackId: chargeback.id,
          outcome: 'won'
        },
        createdBy: 'SYSTEM'
      });
      
      // Clear penalty
      await tx.instructorPenalty.updateMany({
        where: {
          bookingId: chargeback.bookingId,
          penaltyType: 'CHARGEBACK'
        },
        data: {
          status: 'CLEARED',
          clearedAt: new Date()
        }
      });
      
      // Restore account if suspended for this
      await tx.instructor.update({
        where: { id: booking.instructorId },
        data: { approvalStatus: 'APPROVED' }
      });
      
    } else {
      // We lost - platform absorbs loss
      await createLedgerEntry(tx, {
        debitAccount: AccountType.PLATFORM_REVENUE,
        creditAccount: AccountType.PLATFORM_ESCROW,
        amount: chargeback.amount + chargeback.platformFee,
        description: 'Chargeback lost - platform absorbs loss',
        idempotencyKey: generateIdempotencyKey('chargeback-lost', chargeback.bookingId),
        bookingId: chargeback.bookingId,
        metadata: {
          chargebackId: chargeback.id,
          outcome: 'lost',
          stripeFee: chargeback.platformFee
        },
        createdBy: 'SYSTEM'
      });
      
      // Penalty remains on instructor
    }
  });
}
```

### Benefits
- Complete chargeback handling
- Automatic instructor reversal
- Evidence submission workflow
- Win/loss tracking
- Platform loss absorption
- Negative balance carry-forward
- Account freezing for protection

---

## 🧮 5. FINANCIAL CONTROL TOWER (Admin Dashboard)

### Current Problem
Cannot see financial exposure instantly. Operating blind.

### Solution: Real-Time Financial Dashboard

**Key Metrics (Must See at Any Time):**
```typescript
interface FinancialControlTower {
  // Balances
  totalEscrowBalance: number;        // Should be ~$0
  totalInstructorPayable: number;    // What we owe
  totalPlatformRevenue: number;      // What we've earned
  totalClientWallets: number;        // Client prepaid funds
  
  // Pending Operations
  totalPendingPenalties: number;     // Penalties not yet applied
  totalDisputedFunds: number;        // Money in dispute
  upcomingTuesdayPayout: number;     // Next payout amount
  
  // Risk Indicators
  negativeBalanceInstructors: number; // Count
  negativeBalanceTotal: number;       // Total negative
  weeklyExposureRisk: number;         // Potential loss
  chargebackExposure: number;         // Open chargebacks
  
  // Operational Health
  escrowDrift: number;                // How far from $0
  reconciliationStatus: 'OK' | 'WARNING' | 'ERROR';
  lastReconciliation: Date;
  
  // Batch Status
  currentBatch: {
    status: PayoutBatchStatus;
    totalGross: number;
    totalNet: number;
    instructorCount: number;
    dueDate: Date;
  };
}
```

**Dashboard Queries:**
```typescript
async function getFinancialControlTower(): Promise<FinancialControlTower> {
  // Run all queries in parallel
  const [
    escrowBalance,
    instructorPayables,
    platformRevenue,
    clientWallets,
    pendingPenalties,
    disputedBookings,
    nextBatch,
    negativeInstructors,
    openChargebacks
  ] = await Promise.all([
    getAccountBalance(AccountType.PLATFORM_ESCROW),
    getAccountBalances('INSTRUCTOR_PAYABLE:*'),
    getAccountBalance(AccountType.PLATFORM_REVENUE),
    getAccountBalances('CLIENT_WALLET:*'),
    getPendingPenalties(),
    getDisputedBookings(),
    getNextPayoutBatch(),
    getNegativeBalanceInstructors(),
    getOpenChargebacks()
  ]);
  
  return {
    totalEscrowBalance: escrowBalance,
    totalInstructorPayable: sumBalances(instructorPayables),
    totalPlatformRevenue: platformRevenue,
    totalClientWallets: sumBalances(clientWallets),
    totalPendingPenalties: pendingPenalties.total,
    totalDisputedFunds: disputedBookings.total,
    upcomingTuesdayPayout: nextBatch?.totalNet || 0,
    negativeBalanceInstructors: negativeInstructors.count,
    negativeBalanceTotal: negativeInstructors.total,
    weeklyExposureRisk: calculateExposureRisk(),
    chargebackExposure: openChargebacks.total,
    escrowDrift: Math.abs(escrowBalance),
    reconciliationStatus: escrowBalance < 1 ? 'OK' : 'WARNING',
    lastReconciliation: await getLastReconciliationDate(),
    currentBatch: nextBatch
  };
}
```

**Alert Thresholds:**
```typescript
const ALERTS = {
  ESCROW_DRIFT: 100,           // Alert if escrow > $100
  NEGATIVE_BALANCE_COUNT: 5,   // Alert if 5+ instructors negative
  CHARGEBACK_EXPOSURE: 5000,   // Alert if chargebacks > $5k
  DISPUTED_FUNDS: 10000,       // Alert if disputes > $10k
  PAYOUT_DELAY: 24,            // Alert if batch delayed 24h
};

function checkAlerts(tower: FinancialControlTower): Alert[] {
  const alerts: Alert[] = [];
  
  if (Math.abs(tower.escrowDrift) > ALERTS.ESCROW_DRIFT) {
    alerts.push({
      level: 'WARNING',
      type: 'ESCROW_DRIFT',
      message: `Escrow balance is $${tower.escrowDrift} (should be ~$0)`,
      action: 'Run reconciliation'
    });
  }
  
  if (tower.negativeBalanceInstructors > ALERTS.NEGATIVE_BALANCE_COUNT) {
    alerts.push({
      level: 'WARNING',
      type: 'NEGATIVE_BALANCES',
      message: `${tower.negativeBalanceInstructors} instructors with negative balance`,
      action: 'Review instructor accounts'
    });
  }
  
  if (tower.chargebackExposure > ALERTS.CHARGEBACK_EXPOSURE) {
    alerts.push({
      level: 'CRITICAL',
      type: 'CHARGEBACK_EXPOSURE',
      message: `$${tower.chargebackExposure} in open chargebacks`,
      action: 'Submit evidence immediately'
    });
  }
  
  return alerts;
}
```

### Benefits
- Instant visibility into financial health
- Proactive alerting
- Risk exposure tracking
- Operational confidence
- Investor-ready metrics

---

## 🧱 6. RESERVE SYSTEM (Advanced Protection)

### Current Problem
New/high-risk instructors can cause delayed fraud losses.

### Solution: Reserve Hold System

**Implementation:**
```prisma
model InstructorReserve {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  instructorId    String   @db.ObjectId
  
  reserveRate     Float    // % to hold (e.g., 10%)
  holdPeriodDays  Int      // Days to hold (e.g., 14)
  
  totalReserved   Float    // Total currently held
  totalReleased   Float    // Total released
  
  isActive        Boolean  @default(true)
  activatedAt     DateTime
  deactivatedAt   DateTime?
  
  reserves        Reserve[]
  
  @@index([instructorId])
}

model Reserve {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  instructorReserveId String @db.ObjectId
  instructorReserve InstructorReserve @relation(fields: [instructorReserveId], references: [id])
  
  bookingId         String   @db.ObjectId
  amount            Float    // Amount held
  
  status            ReserveStatus @default(HELD)
  
  heldAt            DateTime
  releaseAt         DateTime // When it can be released
  releasedAt        DateTime?
  forfeitedAt       DateTime?
  forfeitReason     String?
  
  @@index([status])
  @@index([releaseAt])
}

enum ReserveStatus {
  HELD       // Currently held
  RELEASED   // Released to instructor
  FORFEITED  // Taken by platform (chargeback, etc.)
}
```

**Reserve Logic:**
```typescript
// When booking completed
async function applyReserveIfNeeded(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { instructor: true }
  });
  
  const reserve = await prisma.instructorReserve.findFirst({
    where: {
      instructorId: booking.instructorId,
      isActive: true
    }
  });
  
  if (!reserve) return; // No reserve required
  
  const reserveAmount = booking.instructorPayout * (reserve.reserveRate / 100);
  const payoutAmount = booking.instructorPayout - reserveAmount;
  
  await prisma.$transaction(async (tx) => {
    // Create reserve hold
    await tx.reserve.create({
      data: {
        instructorReserveId: reserve.id,
        bookingId,
        amount: reserveAmount,
        status: 'HELD',
        heldAt: new Date(),
        releaseAt: addDays(new Date(), reserve.holdPeriodDays)
      }
    });
    
    // Ledger: Split payout
    // Normal payout
    await createLedgerEntry(tx, {
      debitAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, booking.instructorId),
      creditAccount: buildAccountName(AccountType.INSTRUCTOR_PAID, booking.instructorId),
      amount: payoutAmount,
      description: 'Instructor payout (after reserve)',
      idempotencyKey: generateIdempotencyKey('payout-after-reserve', bookingId),
      bookingId,
      instructorId: booking.instructorId,
      createdBy: 'SYSTEM'
    });
    
    // Reserve hold
    await createLedgerEntry(tx, {
      debitAccount: buildAccountName(AccountType.INSTRUCTOR_PAYABLE, booking.instructorId),
      creditAccount: 'PLATFORM_RESERVE',
      amount: reserveAmount,
      description: `Reserve hold (${reserve.reserveRate}% for ${reserve.holdPeriodDays} days)`,
      idempotencyKey: generateIdempotencyKey('reserve-hold', bookingId),
      bookingId,
      instructorId: booking.instructorId,
      createdBy: 'SYSTEM'
    });
  });
}

// Daily job: Release expired reserves
async function releaseExpiredReserves() {
  const expiredReserves = await prisma.reserve.findMany({
    where: {
      status: 'HELD',
      releaseAt: { lte: new Date() }
    }
  });
  
  for (const reserve of expiredReserves) {
    await prisma.$transaction(async (tx) => {
      // Release to instructor
      await createLedgerEntry(tx, {
        debitAccount: 'PLATFORM_RESERVE',
        creditAccount: buildAccountName(AccountType.INSTRUCTOR_PAID, reserve.instructorId),
        amount: reserve.amount,
        description: 'Reserve released',
        idempotencyKey: generateIdempotencyKey('reserve-release', reserve.id),
        instructorId: reserve.instructorId,
        createdBy: 'SYSTEM'
      });
      
      await tx.reserve.update({
        where: { id: reserve.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date()
        }
      });
    });
  }
}

// If chargeback: Forfeit reserve
async function forfeitReserve(bookingId: string, reason: string) {
  const reserve = await prisma.reserve.findFirst({
    where: { bookingId, status: 'HELD' }
  });
  
  if (!reserve) return;
  
  await prisma.$transaction(async (tx) => {
    // Forfeit to platform
    await createLedgerEntry(tx, {
      debitAccount: 'PLATFORM_RESERVE',
      creditAccount: AccountType.PLATFORM_REVENUE,
      amount: reserve.amount,
      description: `Reserve forfeited: ${reason}`,
      idempotencyKey: generateIdempotencyKey('reserve-forfeit', reserve.id),
      bookingId,
      createdBy: 'SYSTEM'
    });
    
    await tx.reserve.update({
      where: { id: reserve.id },
      data: {
        status: 'FORFEITED',
        forfeitedAt: new Date(),
        forfeitReason: reason
      }
    });
  });
}
```

**Reserve Policies:**
- New instructors: 10% for 14 days
- High-risk instructors: 20% for 30 days
- Standard instructors: 0% (no reserve)
- Premium instructors: 0% (no reserve)

### Benefits
- Protection against delayed fraud
- Automatic release after risk window
- Can forfeit if issues arise
- Reduces platform exposure
- Industry-standard practice

---

## 🧩 7. ESCALATION AUTOMATION MATRIX

### Current Problem
Escalation is descriptive, not automatic. Admin dependency.

### Solution: Automated Escalation System
