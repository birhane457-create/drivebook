# DriveBook Package Accounting Policy
## Authoritative Business Rules for H-02, H-01 and PB-UI-03 Implementation

**Version:** 1.0  
**Approved:** 2026-10-18  
**Authority:** This document defines the approved accounting model for package purchases, wallet credit, lesson pricing, platform fees, promotional discounts, and partial refunds.

---

## 1. Core Accounting Model

**Model:** Face-Value Wallet Credit (Model A)

DriveBook packages represent **dollar-based wallet credit**, not a guaranteed number of hours.

### 1.1 Package Purchase Transaction

**Example:** $700 package (10 hours × $70/hr), 5% DriveBook promotion, 5% platform fee

| Component | Amount | Notes |
|---|---|---|
| Original package value | $700.00 | Face value at purchase-time rate |
| DriveBook promotional discount | −$35.00 | 5% funded by platform |
| **Discounted package amount** | **$665.00** | Amount before platform fee |
| Platform fee (5% of $665) | $33.25 | Calculated on discounted amount |
| **Total paid by customer** | **$698.25** | Charged via Stripe |
| **Wallet credit granted** | **$700.00** | Face value credited |

**Key principle:** The $35 promotional discount is funded by DriveBook. The customer receives the full $700 face value as wallet credit.

### 1.2 Financial Records Required

Every package purchase must preserve immutably:

1. **Original package value** ($700)
2. **Purchase-time instructor rate** ($70/hr)
3. **Original advertised quantity** (10 hours — estimate only)
4. **Promotion ID and rules version**
5. **Discount percentage** (5%)
6. **Monetary discount amount** ($35)
7. **Discounted package amount** ($665)
8. **Platform fee amount** ($33.25)
9. **Platform fee rate and basis** (5% of $665)
10. **Total customer payment** ($698.25)
11. **Wallet credit granted** ($700)
12. **Purchase date/time and transaction references**

**Implementation note:** These values must NOT be recalculated or overwritten when instructor rates change.

---

## 2. Platform Fee Policy

### 2.1 Calculation Basis

The platform fee applies **after promotional discounts** and is calculated on the **discounted package amount before adding the fee itself**.

**Formula:**
```
platformFee = (originalValue - promotionalDiscount) × platformFeeRate
totalCharged = (originalValue - promotionalDiscount) + platformFee
```

**Example:**
- Original: $700
- Discount: $35
- Discounted amount: $665
- Platform fee (5% of $665): $33.25
- Total charged: $698.25
- Wallet credit: $700

### 2.2 Fee Application by Transaction Type

| Transaction Type | Platform Fee Applies? | Basis |
|---|---|---|
| Package purchase | ✅ Yes | Discounted package amount |
| Wallet top-up | ✅ Yes | Top-up amount (e.g., 5% of $200 = $10 fee) |
| Direct single-booking payment | ✅ Yes | Booking price |
| Booking paid from wallet credit | ❌ No | Fee already collected when wallet was funded; **record platformFee: 0 in booking/transaction** |

**Critical rule:** A wallet-funded booking does NOT charge a second platform fee. The fee was collected at the time the wallet credit was purchased or topped up. **Record `platformFee: 0` in the booking and transaction records** to avoid double-counting in financial reports.

### 2.3 Platform Fee Refund Policy

**The platform fee is NOT refunded under any circumstances**, including:
- Package cancellation and partial refund
- Booking cancellation
- Wallet refund requests
- Rate changes or instructor changes

The platform fee is a transaction cost, not part of the refundable balance.

---

## 3. Lesson Pricing and Wallet Debit

### 3.1 Individual Lesson Pricing

Each confirmed lesson booking must capture:

1. **Server-authorized duration** (derived from `startTime` and `endTime` in the transaction-scoped booking record)
2. **Instructor applicable to that booking**
3. **Locked hourly rate** applicable when that booking is confirmed
4. **Locked lesson price** = authorized duration × locked rate
5. **Corresponding wallet debit** = locked lesson price

**Critical rule:** The locked rate is the **instructor's applicable rate at booking confirmation time**, not the original package purchase rate.

### 3.2 Rate Change Behavior

**Scenario:** Customer purchases 10-hour package at $70/hr. Instructor later raises rate to $80/hr.

| Booking | Rate Applied | Wallet Debit | Hours Estimate |
|---|---|---|---|
| Lesson 1 (before rate change) | $70/hr | $70.00 | 1.0h consumed |
| Lesson 2 (after rate change) | $80/hr | $80.00 | 1.0h consumed |
| Remaining credit | — | $550.00 | ~6.9h at $80/hr |

**Result:** Customer does NOT receive a guaranteed 10 hours. They receive $700 of credit, which translates to fewer hours if rates increase.

### 3.3 Already-Confirmed Bookings

**Critical rule:** Already-confirmed bookings retain their locked price. A rate change does NOT retroactively change confirmed lesson prices.

Only future bookings use the new rate.

### 3.4 Insufficient Balance Behavior

