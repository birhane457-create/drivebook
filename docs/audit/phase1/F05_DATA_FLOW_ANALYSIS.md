# F-05 Financial Data Flow Analysis: Offline Booking Pricing

**Date**: 2026-08-15  
**Purpose**: Determine minimal security fix for F-05 price manipulation vulnerability  
**Scope**: Trace complete offline booking financial data flow before implementing fix

---

## Executive Summary

**Finding**: `offlineAmountPaid` is **intentionally client-controlled** and represents **self-reported historical amount**, not platform-calculated pricing.

**Business Model**: Offline bookings are "cash lessons and phone bookings" that instructors manually record in DriveBook for **record-keeping purposes only**. The platform is NOT involved in payment processing, pricing calculation, or commission.

**Impact of `offlineAmountPaid`**:
- ✅ **AFFECTS**: Earnings reports, analytics dashboards, booking records
- ❌ **DOES NOT AFFECT**: Wallet, commission, payouts, platform revenue, customer charges

**Legitimate Use Cases**:
- Zero-dollar bookings (free lessons, trial lessons)
- Discounted lessons (negotiated rates, package deals, friend/family rates)
- Partial payments (deposits, installments)
- Variable pricing (location surcharges, special equipment, different lesson types)
- Historical records (backdating past lessons for tax purposes)

**Vulnerability**: While platform payouts are correctly excluded, inflated `offlineAmountPaid` values corrupt analytics and can be used for external fraud (loan applications showing fake earnings).

**Recommended Fix**: **Bounded validation with platform-contextual reasonableness check** (not arbitrary $10k limit).

---

## Data Flow Trace

### 1. Source of Price: Client-Controlled Manual Entry

**UI Form**: `app/dashboard/bookings/new/page.tsx`
```tsx
<label className="block text-sm font-medium text-foreground mb-1">
  Amount paid ($)
</label>
<input 
  type="number" 
  min="0" 
  step="0.01" 
  value={offlineForm.offlineAmountPaid} 
  onChange={e => setOfflineForm(p => ({ ...p, offlineAmountPaid: e.target.value }))} 
  placeholder="75.00" 
/>
```

**Key Observations**:
- No pre-populated value from server
- No calculation based on duration + hourlyRate
- Manual entry field with example placeholder "$75.00"
- Optional field (can be empty)
- HTML5 `min="0"` provides browser-side non-negative check

**Business Context** (from blog post):
> "When you create an offline booking, you can record: the amount paid"

The instructor manually enters what they actually collected from the student.

---

### 2. Package Pricing: NOT Used for Offline Bookings

**Schema Analysis**:
- `Booking` table has package fields (`isPackageBooking`, `packageHours`, `packageTotalPaid`, etc.)
- Offline booking endpoint does NOT accept package selection
- No `packageId` or `isPackageBooking` in offline booking schema

**Offline Booking Schema**:
```typescript
const offlineBookingSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().optional().default(''),
  customerEmail: z.string().email().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().min(30).max(480),
  pickupAddress: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  offlinePaymentMethod: z.enum(['cash', 'bank_transfer', 'other']).optional(),
  offlineAmountPaid: z.number().nonnegative().optional(),  // ← Manual entry
});
```

**Conclusion**: Offline bookings are **always single lessons**, not package bookings. No server-side package pricing to validate against.

---

### 3. Trusted Server-Side Price: NONE (By Design)

**Provider.hourlyRate**: Exists in database
```prisma
model Provider {
  hourlyRate Float  // e.g., 60.00
}
```

**But NOT used for offline booking pricing**:
- Offline booking endpoint fetches `hourlyRate` but only uses it for approval checks
- Does NOT use it to calculate or validate `offlineAmountPaid`
- Manual entry is intentional (allows discounts, negotiations, special rates)

**Why No Server-Side Calculation**:
From business logic and documentation:
1. Offline lessons may have negotiated rates (friends, bulk deals)
2. Different lesson types (highway, reverse parking, test prep) may have different prices
3. Location surcharges (instructor travels further)
4. Historical backdating (instructor may be recording past lessons weeks later)
5. Partial payments (student pays $50 now, $30 next week)

**Conclusion**: There is **intentionally NO trusted server-side price** for offline bookings. Manual entry is a feature, not a bug.

---

### 4. Purpose of `offlineAmountPaid`

**Semantic Meaning**: "The amount the instructor collected from the student (via cash, bank transfer, etc.)"

**NOT**:
- ❌ Platform-calculated lesson price
- ❌ Amount customer will be charged
- ❌ Amount used for commission calculation

