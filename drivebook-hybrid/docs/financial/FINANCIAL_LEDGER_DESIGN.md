# FINANCIAL LEDGER DESIGN - ACCOUNT MODEL

**Date:** February 24, 2026  
**Purpose:** Design proper double-entry ledger BEFORE implementation  
**Status:** DESIGN PHASE - No code yet

---

## 🏦 ACCOUNT STRUCTURE

### Account Types (Enum)
```typescript
enum AccountType {
  // Asset Accounts (what we have)
  CLIENT_WALLET = 'CLIENT_WALLET',           // Client's prepaid balance
  PLATFORM_ESCROW = 'PLATFORM_ESCROW',       // Money held temporarily
  
  // Liability Accounts (what we owe)
  INSTRUCTOR_PAYABLE = 'INSTRUCTOR_PAYABLE', // What we owe instructors
  
  // Revenue Accounts (what we earned)
  PLATFORM_REVENUE = 'PLATFORM_REVENUE',     // Our commission earnings
  
  // Tracking Accounts
  INSTRUCTOR_PAID = 'INSTRUCTOR_PAID',       // What we've actually paid out
  STRIPE_CLEARING = 'STRIPE_CLEARING',       // Temporary for Stripe reconciliation
}
```

### Account Naming Convention
```
{ACCOUNT_TYPE}:{ENTITY_ID}

Examples:
- CLIENT_WALLET:client-123
- INSTRUCTOR_PAYABLE:instructor-456
- PLATFORM_REVENUE:platform
- PLATFORM_ESCROW:platform
```

---

## 💰 MONEY FLOW MAPPINGS

### Flow 1: Client Pays for Booking ($100)

**Scenario:** Client books lesson, pays $100  
**Commission:** 20% = $20  
**Instructor Earns:** $80

**Ledger Entries:**
```typescript
// Entry 1: Client pays into escrow
{
  debitAccount: 'CLIENT_WALLET:client-123',
  creditAccount: 'PLATFORM_ESCROW:platform',
  amount: 100.00,
  description: 'Payment for booking #booking-789',
  referenceType: 'BOOKING',
  referenceId: 'booking-789',
  idempotencyKey: 'booking-789-payment'
}

// Entry 2: Platform takes commission
{
  debitAccount: 'PLATFORM_ESCROW:platform',
  creditAccount: 'PLATFORM_REVENUE:platform',
  amount: 20.00,
  description: 'Platform commission (20%) for booking #booking-789',
  referenceType: 'BOOKING',
  referenceId: 'booking-789',
  idempotencyKey: 'booking-789-commission'
}

// Entry 3: Instructor earns payout
{
  debitAccount: 'PLATFORM_ESCROW:platform',
  creditAccount: 'INSTRUCTOR_PAYABLE:instructor-456',
  amount: 80.00,
  description: 'Instructor payout for booking #booking-789',
  referenceType: 'BOOKING',
  referenceId: 'booking-789',
  idempotencyKey: 'booking-789-payout'
}
```

**Result:**
- CLIENT_WALLET:client-123 = -$100
- PLATFORM_ESCROW:platform = $0 (in $100, out $100)
- PLATFORM_REVENUE:platform = +$20
- INSTRUCTOR_PAYABLE:instructor-456 = +$80

**Verification:** $100 = $20 + $80 ✓

---

### Flow 2: Admin Processes Payout ($80)

**Scenario:** Admin pays instructor via Stripe  
**Stripe Payout ID:** po_abc123

**Ledger Entry:**
```typescript
{
  debitAccount: 'INSTRUCTOR_PAYABLE:instructor-456',
  creditAccount: 'INSTRUCTOR_PAID:instructor-456',
  amount: 80.00,
  description: 'Payout processed via Stripe',
  referenceType: 'PAYOUT',
  referenceId: 'payout-xyz',
  metadata: {
    stripePayoutId: 'po_abc123',
    processedBy: 'admin-user-id',
    processedAt: '2026-02-24T10:00:00Z'
  },
  idempotencyKey: 'payout-xyz-stripe-po_abc123'
}
```

