# Package Refund Approval Workflow — Safety Gate Design

**Date:** September 1, 2026  
**Status:** 🔴 Required before production launch  
**Priority:** HIGH  

---

## 🚨 CRITICAL CORRECTION: Refund Destination

**Package refunds must go to Stripe/card, NOT wallet.**

**Why:**
1. Customer buys 10hr package for $630 → Stripe charges card → money held by Stripe
2. Webhook fires → $630 **credited to customer wallet** (WalletTransaction CREDIT)
3. Customer books lessons → each booking **deducts from wallet** (WalletTransaction DEBIT)
4. After 5 lessons: wallet shows $280 remaining (unused credit)

**When canceling:**
- ❌ DO NOT refund to wallet — money already there, would double-credit
- ✅ DO issue **Stripe refund to original card**
- ✅ ALSO deduct $280 from wallet (WalletTransaction DEBIT) to zero it out

**Coordinated actions:**
```
1. stripe.refunds.create({ payment_intent, amount: 280 }) → $280 back to card
2. WalletTransaction.create({ type: DEBIT, amount: 280, reason: "Refunded to card" })
3. Result: Customer gets money on card, wallet zeroed
```

**Everywhere below that says "credited to wallet" should read "refunded to card".**

**Related:** PKG-3 in TODO.md

---

## Problem Statement

**Current behavior:**
- Customer cancels package booking → refund calculated instantly using `calculatePartialPackageRefund()` → wallet credited automatically
- Admin has no opportunity to review calculation before money moves
- If tier-aware calculation has bugs or edge cases, incorrect refunds issued immediately
- Customer disputes difficult to resolve ("system already refunded you $280")

**Risk:**
- New tier-aware logic launched Sept 1, 2026 — untested in production
- Calculation involves multiple steps (hours used, tier mapping, discount recalc)
- Edge cases: boundary conditions (exactly 6hrs, 10hrs, 15hrs), fractional hours, multiple bookings from same package
- Financial impact of bugs: under-refund → customer complaints, over-refund → revenue loss

---

## Proposed Solution

**Manual approval workflow for package cancellations** — admin reviews and approves/rejects before refund issues.

### Phase 1: Manual Review (Launch → 6 months)
- All package cancellations require admin approval
- Customer requests cancellation → status `CANCELLATION_PENDING` → no refund yet
- Admin reviews calculation → approves/adjusts/rejects → refund issued
- Builds confidence in tier-aware calculation accuracy

### Phase 2: Auto-Approve with Monitoring (6-12 months)
- After 6 months of zero calculation errors, add "Auto-approve package refunds" admin setting
- System auto-approves straightforward cases (e.g., full refund >48h notice, standard tiers)
- Edge cases still require manual review (e.g., custom hours, adjusted bookings)
- Admin can revert to manual-only if errors detected

### Phase 3: Full Automation (12+ months)
- High confidence in calculation accuracy
- Auto-approve all package refunds
- Admin reviews exceptions only (disputes, fraud flags)

---

## Workflow Design

### Customer Journey

**Step 1:** Customer navigates to their bookings dashboard  
**Step 2:** Clicks "Cancel" on a package booking  
**Step 3:** System shows refund preview:
```
┌─ Cancellation Request ────────────────────────────────┐
│ Package: 10 hours                                     │
│ Hours used: 5                                         │
│ Hours remaining: 5                                    │
│                                                       │
│ Refund calculation:                                   │
│ • Amount paid: $630                                   │
│ • Amount for 5 used hours (0% tier): $350            │
│ • Refundable amount: $280                            │
│ • Cancellation timing: >48h (100% policy)            │
│ • Final refund to wallet: $280                       │
│                                                       │
│ ⚠️ Refund requires admin approval                     │
│ You'll receive email confirmation within 24 hours.    │
└───────────────────────────────────────────────────────┘
```
**Step 4:** Customer clicks "Request Cancellation"  
**Step 5:** Status → `CANCELLATION_PENDING`  
**Step 6:** Email sent to customer: "Cancellation request received — awaiting review"  
**Step 7:** Email sent to admin: "Package cancellation pending approval"

### Admin Journey

