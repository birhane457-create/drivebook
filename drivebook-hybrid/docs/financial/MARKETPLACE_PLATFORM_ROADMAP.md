# MARKETPLACE PLATFORM ROADMAP - PRODUCTION READY

**Date:** February 24, 2026  
**Status:** Comprehensive Business Rules & System Architecture  
**Target Grade:** A (Professional Marketplace Platform)

---

## 🎯 PLATFORM VISION

**We are not building a "simple booking app."**  
**We are building a financial marketplace platform.**

This requires:
- Professional financial operations
- Clear business rules
- Dispute resolution
- Instructor classification
- Reliability tracking
- Weekly payout cycles
- Penalty management
- Complete audit trail

---

## 📋 1. REFUND & NO-SHOW POLICY (Business Rules)

### A. Student Cancels

#### 1️⃣ Early Cancellation (> 24 hours before lesson)

**Policy:**
- ✅ 100% refund to client
- ❌ Instructor not paid
- ❌ Platform commission reversed

**Ledger Entries:**
```typescript
await recordFullRefund(tx, {
  bookingId,
  userId,
  instructorId,
  clientId,
  totalAmount: 100.00,
  platformFee: 20.00,
  instructorPayout: 80.00,
  refundReason: 'Early cancellation (>24h)',
  createdBy: adminId
});
```

**Result:**
- INSTRUCTOR_PAYABLE → PLATFORM_ESCROW ($80)
- PLATFORM_REVENUE → PLATFORM_ESCROW ($20)
- PLATFORM_ESCROW → CLIENT_WALLET ($100)

---

#### 2️⃣ Late Cancellation (< 24 hours before lesson)

**Policy Options:**

**Option A: 50% Refund Policy (Recommended)**
- ✅ Client gets 50% refund
- ✅ Instructor gets 50% payout
- ✅ Platform keeps 50% commission

**Option B: Strict No-Refund Policy**
- ❌ No refund
- ✅ Instructor paid fully
- ✅ Platform keeps full commission

**Implementation (Option A):**
```typescript
await recordPartialRefund(tx, {
  bookingId,
  userId,
  instructorId,
  clientId,
  originalAmount: 100.00,
  originalPlatformFee: 20.00,
  originalInstructorPayout: 80.00,
  refundPercentage: 50,
  refundReason: 'Late cancellation (<24h)',
  createdBy: adminId
});
```

**Result:**
- Client gets: $50 back
- Instructor gets: $40 (50% of $80)
- Platform keeps: $10 (50% of $20)

---

### B. Instructor No-Show (STRICT POLICY)

**Policy (Must Protect Students):**
- ✅ 100% refund to client
- ❌ Instructor NOT paid
- ✅ Penalty applied to instructor
- ✅ Penalty deducted from next payout

**Penalty Options:**
1. **Flat Fee:** $50 per no-show
2. **Percentage:** 25% of booking amount
3. **Escalating:** Increases with repeat offenses

**Implementation:**
```typescript
await recordInstructorNoShowPenalty(tx, {
  bookingId,
  userId,
  instructorId,
  clientId,
  totalAmount: 100.00,
  platformFee: 20.00,
  instructorPayout: 80.00,
  penaltyAmount: 50.00, // Additional penalty
  createdBy: adminId
});
```

**Ledger Entries:**
1. Full refund (3 entries)
2. Additional penalty: INSTRUCTOR_PAYABLE → PLATFORM_REVENUE ($50)

**Negative Balance Handling:**
- If instructor payable = $30, penalty = $50
- Result: Payable = -$20 (negative balance)
- Carry forward to next payout period
- Next payout: Earnings - Carried Penalty

---

### C. Student No-Show (PROTECT INSTRUCTORS)

**Policy:**
- ❌ No refund
- ✅ Instructor paid fully
- ✅ Platform keeps commission
- 📄 Record no-show event (audit only)

**Implementation:**
```typescript
await recordStudentNoShow(tx, {
  bookingId,
  instructorId,
  createdBy: adminId
});
```

**Result:**
- No refund ledger entries
- Booking stands as completed
- Instructor receives full payout
- Audit trail created

---

## 📅 2. WEEKLY PAYOUT SYSTEM (Professional Setup)

### Payout Schedule

**Payout Period:**
- Monday 00:00 → Sunday 23:59

**Evaluation Window:**
- Monday + Tuesday (48 hours)
- Used for:
  - No-show disputes
  - Refund requests
  - Admin review
  - Penalty adjustments

**Payout Execution:**
- Tuesday evening (automatic batch payout)

### Weekly Flow Example