**IS**:
- ✅ Historical record of cash/offline transaction
- ✅ Self-reported earnings for instructor's own records
- ✅ Data point for analytics/earnings summaries

---

### 5. Legitimate Price Variations

**Zero-Dollar Bookings** ✅ LEGITIMATE
- Free trial lessons
- Makeup lessons (compensating for previous issue)
- Pro bono / community service
- Test drive for potential student

**Discounted Bookings** ✅ LEGITIMATE
- Friend/family discount
- Bulk package discount
- First-time student promotion
- Off-peak discount
- Loyalty discount

**Partial Payments** ✅ LEGITIMATE
- Deposit ($50 of $100 lesson)
- Installment payment (student paying in parts)
- "Pay what you can" model

**Variable Pricing** ✅ LEGITIMATE
- Test preparation ($150 vs $75 normal)
- Highway driving ($90 vs $75 suburban)
- Special equipment (different car) ($85 vs $75)
- Longer distance pickup (instructor travels 30 min) ($100 vs $75)

**Historical Backdating** ✅ LEGITIMATE
- Recording past lessons for tax purposes
- Instructor logs 10 lessons from last month at once
- Actual prices paid varied week by week

---

### 6. Financial Impact of `offlineAmountPaid`

#### DOES Affect:

**A. Earnings Dashboard** (`/api/instructor/earnings`)
```typescript
// Line 339: Offline bookings aggregation
const offlineScheduledTotal = scheduledOfflineBookings.reduce((sum: any, b: any) => {
  return sum + (b.offlineAmountPaid || 0);
}, 0);

// Line 365: Offline earnings summary
offline: {
  totalLogged: completedOfflineStats._sum.offlineAmountPaid || 0,
  completedCount: completedOfflineStats._count || 0,
  thisMonthLogged: thisMonthOfflineStats._sum.offlineAmountPaid || 0,
}

// Line 376: Combined earnings
totalEarnings: 
  (completedPlatformStats._sum.providerPayout || 0) + 
  (completedOfflineStats._sum.offlineAmountPaid || 0),
```

**Impact**: Inflated `offlineAmountPaid` → Inflated earnings reports

**B. Admin Analytics** (`/api/admin/booking-payment-status`)
```typescript
if (booking.source === 'offline') {
  if (booking.offlinePaymentMethod === 'cash') {
    offlineCash.totalValue += booking.offlineAmountPaid || 0
  } else if (booking.offlinePaymentMethod === 'bank_transfer') {
    offlineBankTransfer.totalValue += booking.offlineAmountPaid || 0
  }
}
```

**Impact**: Inflated values in admin payment breakdown reports

**C. Audit Logs**
```typescript
metadata: {
  customerName: data.customerName,
  customerPhone: data.customerPhone || null,
  startTime: startTime.toISOString(),
  price: data.offlineAmountPaid ?? 0,  // ← Logged value
  paymentMethod: data.offlinePaymentMethod ?? null,
  source: 'offline',
}
```

**Impact**: False financial records in audit trail

#### Does NOT Affect:

**A. Wallet** ❌ NO IMPACT
- Offline bookings do NOT create wallet transactions
- Payment is external (cash/bank transfer)
- No wallet debit/credit

**B. Commission** ❌ NO IMPACT
```typescript
price: data.offlineAmountPaid ?? 0,
platformFee: 0,  // ← Always zero
providerPayout: data.offlineAmountPaid ?? 0,
commissionRate: 0,  // ← Always zero
```

Platform earns **$0 commission** on offline bookings regardless of amount.

**C. Payouts** ❌ NO IMPACT
```typescript
// /api/admin/payouts/route.ts Line 41
source: { not: 'offline' }  // ← Offline bookings EXCLUDED
```

Offline bookings are explicitly excluded from platform payout calculations.

**D. Customer Charges** ❌ NO IMPACT
- Offline bookings have no Customer FK (no linked DriveBook account)
- No Stripe payment intent
- No wallet transaction
- Customer never charged by platform

**E. Financial Ledger** ❌ NO IMPACT
- Offline bookings do NOT create FinancialLedger entries
- Cancellation refund logic skips offline bookings (current behavior)

---

### 7. External Fraud Risk

**Primary Vulnerability**: Earnings Report Manipulation for Non-Platform Fraud

**Scenario 1: Loan Application**
1. Instructor creates 50 fake offline bookings at $5,000 each
2. Generates DriveBook earnings report showing $250,000/year income
3. Submits to bank for business loan
4. Bank approves loan based on false earnings