If remaining wallet balance < required lesson price:
- Booking MUST fail safely
- System MUST NOT allow negative wallet balance
- Customer MUST top up wallet or select a shorter lesson duration

---

## 4. Partial Refund Accounting

### 4.1 Refund Formula

When a customer requests a partial refund, the system must:

1. Retrieve the original package purchase record (all 12 immutable values from §1.2)
2. Establish which lessons were completed/confirmed
3. Use the **actual locked prices** of confirmed lessons (not stale hour counters)
4. Determine whether the original discount remains eligible for the reduced quantity
5. Calculate refundable amount using authoritative ledger records
6. Keep platform fee separate and non-refundable

**Core formula:**
```
consumedValue = SUM(confirmed child Booking.price)
remainingCredit = originalWalletCredit - consumedValue
eligibleDiscount = determineEligibleDiscount(originalPromo, remainingQuantity)
refundableAmount = remainingCredit - voidedPromotionalCredit
```

### 4.2 Discount Eligibility Re-evaluation

**Example:** 10-hour package purchased with 5% discount. Customer uses 5 hours and requests refund.

**If no 5-hour discount exists:**
- Original package value: $700 (10 hours)
- Original discount: $35 (5%)
- Discounted amount paid: $665
- Consumed lessons: 5 hours × $70/hr = $350
- The customer no longer qualifies for the 10-hour discount tier
- Consumed value at full price: $350
- Refund: $665 − $350 = $315

**If a 5-hour discount exists (e.g., 3%):**
- Apply the 5-hour discount rules to determine the refund
- Use the recorded promotion terms to determine eligibility

**Critical rule:** Do NOT automatically preserve the original discount percentage when the qualifying conditions are no longer met.

### 4.3 Refund Treatment of Promotional Credit

**Scenario:** $700 package, $35 promotional discount, $665 paid, 5 hours consumed.

Under the approved policy:
- The $35 promotional credit is **not cash-backed**
- If the original discount no longer qualifies, the promotional portion can be **voided**
- Only the **cash-backed portion** of the remaining balance is refunded

**Implementation requirement:** The system must distinguish:
- **Cash-backed credit** (from customer payment)
- **Promotional credit** (funded by DriveBook)

When a refund is triggered, check if the reduced package size still qualifies for the original promotion. If not, void the promotional credit portion and refund only the cash-backed portion.

### 4.4 Platform Fee Treatment in Refunds

The platform fee ($33.25 in the example) is **never refunded**, regardless of:
- How many lessons were consumed
- Whether the package is fully or partially refunded
- The reason for cancellation

The platform fee is a non-refundable transaction cost.

### 4.5 Required Refund Behavior

The refund service (`calculatePartialPackageRefund()`) must:

1. Retrieve the package purchase record with all 12 preserved values
2. Query confirmed/completed child bookings (NOT a stale hour counter)
3. Sum actual `Booking.price` values to determine consumed value
4. Re-evaluate discount eligibility based on remaining quantity
5. Distinguish cash-backed vs promotional credit
6. Apply only the eligible promotion rules
7. Calculate refundable amount excluding platform fee
8. Prevent duplicate refunds, over-refunds, negative balances
9. Record calculation inputs, discount adjustment, refund amount, ledger entries for audit

**Critical rule:** Do NOT use `packageHoursRemaining` or any stale counter. Use `SUM(child Booking.price WHERE status IN ('CONFIRMED', 'COMPLETED'))`.

---

## 5. UI Display Policy (PB-UI-03)

### 5.1 Primary Display: Dollar Balance

**Student dashboard and booking gates MUST display wallet dollar balance as the primary entitlement metric.**

**Example display:**
```
Your Package Balance: $550.00
Estimated hours remaining: ~6.9 hours at $80/hr
```

### 5.2 Hours as Secondary Estimate

Hours may be shown as an **estimate only**, with clear qualifiers:

✅ Acceptable:
- "~6.9 hours at current instructor rate of $80/hr"
- "Estimated 6.9 hours (rate may vary)"
- "Your $550 credit is approximately 6.9 hours at $80/hr"

❌ Not acceptable:
- "6.9 hours remaining" (implies guarantee)
- "You have 6.9 lessons left" (implies fixed quantity)

### 5.3 Rate Qualifier Required

Whenever an hour estimate is shown, the **applicable rate MUST be displayed** alongside it:

```
Wallet Balance: $550.00
≈ 6.9 hours at $80/hr (instructor's current rate)
```

### 5.4 Booking Gate Logic

**Do NOT rely on `packageHoursRemaining` counter.**

**Correct gate:**
```typescript
const requiredAmount = requestedDuration × instructorCurrentRate
if (walletBalance < requiredAmount) {
  // Block booking or prompt top-up
}
```

**Incorrect gate:**
```typescript
if (packageHoursRemaining < requestedHours) { // WRONG — stale counter
  // Block booking
}
```

---

## 6. Implementation Sequence

**Required order:**