**Result:**
- INSTRUCTOR_PAYABLE:instructor-456 = $0 (was $80, now paid)
- INSTRUCTOR_PAID:instructor-456 = +$80

**Verification:** Payable cleared ✓

---

### Flow 3: Refund Booking ($100)

**Scenario:** Booking cancelled, full refund issued  
**Original:** Client paid $100, platform took $20, instructor earned $80

**Ledger Entries (Reverse Original):**
```typescript
// Entry 1: Reverse instructor payout
{
  debitAccount: 'INSTRUCTOR_PAYABLE:instructor-456',
  creditAccount: 'PLATFORM_ESCROW:platform',
  amount: 80.00,
  description: 'Refund: Reverse instructor payout for booking #booking-789',
  referenceType: 'REFUND',
  referenceId: 'refund-abc',
  idempotencyKey: 'refund-abc-instructor'
}

// Entry 2: Reverse platform commission
{
  debitAccount: 'PLATFORM_REVENUE:platform',
  creditAccount: 'PLATFORM_ESCROW:platform',
  amount: 20.00,
  description: 'Refund: Reverse commission for booking #booking-789',
  referenceType: 'REFUND',
  referenceId: 'refund-abc',
  idempotencyKey: 'refund-abc-commission'
}

// Entry 3: Refund to client
{
  debitAccount: 'PLATFORM_ESCROW:platform',
  creditAccount: 'CLIENT_WALLET:client-123',
  amount: 100.00,
  description: 'Refund for cancelled booking #booking-789',
  referenceType: 'REFUND',
  referenceId: 'refund-abc',
  idempotencyKey: 'refund-abc-client'
}
```

**Result:**
- CLIENT_WALLET:client-123 = $0 (back to original)
- PLATFORM_REVENUE:platform = $0 (commission reversed)
- INSTRUCTOR_PAYABLE:instructor-456 = $0 (payout reversed)

**Verification:** All accounts back to zero ✓

---

### Flow 4: Partial Refund ($50)

**Scenario:** Lesson shortened, refund 50%  
**Original:** $100 paid, $20 commission, $80 instructor  
**Refund:** $50 (proportional: $10 commission, $40 instructor)

**Ledger Entries:**
```typescript
// Entry 1: Reverse 50% of instructor payout
{
  debitAccount: 'INSTRUCTOR_PAYABLE:instructor-456',
  creditAccount: 'PLATFORM_ESCROW:platform',
  amount: 40.00,
  description: 'Partial refund: 50% instructor payout reversal',
  referenceType: 'REFUND',
  referenceId: 'refund-def',
  idempotencyKey: 'refund-def-instructor'
}

// Entry 2: Reverse 50% of commission
{
  debitAccount: 'PLATFORM_REVENUE:platform',
  creditAccount: 'PLATFORM_ESCROW:platform',
  amount: 10.00,
  description: 'Partial refund: 50% commission reversal',
  referenceType: 'REFUND',
  referenceId: 'refund-def',
  idempotencyKey: 'refund-def-commission'
}

// Entry 3: Refund 50% to client
{
  debitAccount: 'PLATFORM_ESCROW:platform',
  creditAccount: 'CLIENT_WALLET:client-123',
  amount: 50.00,
  description: 'Partial refund (50%) for booking #booking-789',
  referenceType: 'REFUND',
  referenceId: 'refund-def',
  idempotencyKey: 'refund-def-client'
}
```

**Result:**
- CLIENT_WALLET:client-123 = -$50 (paid $100, got $50 back)
- PLATFORM_REVENUE:platform = +$10 (earned $20, refunded $10)
- INSTRUCTOR_PAYABLE:instructor-456 = +$40 (earned $80, refunded $40)

**Verification:** $50 = $10 + $40 ✓

---

### Flow 5: Client Adds Wallet Credit ($200)

**Scenario:** Client adds $200 to wallet via Stripe  
**Stripe Payment Intent:** pi_xyz789