**Step 1:** Admin receives email notification or checks `/admin/cancellations` queue  
**Step 2:** Sees list of pending cancellations:
```
┌─ Pending Package Cancellations (3) ─────────────────────┐
│                                                          │
│ [Customer]       [Instructor]  [Package]  [Refund]  [⏱] │
│ John Smith      Jane Doe       10hr       $280      2h  │
│ Mary Johnson    Bob Lee        15hr       $450      5h  │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```
**Step 3:** Admin clicks a cancellation → detail modal opens:
```
┌─ Review Cancellation Request ────────────────────────────┐
│ Customer: John Smith (john@example.com)                  │
│ Instructor: Jane Doe                                     │
│ Booking Date: Sept 15, 2026 2:00pm                      │
│ Requested: Sept 1, 2026 10:30am (14 days notice)        │
│                                                          │
│ Package Details:                                         │
│ • Hours purchased: 10                                    │
│ • Total paid: $630 (@ $70/hr with 10% discount)         │
│ • Locked rate: $70/hr                                    │
│ • Original discount: 10%                                 │
│                                                          │
│ Usage:                                                   │
│ • Hours used: 5 (lessons completed: 5)                   │
│ • Hours remaining: 5                                     │
│ • Last lesson: Aug 28, 2026                              │
│                                                          │
│ Tier-Aware Refund Calculation:                          │
│ 1. Hours used: 5 → qualifies for 0% discount            │
│    (need 6+ hours for 5% discount)                      │
│ 2. Amount for used hours:                                │
│    5 × $70 × (1 - 0%) = $350                             │
│ 3. Refundable base:                                      │
│    $630 - $350 = $280                                    │
│ 4. Cancellation policy (14 days = >48h):                │
│    100% refund                                           │
│ 5. Final refund to wallet: $280                          │
│                                                          │
│ Customer reason: "Moving interstate, can't continue"     │
│                                                          │
│ Admin actions:                                           │
│ [Approve & Refund $280] [Adjust Amount] [Reject]        │
└──────────────────────────────────────────────────────────┘
```
**Step 4:** Admin reviews calculation, checks for anomalies  
**Step 5:** Admin chooses action:

---

## Admin Actions

### 1. **Approve & Refund** (Happy Path)
- Confirms calculation is correct
- Clicks "Approve & Refund $280"
- System:
  1. Status → `CANCELLED`
  2. `cancellationStatus` → `APPROVED`
  3. Credit $280 to customer wallet (`WalletTransaction` created)
  4. Send email to customer: "Cancellation approved — $280 credited to your wallet"
  5. Send email to instructor: "Booking cancelled by customer (approved by admin)"
  6. Audit log: `CANCELLATION_APPROVED` with admin ID + reason
- Time to complete: < 1 minute

### 2. **Adjust Amount** (Override)
- Admin notices calculation error or special circumstance
- Clicks "Adjust Amount" → modal opens:
```
┌─ Adjust Refund Amount ──────────────────────────────────┐
│ Calculated refund: $280                                 │
│                                                         │
│ Override amount: [____] (enter new amount)              │
│                                                         │
│ Reason (required):                                      │
│ [__________________________________________________]   │
│ Examples:                                               │
│ • "Calculation error — boundary condition at 6 hours"   │
│ • "Goodwill gesture — instructor no-showed last lesson" │
│ • "Pro-rated for partial lesson attended"               │
│                                                         │
│ [Approve with Adjusted Amount] [Cancel]                 │
└─────────────────────────────────────────────────────────┘
```
- Admin enters new amount + reason
- Clicks "Approve with Adjusted Amount"
- System:
  1. Status → `CANCELLED`
  2. `cancellationStatus` → `APPROVED`
  3. `adminOverrideAmount` → new amount
  4. `adminReviewNote` → reason
  5. Credit adjusted amount to wallet
  6. Email customer with explanation
  7. Audit log: `CANCELLATION_ADJUSTED` with before/after amounts + reason
- Use case: Calculation bugs, goodwill adjustments, partial lessons

### 3. **Reject** (Keep Booking Active)
- Customer canceling too late (<24h), fraudulent request, or policy violation
- Clicks "Reject" → modal opens:
```
┌─ Reject Cancellation Request ───────────────────────────┐
│ Reason for rejection (required):                        │
│ [__________________________________________________]   │
│ Examples:                                               │
│ • "Less than 24h notice — no refund per policy"         │
│ • "Booking already started"                             │
│ • "Suspected abuse — customer pattern"                  │
│                                                         │
│ Alternative action:                                     │
│ [ ] Offer partial refund (50%)                          │
│ [ ] Reschedule instead of cancel                        │
│                                                         │
│ [Confirm Rejection] [Cancel]                            │
└─────────────────────────────────────────────────────────┘
```
- Admin enters reason
- Clicks "Confirm Rejection"
- System:
  1. Status remains `CONFIRMED` (booking stays active)
  2. `cancellationStatus` → `REJECTED`
  3. `adminReviewNote` → reason
  4. Email customer: "Cancellation request rejected — [reason]"
  5. Audit log: `CANCELLATION_REJECTED` with reason