1. **H-02** — Fix child booking `price: 0`
   - Replace with `authorizedDuration × lockedRate`
   - Locked rate = instructor's applicable rate at booking confirmation time
   - Do NOT blindly inherit original package rate
   - Ensure wallet debit, platformFee, providerPayout, commissionRate reconcile

2. **H-01** — Fix refund formula
   - Replace `packageHoursRemaining` counter with `SUM(child Booking.price)`
   - Implement discount eligibility re-evaluation
   - Distinguish cash-backed vs promotional credit
   - Keep platform fee non-refundable

3. **PB-UI-03** — Update dashboard display
   - Make dollar balance primary
   - Show hours as estimate with rate qualifier
   - Fix booking gate to use wallet balance check

---

## 7. Test Requirements

### 7.1 H-02 Tests

- Rate change: customer books lessons before and after instructor rate change
- Multiple instructors: package lessons with different instructors at different rates
- Insufficient credit: booking requires more credit than available
- Concurrent booking attempts with same package
- Retries/idempotency
- Discount-funded package purchases
- Wallet debit, instructor payout, platform fee, ledger entries reconcile

### 7.2 H-01 Tests

- 10-hour package with 5% discount, 5 hours consumed, no eligible 5-hour discount → refund calculation
- 10-hour package with 5% discount, 5 hours consumed, eligible 5-hour discount exists → refund calculation
- Multiple locked lesson rates (instructor raised rate mid-package)
- Cancelled bookings vs completed bookings treatment
- Duplicate refund attempts (idempotency)
- Balance boundaries (over-refund prevention, negative balance prevention)
- Platform fee confirmed non-refunded

### 7.3 PB-UI-03 Tests

- Dashboard displays dollar balance as primary
- Hours shown as estimate with rate
- Booking gate uses wallet balance, not stale counter
- Rate change updates estimate but not balance
- Multiple rate scenarios

---

## 8. Policy Questions Resolved

| Question | Answer |
|---|---|
| **POL-01:** Wallet credit basis | Face value ($700) |
| **POL-02:** Promotion funding | DriveBook funds the discount ($35) |
| **POL-03:** Platform fee basis | Discounted package amount before fee ($665) |
| **POL-04:** Platform fee itemization | Added on top, itemized separately ($33.25) |
| **POL-05:** Wallet top-up fee | 5% of top-up amount; credited amount excludes fee |
| **POL-06:** Wallet booking fee | No second fee — already collected when wallet funded |
| **POL-07:** Lesson pricing | Locked rate at booking confirmation time |
| **POL-08:** Rate change impact | Future bookings only; confirmed bookings retain price |
| **POL-09:** Insufficient balance | Booking fails; no negative balance allowed |
| **POL-10:** Platform fee refund | Never refunded |
| **POL-11:** Discount re-evaluation | If reduced package no longer qualifies, promotional credit voided |
| **POL-12:** Promotional vs cash-backed | Promotional credit can be voided; only cash-backed refunded |
| **POL-13:** Primary entitlement metric | Dollar balance, not hours |
| **POL-14:** Hours display | Estimate only, with rate qualifier |
| **POL-15:** Booking gate logic | Wallet balance ≥ required amount |

---

## 9. Non-Refundable Items Summary

The following are **never refunded**:
1. Platform fee (on any transaction type)
2. Promotional credit that no longer qualifies
3. DriveBook-funded discount portion (if original discount tier no longer applies)

---

## 10. Interface Language Requirements

### 10.1 Package Purchase Page

**Required statement:**
> "This package provides **$700 in wallet credit**, initially estimated as 10 hours at the current instructor rate of $70/hour. The actual number of hours you can book may vary if instructor rates change. Your credit is valid for 12 months from your last account activity."

**NOT allowed:**
> "10-hour package" (without dollar qualifier)
> "10 guaranteed hours"

### 10.2 Receipt/Confirmation Email

**Required breakdown:**
```
Package Purchase Receipt

Original Package Value:     $700.00
Instructor: [Name]
Estimated Hours: 10 hours at $70/hr

DriveBook Promotional Discount (5%):  -$35.00
Discounted Package Amount:             $665.00
Platform Fee (5%):                      $33.25
─────────────────────────────────────
Total Charged:                         $698.25

Wallet Credit Granted:                 $700.00

Note: Your wallet credit is dollar-denominated. The number of 
hours you can book depends on the instructor's rate at the time 
of each booking. Rates may change. Platform fee is non-refundable.
```

### 10.3 Refund Communication

**Required statement:**
> "Your refund is calculated based on the actual lesson prices charged to your wallet, minus any promotional credit that no longer qualifies for the reduced package size. The platform fee of $[amount] is non-refundable."

---

## 11. Enforcement

This policy is **authoritative** for all H-02, H-01, and PB-UI-03 implementation work.

Any deviation from this policy must be approved in writing and documented as a policy amendment with a new version number.

**Implementation blocker removed:** All three findings (H-02, H-01, PB-UI-03) may now proceed to implementation phase following the sequence in §6.

---

**Approval:**  
User (Independent Reviewer): Approved 2026-10-18  
Kiro (Implementing Agent): Policy acknowledged; ready to implement