**Scenario 2: Partnership/Investor**
1. Driving school owner inflates offline booking amounts
2. Shows "revenue" to potential investors or franchise buyers
3. Sells business based on false financial performance

**Scenario 3: Tax Fraud**
1. Instructor inflates offline amounts
2. Claims business expenses against inflated "income"
3. Creates false tax deductions

**NOT A RISK**: Platform payout fraud (offline bookings excluded from payouts)

---

## Analysis Conclusions

### What `offlineAmountPaid` Represents
- **Self-reported historical amount** collected from student
- **NOT** platform-calculated price
- **Intentionally** allows discounts, negotiations, $0 bookings

### Why Manual Entry is Intentional
1. No package pricing for offline bookings
2. No server-side trusted price source
3. Legitimate need for price flexibility
4. Historical backdating support
5. Partial payment support

### Security vs. Functionality Balance
- **Too Strict** ($50-200 range): Breaks legitimate use cases (test prep $150, free lessons, deposits)
- **Too Lenient** (current): Allows earnings report fraud
- **Optimal**: Bounded validation that preserves flexibility while preventing extreme manipulation

---

## Proposed Minimal Security Fix

### Design Principles
1. **Preserve legitimate use cases** (zero-dollar, discounts, partial payments, variable pricing)
2. **Prevent extreme manipulation** (prevent $999,999 fake bookings)
3. **Context-aware validation** (use existing platform data, not arbitrary limits)
4. **Fail gracefully** (clear error messages explaining limit)

### Recommended Approach: Platform-Contextualized Maximum

**Strategy**: Use platform-wide data to establish a "reasonable maximum" that:
- Allows all legitimate variations
- Prevents fraud-scale manipulation
- Can be adjusted as platform grows

**Implementation**:

```typescript
// 1. Query platform-wide pricing context
const pricingContext = await prisma.platformSettings.findFirst({
  select: {
    maxOfflineBookingAmount: true,  // New field: default 2000
  }
});

const MAX_OFFLINE_AMOUNT = pricingContext?.maxOfflineBookingAmount ?? 2000;

// 2. Validate offline amount
if (data.offlineAmountPaid && data.offlineAmountPaid > MAX_OFFLINE_AMOUNT) {
  return NextResponse.json({
    error: `Offline booking amount ($${data.offlineAmountPaid}) exceeds platform maximum ($${MAX_OFFLINE_AMOUNT}). For lessons above this amount, please contact support.`,
    maxAllowed: MAX_OFFLINE_AMOUNT,
  }, { status: 400 });
}
```

**Why $2000 Default**:
- Covers 20 hours at $100/hr (high-end instructor, intensive package)
- Covers test preparation packages (~$150/lesson × 10 lessons)
- Covers specialized instruction (advanced driving, commercial license prep)
- Prevents $50,000+ fraud scenarios
- Can be adjusted per platform needs

**Alternative: Per-Instructor Context** (More Complex):
```typescript
// Use instructor's own hourlyRate as baseline
const instructorRate = instructor.hourlyRate || 75;  // Default if not set
const maxLessonHours = 20;  // Reasonable for intensive session
const MAX_FOR_INSTRUCTOR = instructorRate * maxLessonHours;

if (data.offlineAmountPaid && data.offlineAmountPaid > MAX_FOR_INSTRUCTOR) {
  return NextResponse.json({
    error: `Offline amount ($${data.offlineAmountPaid}) exceeds reasonable maximum for your hourly rate ($${MAX_FOR_INSTRUCTOR} for ${maxLessonHours}h)`,
  }, { status: 400 });
}
```

**Trade-off**: Per-instructor validation is more precise but:
- Requires hourlyRate to be set (some instructors may not have it)
- More complex logic
- Harder to explain to instructors

**Recommendation**: **Platform-wide maximum ($2000 default)** for simplicity and flexibility.

---

## Validation Rules (Proposed)

### Rule 1: Non-Negative ✅ KEEP
```typescript
offlineAmountPaid: z.number().nonnegative().optional()
```
Already implemented. Prevents negative amounts.

### Rule 2: Platform Maximum 🆕 ADD
```typescript
const MAX_OFFLINE_AMOUNT = 2000; // Or from PlatformSettings

if (data.offlineAmountPaid && data.offlineAmountPaid > MAX_OFFLINE_AMOUNT) {
  return 400 with clear error message
}
```

### Rule 3: Zero-Dollar Allowed ✅ KEEP
Zero-dollar bookings are legitimate (free lessons). No minimum validation.