- Use case: Policy violations, late cancellations, fraud prevention

---

## Database Schema Changes

### New Booking Fields

```prisma
model Booking {
  // ... existing fields ...

  // Cancellation workflow (new)
  cancellationStatus        String?   @default(null)  // null | PENDING | APPROVED | REJECTED
  cancellationRequestedAt   DateTime?
  cancellationRequestedBy   String?   // USER or ADMIN
  adminReviewedAt           DateTime?
  adminReviewedBy           String?   // admin user ID
  adminReviewNote           String?   @db.Text
  adminOverrideAmount       Decimal?  @db.Decimal(10, 2)  // if admin adjusts refund
}
```

### Migration SQL

```sql
ALTER TABLE "Booking" 
  ADD COLUMN "cancellationStatus" TEXT DEFAULT NULL,
  ADD COLUMN "cancellationRequestedAt" TIMESTAMP,
  ADD COLUMN "cancellationRequestedBy" TEXT,
  ADD COLUMN "adminReviewedAt" TIMESTAMP,
  ADD COLUMN "adminReviewedBy" TEXT,
  ADD COLUMN "adminReviewNote" TEXT,
  ADD COLUMN "adminOverrideAmount" DECIMAL(10,2);

-- Index for pending queue queries
CREATE INDEX "idx_booking_cancellation_pending" ON "Booking" ("cancellationStatus", "cancellationRequestedAt")
  WHERE "cancellationStatus" = 'PENDING';
```

---

## API Endpoints

### Customer-Facing

**POST `/api/bookings/[id]/request-cancellation`**
- Body: `{ reason?: string }`
- Auth: Customer owns booking
- Action:
  1. Validate booking is cancellable (not completed/cancelled)
  2. Calculate refund using `calculatePartialPackageRefund()`
  3. Set status → `CANCELLATION_PENDING`
  4. Send notifications (customer + admin)
- Response: `{ success: true, calculatedRefund: 280, status: 'PENDING', message: 'Awaiting admin approval' }`

### Admin-Facing

**GET `/api/admin/cancellations/pending`**
- Returns list of pending cancellation requests
- Sorted by request date (oldest first)

**POST `/api/admin/cancellations/[id]/approve`**
- Body: `{ amount?: number, note?: string }`
- Auth: Admin only
- Action:
  1. Validate still pending
  2. Use amount param (if provided) or calculated amount
  3. Issue refund to wallet
  4. Update status → `CANCELLED`, `cancellationStatus` → `APPROVED`
  5. Send notifications
  6. Audit log
- Response: `{ success: true, refundAmount: 280 }`

**POST `/api/admin/cancellations/[id]/reject`**
- Body: `{ reason: string }`
- Auth: Admin only
- Action:
  1. Validate still pending
  2. Set `cancellationStatus` → `REJECTED`
  3. Keep booking active
  4. Send notification to customer
  5. Audit log

---

## Admin Dashboard UI

### New Page: `/admin/cancellations`

**Tab 1: Pending (default)**
- Shows all bookings with `cancellationStatus = PENDING`
- Columns: Customer, Instructor, Package, Hours Used, Calculated Refund, Requested, Age
- Click row → detail modal with approve/adjust/reject buttons
- Badge showing count: "Pending (3)"

**Tab 2: Approved**
- Shows cancellations with `cancellationStatus = APPROVED`
- Filterable by date range
- Shows refund amount (calculated vs adjusted)
- CSV export

**Tab 3: Rejected**
- Shows cancellations with `cancellationStatus = REJECTED`
- Shows rejection reason
- CSV export

### Integration with Existing `/admin/bookings`

- Add status filter option: "Cancellation Pending"
- Show badge on package bookings: "🕒 Cancellation Pending"
- Click booking → show "Review Cancellation" button if pending

---

## Notifications

### Customer: Cancellation Requested

**Subject:** Cancellation Request Received — [Instructor Name]