```
Week 1:
├─ Mon-Sun: Lessons delivered
├─ Mon-Tue: Evaluation window
│   ├─ Disputes processed
│   ├─ Refunds issued
│   └─ Penalties applied
└─ Tuesday 6pm: Payout executed

Week 2:
├─ Instructor receives payout
└─ Cycle repeats
```

---

## 💰 3. PENALTY CALCULATION WITH WEEKLY PAYOUT

### Scenario 1: Penalties Less Than Earnings

```
Gross Earnings:        $1,000
Penalties:             -$150
─────────────────────────────
Net Payout:            $850
```

**Ledger:**
- INSTRUCTOR_PAYABLE balance: $1,000
- Penalties deducted: $150
- Payout processed: $850

---

### Scenario 2: Penalties Exceed Earnings

```
Gross Earnings:        $100
Penalties:             -$250
─────────────────────────────
Net Payout:            $0
Remaining Penalty:     $150 (carry forward)
```

**Ledger:**
- INSTRUCTOR_PAYABLE balance: $100
- Penalties applied: $250
- Payout processed: $0
- Negative balance: -$150 (carried to next week)

**Next Week:**
```
Gross Earnings:        $500
Carried Penalty:       -$150
─────────────────────────────
Net Payout:            $350
```

**Implementation Requirements:**
- ✅ Ledger must allow negative INSTRUCTOR_PAYABLE balance
- ✅ Carry-forward tracking in Penalty table
- ✅ Clear display to instructor of carried penalties
- ✅ Automatic deduction in next payout

---

## 🔧 4. ADMIN ADJUSTMENTS (Required)

### Allowed Adjustments

**1. Manual Credit to Client**
```typescript
await recordManualAdjustment(tx, {
  targetType: 'CLIENT',
  targetId: userId,
  amount: 50.00,
  reason: 'Compensation for system outage',
  bookingId: bookingId,
  createdBy: adminId
});
```

**2. Manual Debit from Instructor**
```typescript
await recordManualAdjustment(tx, {
  targetType: 'INSTRUCTOR',
  targetId: instructorId,
  amount: -75.00, // Negative = debit
  reason: 'Policy violation penalty',
  createdBy: adminId
});
```

**3. Goodwill Compensation**
```typescript
await recordManualAdjustment(tx, {
  targetType: 'CLIENT',
  targetId: userId,
  amount: 100.00,
  reason: 'Goodwill gesture for poor experience',
  createdBy: adminId
});
```

**4. Dispute Resolution Override**
```typescript
await recordManualAdjustment(tx, {
  targetType: 'CLIENT',
  targetId: userId,
  amount: 50.00,
  reason: 'Dispute resolved in favor of client',
  bookingId: bookingId,
  createdBy: adminId
});
```

**5. Partial Settlement**
```typescript
await recordManualAdjustment(tx, {
  targetType: 'INSTRUCTOR',
  targetId: instructorId,
  amount: 25.00,
  reason: 'Partial settlement for shortened lesson',
  bookingId: bookingId,
  createdBy: adminId
});
```

### Adjustment Requirements

**All adjustments MUST:**
- ✅ Require reason (mandatory field)
- ✅ Be logged in audit trail
- ✅ Be append-only in ledger
- ✅ Record adminId who made adjustment
- ✅ Include timestamp
- ✅ Reference booking if applicable
- ✅ Be reversible (create opposite entry)
- ✅ Be explainable in reports

---

## 👥 5. INSTRUCTOR CLASSIFICATION SYSTEM

### 🥇 1. Standard Instructor

**Characteristics:**
- Normal commission rate (15-20%)
- Weekly payout
- Standard penalties
- Regular listing

**Requirements:**
- Verified documents
- Minimum 5 completed lessons
- No major violations

---

### 🥈 2. Premium Instructor

**Characteristics:**
- Lower commission (10-12%)
- Higher reliability score required
- Faster payouts (optional: bi-weekly)
- Featured listing
- Priority support

**Requirements:**
- 50+ completed lessons
- 4.8+ average rating
- < 2% no-show rate
- < 5% cancellation rate
- No disputes in last 3 months

**Benefits:**
- Featured in search results
- Badge on profile
- Lower platform fees
- Faster payout processing

---

### 🥉 3. New Instructor (Probation)

**Characteristics:**
- Higher commission (20-25%)
- Stronger penalties
- Manual payout review
- Must complete X lessons before promotion

**Requirements:**
- Just joined platform
- Documents verified
- Background checks passed

**Restrictions:**
- First 10 lessons manually reviewed
- Payouts held for 7 days
- Cannot receive advance bookings > 2 weeks
- Limited to 5 bookings per week initially