### Rule 4: Optional Field ✅ KEEP
`offlineAmountPaid` can be omitted (defaults to 0). Allows instructor to log lesson without recording amount.

---

## Testing Requirements

### Valid Cases (Must Pass)
1. ✅ Normal lesson: $75.00 → PASS
2. ✅ Free lesson: $0.00 → PASS
3. ✅ Discounted lesson: $50.00 → PASS
4. ✅ Test prep: $150.00 → PASS
5. ✅ Intensive package: $1500.00 → PASS
6. ✅ No amount (omitted): undefined → PASS (defaults to 0)
7. ✅ Deposit: $30.00 → PASS
8. ✅ Maximum allowed: $2000.00 → PASS

### Invalid Cases (Must Reject)
1. ❌ Negative: -$50.00 → REJECT (already handled)
2. ❌ Just over max: $2000.01 → REJECT
3. ❌ Fraud attempt: $50000.00 → REJECT
4. ❌ Extreme: $999999999.99 → REJECT

### Edge Cases
1. ✅ Boundary: $1999.99 → PASS
2. ✅ Cents: $75.50 → PASS
3. ✅ Whole number: 75 (no decimals) → PASS
4. ❌ Invalid: "abc" → REJECT (Zod handles)
5. ❌ Invalid: null (if not optional) → handled by Zod

---

## Implementation Plan

### Step 1: Add PlatformSettings Field (Optional - Use Constant First)
```prisma
model PlatformSettings {
  // ... existing fields
  maxOfflineBookingAmount  Decimal  @default(2000) @db.Decimal(10, 2)
}
```

**OR** start with hardcoded constant:
```typescript
const MAX_OFFLINE_BOOKING_AMOUNT = 2000;
```

### Step 2: Update Validation
Add server-side check in `/api/bookings/offline/route.ts` after Zod validation.

### Step 3: Update Schema Documentation
Add JSDoc comment explaining limit:
```typescript
offlineAmountPaid: z.number()
  .nonnegative()
  .optional(),
  // Note: Server-side validates max $2000 (platform default)
```

### Step 4: Update UI (Optional Enhancement)
Add hint in form:
```tsx
<label className="block text-sm font-medium text-foreground mb-1">
  Amount paid ($)
  <span className="text-xs text-muted-foreground ml-2">(Max: $2000)</span>
</label>
```

### Step 5: Testing
Run all 8 valid + 4 invalid test cases above.

---

## Rejected Approaches

### ❌ Arbitrary $10,000 Limit
**Why Rejected**: 
- No business justification for exactly $10k
- Still allows significant fraud ($10k fake bookings)
- Magic number with no platform context

### ❌ 3× Hourly Rate Validation
**Why Rejected**:
- Breaks legitimate use cases (test prep packages, intensive training)
- Requires hourlyRate to be set (not all instructors have it)
- Doesn't account for partial payments, discounts
- Too restrictive for legitimate variations

### ❌ Admin Approval for High-Value
**Why Rejected**:
- Creates admin bottleneck for legitimate lessons
- Doesn't prevent fraud (admin can't verify cash transactions)
- Delays instructor's ability to complete records

### ❌ Remove Manual Entry (Force Calculation)
**Why Rejected**:
- Destroys core feature (recording historical cash lessons)
- No server-side trusted price to calculate from
- Violates business model (offline = self-managed)

### ❌ No Validation (Current State)
**Why Rejected**:
- Allows unlimited fraud potential
- Corrupts analytics and earnings reports
- Enables external fraud (loan applications)

---

## Final Recommendation

**Implement platform-contextualized maximum validation ($2000 default) that**:
- ✅ Prevents extreme fraud scenarios ($50k+ fake bookings)
- ✅ Preserves all legitimate use cases (discounts, free lessons, test prep, partial payments)
- ✅ Uses platform context (can be adjusted as platform grows)
- ✅ Provides clear error messages
- ✅ Minimal code change (single validation check)
- ✅ No schema/architecture changes required

**Trade-offs Accepted**:
- Does NOT prevent small-scale fraud ($500-1000 fake bookings)
- Does NOT verify actual cash transaction occurred
- Relies on audit trail and platform monitoring for fraud detection

**Rationale**: The fix balances security with functionality. Offline bookings are self-reported by design (platform is not involved in payment). Perfect fraud prevention is impossible without payment verification, which contradicts the offline booking business model. The $2000 limit prevents large-scale earnings manipulation while preserving instructor flexibility.