**Body:**
> Hi [Customer],
>
> We've received your request to cancel your 10-hour package booking with [Instructor].
>
> **Refund Details:**
> - Hours used: 5 of 10
> - Refund amount: $280 (based on tier-appropriate rate for hours used)
>
> Your request is being reviewed by our team. You'll receive confirmation within 24 hours.
>
> If you have questions, reply to this email.

### Admin: Cancellation Requires Review

**Subject:** 🚨 Package Cancellation Pending Approval

**Body:**
> **Customer:** John Smith (john@example.com)  
> **Instructor:** Jane Doe  
> **Package:** 10 hours (5 used, 5 remain)  
> **Calculated refund:** $280  
> **Requested:** Sept 1, 2026 10:30am (14 days notice)
>
> [Review in Dashboard →](/admin/cancellations)

### Customer: Cancellation Approved

**Subject:** Cancellation Approved — $280 Refund Credited

**Body:**
> Hi [Customer],
>
> Your cancellation request has been approved.
>
> **Refund summary:**
> - Hours used: 5 (charged at $70/hr with 0% discount)
> - Refund amount: $280 credited to your DriveBook wallet
>
> You can use your wallet credit to book future lessons with any instructor.

### Customer: Cancellation Rejected

**Subject:** Cancellation Request — Unable to Process

**Body:**
> Hi [Customer],
>
> Unfortunately, we're unable to approve your cancellation request.
>
> **Reason:** [admin note]
>
> Your booking with [Instructor] on [date] remains active. If you have questions or would like to discuss alternatives, please reply to this email.

---

## Monitoring & Metrics

### Admin Dashboard Widgets

**1. Pending Queue Health**
- Count of pending cancellations
- Oldest pending age (warn if >24h)
- Average approval time

**2. Calculation Accuracy**
- % of cancellations approved without adjustment
- % requiring override
- Common override reasons

**3. Financial Impact**
- Total refunds issued (month)
- Average refund amount
- Refund rate (cancellations / bookings)

### Alert Thresholds

- ⚠️ **>5 pending cancellations** — email admin
- 🚨 **Pending >48h** — escalate to senior admin
- 📊 **>10% override rate** — investigate calculation bugs

---

## Rollout Plan

### Phase 1: Launch (Sept 2026)
✅ Implement approval workflow  
✅ All package cancellations require manual review  
✅ Admin dashboard `/admin/cancellations` live  
✅ Monitor for calculation errors  
✅ Target: <24h approval time  

### Phase 2: Confidence Building (Oct 2026 - Mar 2027)
✅ Track: zero calculation errors for 6 consecutive months  
✅ Document edge cases discovered  
✅ Refine tier boundary logic if needed  
✅ Train additional admin staff  

### Phase 3: Semi-Automation (Apr 2027)
✅ Add admin setting: "Auto-approve package refunds"  
✅ Criteria for auto-approve:
  - Standard tier (6/10/15 hrs)
  - No manual adjustments to booking
  - >48h notice (full refund)
  - Customer has <3 cancellations in 6 months
✅ Edge cases still require manual review

### Phase 4: Full Automation (Oct 2027)
✅ Auto-approve all package refunds  
✅ Admin reviews exceptions only (disputes, fraud flags)  
✅ Keep audit trail for compliance  

---

## Benefits

✅ **Risk mitigation** — catches calculation errors before refunds issued  
✅ **Customer trust** — human review signals care and fairness  
✅ **Audit trail** — full documentation for disputes  
✅ **Gradual rollout** — build confidence in tier-aware logic  
✅ **Data collection** — learn which cases need special handling  
✅ **Quality control** — spot edge cases early  

---

## Alternatives Considered

### Option A: Automatic with Post-Audit
- Auto-refund immediately, admin reviews after
- ❌ Rejected: Too late to catch errors, customer already has money

### Option B: Automatic with Confidence Thresholds
- Auto-refund if calculation confidence >95%, else manual review
- ❌ Rejected: Complex to implement, hard to define "confidence"

### Option C: Manual Review Forever
- Always require admin approval
- ❌ Rejected: Doesn't scale, slows customer experience long-term

### Option D: Hybrid (Chosen)
- Manual review initially → semi-auto → full auto over 12 months
- ✅ Balances safety, customer experience, and scalability

---

**Status:** Ready for implementation  
**Next Step:** Create schema migration, implement approval workflow (PKG-3 in TODO)  
**Success Criteria:** Zero incorrect refunds in first 6 months, <24h approval time, customer satisfaction >95%