**Promotion Criteria:**
- Complete 10 lessons successfully
- Maintain 4.5+ rating
- Zero no-shows
- Zero disputes

---

### 🚫 4. Suspended Instructor

**Characteristics:**
- Cannot receive bookings
- Cannot receive payouts
- Funds held until investigation complete

**Reasons for Suspension:**
- Multiple no-shows (3+ in 30 days)
- Serious policy violations
- Fraud investigation
- Document expiry
- Safety concerns

**Process:**
- Immediate suspension
- All future bookings cancelled
- Existing bookings honored or reassigned
- Payouts frozen
- Investigation period: 7-30 days
- Resolution: Reinstate or Terminate

---

### ⭐ 5. High-Risk / Flagged Instructor

**Characteristics:**
- Manual payout review required
- Disputes tracked
- More strict evaluation window
- Enhanced monitoring

**Triggers:**
- 2 no-shows in 30 days
- 1 serious dispute
- Pattern of late cancellations
- Multiple client complaints
- Rating drops below 4.0

**Restrictions:**
- Payouts require admin approval
- 72-hour evaluation window (vs 48h)
- Cannot be featured
- Limited booking capacity
- Weekly check-ins required

**Path to Standard:**
- 20 consecutive successful lessons
- Zero issues for 60 days
- Rating improves to 4.5+
- Admin review and approval

---

## 📊 6. SYSTEM REQUIREMENTS FOR PRODUCTION

### 🔹 1. Dispute Window

**Implementation:**
- Clients can dispute within 24-48 hours after lesson
- Dispute types:
  - Instructor no-show
  - Lesson quality issue
  - Safety concern
  - Billing error
  - Other

**Workflow:**
```
Client submits dispute
  ↓
Admin notified immediately
  ↓
Instructor notified (24h to respond)
  ↓
Admin reviews evidence
  ↓
Decision made within 48h
  ↓
Refund/penalty applied
  ↓
Both parties notified
```

---

### 🔹 2. Enhanced Booking Statuses

**Current:**
- PENDING
- CONFIRMED
- COMPLETED
- CANCELLED

**Required:**
```typescript
enum BookingStatus {
  SCHEDULED = 'SCHEDULED',           // Future booking
  CONFIRMED = 'CONFIRMED',           // Confirmed by both parties
  IN_PROGRESS = 'IN_PROGRESS',       // Lesson started
  COMPLETED = 'COMPLETED',           // Lesson finished
  CANCELLED_EARLY = 'CANCELLED_EARLY', // >24h cancellation
  CANCELLED_LATE = 'CANCELLED_LATE',   // <24h cancellation
  NO_SHOW_CLIENT = 'NO_SHOW_CLIENT',   // Student didn't show
  NO_SHOW_INSTRUCTOR = 'NO_SHOW_INSTRUCTOR', // Instructor didn't show
  DISPUTED = 'DISPUTED',             // Under dispute
  REFUNDED_FULL = 'REFUNDED_FULL',   // Full refund issued
  REFUNDED_PARTIAL = 'REFUNDED_PARTIAL' // Partial refund issued
}
```

---

### 🔹 3. Penalty Tracking Table

**Schema:**
```prisma
model InstructorPenalty {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  instructorId    String   @db.ObjectId
  bookingId       String   @db.ObjectId
  penaltyAmount   Float
  penaltyType     String   // NO_SHOW, LATE_CANCEL, POLICY_VIOLATION
  status          String   // PENDING, APPLIED, CARRIED, CLEARED
  reason          String
  repeatCount     Int      @default(1) // How many times this type occurred
  appliedAt       DateTime?
  carriedForward  Boolean  @default(false)
  carriedAmount   Float?
  clearedAt       DateTime?
  createdAt       DateTime @default(now())
  
  @@index([instructorId, status])
  @@index([status])
}
```

**Penalty Types:**
- `NO_SHOW`: Instructor didn't show up
- `LATE_CANCEL`: Instructor cancelled < 24h
- `POLICY_VIOLATION`: Terms violation
- `QUALITY_ISSUE`: Repeated complaints
- `SAFETY_CONCERN`: Safety violation

**Status Flow:**
```
PENDING → APPLIED → (if exceeds earnings) → CARRIED → CLEARED
```

---

### 🔹 4. Instructor Reliability Score

**Calculation:**
```typescript
interface ReliabilityScore {
  score: number; // 0-100
  factors: {
    noShowRate: number;        // Weight: 30%
    cancellationRate: number;  // Weight: 20%
    disputeRate: number;       // Weight: 25%
    completionRate: number;    // Weight: 15%
    averageRating: number;     // Weight: 10%
  };
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  lastUpdated: Date;
}
```