**Ledger Entry:**
```typescript
{
  debitAccount: 'STRIPE_CLEARING:platform',
  creditAccount: 'CLIENT_WALLET:client-123',
  amount: 200.00,
  description: 'Wallet credit added via Stripe',
  referenceType: 'WALLET_CREDIT',
  referenceId: 'wallet-tx-123',
  metadata: {
    stripePaymentIntentId: 'pi_xyz789',
    paymentMethod: 'card'
  },
  idempotencyKey: 'wallet-credit-pi_xyz789'
}
```

**Result:**
- CLIENT_WALLET:client-123 = +$200
- STRIPE_CLEARING:platform = -$200 (will reconcile with Stripe)

**Verification:** Money in = money out ✓

---

### Flow 6: Admin Adjusts Wallet (Manual Credit)

**Scenario:** Admin gives client $50 credit (goodwill)

**Ledger Entry:**
```typescript
{
  debitAccount: 'PLATFORM_REVENUE:platform',
  creditAccount: 'CLIENT_WALLET:client-123',
  amount: 50.00,
  description: 'Admin adjustment: Goodwill credit',
  referenceType: 'ADMIN_ADJUSTMENT',
  referenceId: 'adjustment-456',
  metadata: {
    adminId: 'admin-user-id',
    reason: 'Compensation for service issue',
    approvedBy: 'manager-user-id'
  },
  idempotencyKey: 'adjustment-456'
}
```

**Result:**
- CLIENT_WALLET:client-123 = +$50
- PLATFORM_REVENUE:platform = -$50 (cost to platform)

**Verification:** Platform pays for goodwill ✓

---

## 📊 BALANCE CALCULATIONS

### How to Calculate Any Balance:
```sql
SELECT 
  SUM(CASE WHEN creditAccount = 'CLIENT_WALLET:client-123' THEN amount ELSE 0 END) -
  SUM(CASE WHEN debitAccount = 'CLIENT_WALLET:client-123' THEN amount ELSE 0 END) as balance
FROM FinancialLedger
WHERE creditAccount = 'CLIENT_WALLET:client-123' 
   OR debitAccount = 'CLIENT_WALLET:client-123'
```

**Formula:** Balance = Credits - Debits

### Example Balances:

**Client Wallet:**
- Credits: $200 (added) + $50 (refund) = $250
- Debits: $100 (booking) = $100
- Balance: $250 - $100 = $150 ✓

**Platform Revenue:**
- Credits: $20 (commission) = $20
- Debits: $10 (refund) + $50 (adjustment) = $60
- Balance: $20 - $60 = -$40 (net loss) ✓

**Instructor Payable:**
- Credits: $80 (earned) = $80
- Debits: $40 (refund) + $80 (paid) = $120
- Balance: $80 - $120 = -$40 (overpaid!) ⚠️

---

## 🔐 IDEMPOTENCY STRATEGY

### Rules:
1. Every ledger entry MUST have unique idempotencyKey
2. Retry with same key = no-op (returns existing entry)
3. Key format: `{operation}-{reference}-{unique-id}`

### Examples:
```
booking-789-payment
booking-789-commission
booking-789-payout
payout-xyz-stripe-po_abc123
refund-abc-client
wallet-credit-pi_xyz789
```

### Implementation:
```typescript
// Unique constraint on idempotencyKey
@@unique([idempotencyKey])

// In code:
try {
  await prisma.financialLedger.create({
    data: { ...entry, idempotencyKey }
  });
} catch (error) {
  if (error.code === 'P2002') {
    // Duplicate key = already processed
    return existingEntry;
  }
  throw error;
}
```

---

## 🧮 RECONCILIATION QUERIES

### Daily Reconciliation Checks:

**1. Escrow Should Be Zero:**
```sql
-- All money in escrow should be allocated
SELECT SUM(amount) as escrow_balance
FROM (
  SELECT amount FROM FinancialLedger WHERE creditAccount = 'PLATFORM_ESCROW:platform'
  UNION ALL
  SELECT -amount FROM FinancialLedger WHERE debitAccount = 'PLATFORM_ESCROW:platform'
) t;
-- Expected: 0 or close to 0
```

**2. Payables Match Stripe:**
```sql
-- What we owe instructors
SELECT 
  creditAccount as instructor,
  SUM(amount) as payable
FROM FinancialLedger
WHERE creditAccount LIKE 'INSTRUCTOR_PAYABLE:%'
GROUP BY creditAccount;

-- Compare with Stripe pending payouts
```

**3. Revenue Matches Commissions:**
```sql
-- Platform revenue should equal all commissions minus refunds
SELECT SUM(amount) as total_revenue
FROM FinancialLedger
WHERE creditAccount = 'PLATFORM_REVENUE:platform';
```

**4. Client Wallets Match Stripe:**
```sql
-- Total client wallet balance
SELECT SUM(balance) as total_client_funds
FROM (
  SELECT 
    creditAccount,
    SUM(amount) - COALESCE((
      SELECT SUM(amount) 
      FROM FinancialLedger d 
      WHERE d.debitAccount = c.creditAccount
    ), 0) as balance
  FROM FinancialLedger c
  WHERE creditAccount LIKE 'CLIENT_WALLET:%'
  GROUP BY creditAccount
) t;

-- Should match Stripe balance
```

---

## 📋 LEDGER TABLE SCHEMA

```prisma
model FinancialLedger {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  
  // Double-entry fields
  debitAccount    String   // Account money comes FROM
  creditAccount   String   // Account money goes TO
  amount          Float    // Always positive
  
  // Metadata
  description     String
  referenceType   String   // BOOKING, PAYOUT, REFUND, WALLET_CREDIT, etc.
  referenceId     String   // ID of related entity
  metadata        Json?    // Additional context
  
  // Idempotency
  idempotencyKey  String   @unique
  
  // Audit
  createdAt       DateTime @default(now())
  createdBy       String?  // User/system that created entry
  
  // Indexes
  @@index([debitAccount])
  @@index([creditAccount])
  @@index([referenceType, referenceId])
  @@index([createdAt])
}
```

**CRITICAL RULES:**
- ❌ NO updates allowed
- ❌ NO deletes allowed
- ❌ NO balance columns
- ✅ Append-only
- ✅ Every entry is permanent
- ✅ Balance = derived from entries

---

## 🎯 MIGRATION STRATEGY

### Phase 1: Add Ledger Table
1. Add FinancialLedger model to schema
2. Run migration
3. Don't touch existing code yet

### Phase 2: Parallel Write
1. Keep existing Transaction table
2. ALSO write to FinancialLedger
3. Compare results
4. Fix discrepancies

### Phase 3: Read from Ledger
1. Change balance queries to use ledger
2. Keep Transaction table as backup
3. Verify accuracy

### Phase 4: Deprecate Old System
1. Stop writing to Transaction table
2. Archive old data
3. Remove old balance columns

---

## ✅ VALIDATION RULES

### Every Ledger Entry Must:
1. Have positive amount
2. Have valid debitAccount and creditAccount
3. Have unique idempotencyKey
4. Have referenceType and referenceId
5. Be immutable (no updates)

### System-Wide Invariants:
1. Sum of all debits = Sum of all credits (always)
2. Escrow balance ≈ 0 (within rounding)
3. Payables ≥ 0 (can't owe negative)
4. Revenue can be negative (refunds > earnings)

---

## 🚀 NEXT STEPS

1. ✅ Design complete (this document)
2. ⏭️ Implement FinancialLedger model
3. ⏭️ Create ledger service with helper functions
4. ⏭️ Add idempotency checks
5. ⏭️ Migrate ONE operation (booking payment)
6. ⏭️ Test reconciliation
7. ⏭️ Migrate remaining operations
8. ⏭️ Add daily reconciliation job

---

**Status:** DESIGN COMPLETE - Ready for implementation  
**Next:** Create FinancialLedger model in schema.prisma

**Key Insight:** Every dollar must have a source and destination. No magic balance updates.