**Formula:**
```typescript
function calculateReliabilityScore(instructor: Instructor): number {
  const noShowRate = (noShows / totalBookings) * 100;
  const cancellationRate = (cancellations / totalBookings) * 100;
  const disputeRate = (disputes / totalBookings) * 100;
  const completionRate = (completed / totalBookings) * 100;
  const ratingScore = (averageRating / 5) * 100;
  
  const score = (
    (100 - noShowRate) * 0.30 +
    (100 - cancellationRate) * 0.20 +
    (100 - disputeRate) * 0.25 +
    completionRate * 0.15 +
    ratingScore * 0.10
  );
  
  return Math.round(score);
}
```

**Score Ranges:**
- 90-100: Premium Instructor
- 75-89: Standard Instructor
- 60-74: High-Risk (flagged)
- < 60: Suspended

**Auto-Actions:**
- Score drops below 75: Flag for review
- Score drops below 60: Auto-suspend
- Score improves to 90+: Offer premium upgrade

---

## 🚫 7. NEVER ALLOW (Critical Rules)

### ❌ Immediate Payout After Booking
- Payouts only after evaluation window
- Minimum 48 hours after lesson completion

### ❌ Manual Status Change Without Audit
- All status changes logged
- Reason required
- Admin ID recorded

### ❌ Deleting Transactions
- Append-only ledger
- Reversals only (create opposite entry)
- No hard deletes

### ❌ Editing Amounts Directly
- All amount changes via ledger entries
- Original amounts preserved
- Adjustments tracked separately

### ✅ Everything Must:
- Go through ledger
- Be reversible
- Be traceable
- Be explainable
- Have audit trail
- Include reason
- Record who/when

---

## 📋 8. IMPLEMENTATION CHECKLIST

### Phase 1: Business Rules (Current)
- [x] Refund operations (full, partial)
- [x] Penalty system (instructor no-show)
- [x] Student no-show handling
- [x] Manual adjustments
- [x] Ledger integration
- [ ] Enhanced booking statuses
- [ ] Penalty tracking table
- [ ] Dispute window implementation

### Phase 2: Weekly Payout System
- [ ] Payout period configuration (Mon-Sun)
- [ ] Evaluation window (48h)
- [ ] Automatic payout execution (Tuesday)
- [ ] Penalty carry-forward logic
- [ ] Negative balance handling
- [ ] Payout notification system

### Phase 3: Instructor Classification
- [ ] Instructor tier system
- [ ] Reliability score calculation
- [ ] Auto-promotion/demotion logic
- [ ] Tier-based commission rates
- [ ] Featured listing for premium
- [ ] Probation period for new instructors

### Phase 4: Dispute Resolution
- [ ] Dispute submission form
- [ ] Admin dispute dashboard
- [ ] Evidence upload system
- [ ] Automated notifications
- [ ] Decision workflow
- [ ] Appeal process

### Phase 5: Advanced Features
- [ ] Automated refund processing
- [ ] Escalating penalty system
- [ ] Instructor performance dashboard
- [ ] Financial reporting
- [ ] Reconciliation automation
- [ ] Export for accounting

---

## 🎯 FINAL GRADE TARGETS

### Current State: B+
- ✅ Ledger system implemented
- ✅ Basic refund operations
- ✅ Payout eligibility enforced
- ✅ Penalty system started
- ⏳ Weekly payout not implemented
- ⏳ Instructor classification missing
- ⏳ Dispute system missing

### Target State: A (Professional Marketplace)
- ✅ Complete refund system
- ✅ Weekly payout cycle
- ✅ Instructor classification
- ✅ Reliability scoring
- ✅ Dispute resolution
- ✅ Penalty carry-forward
- ✅ Automated reconciliation
- ✅ Complete audit trail

---

## 🏁 THE BOTTOM LINE

**This is no longer a booking app.**  
**This is a financial marketplace platform.**

To reach A-level:
1. Implement weekly payout cycle
2. Add instructor classification
3. Build dispute resolution system
4. Create reliability scoring
5. Automate penalty carry-forward
6. Add comprehensive reporting

**Every feature must:**
- Protect both parties fairly
- Be financially sound
- Have complete audit trail
- Be reversible
- Be explainable
- Follow business rules

**The foundation is solid. Now we build the professional marketplace layer on top.**

---

**Status:** Roadmap Complete  
**Next Phase:** Weekly Payout Implementation  
**Timeline:** 2-4 weeks to A-level marketplace  
**Confidence:** High (clear path forward)

**We know exactly what needs to be built.**
