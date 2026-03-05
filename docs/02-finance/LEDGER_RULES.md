# LEDGER RULES

**Purpose**: Transaction immutability and ledger integrity  
**Owner**: Finance Team  
**Last Updated**: March 4, 2026  
**Scope**: All financial transactions  

---

## GOLDEN RULE

**Transactions are IMMUTABLE. Never update, only create adjustments.**

---

## TRANSACTION LIFECYCLE

### 1. Original Transaction
```typescript
{
  id: "tx_001",
  type: "BOOKING_PAYMENT",
  amount: 140.00,
  status: "COMPLETED",
  createdAt: "2026-03-04T10:00:00Z"
}
```

### 2. Adjustment Transaction
```typescript
{
  id: "tx_002",
  type: "BOOKING_ADJUSTMENT",
  amount: 70.00,
  parentTransactionId: "tx_001",
  reason: "Duration increased",
  createdAt: "2026-03-04T14:00:00Z"
}
```

### 3. Refund Transaction
```typescript
{
  id: "tx_003",
  type: "REFUND",
  amount: -210.00,
  parentTransactionId: "tx_001",
  reason: "Booking cancelled",
  createdAt: "2026-03-05T09:00:00Z"
}
```

**Net Result**: $140 + $70 - $210 = $0 ✅

---

## LEDGER RECONSTRUCTION

To get complete history:
```typescript
const transactions = await prisma.transaction.findMany({
  where: { 
    OR: [
      { bookingId },
      { parentTransactionId: originalTxId }
    ]
  },
  orderBy: { createdAt: 'asc' }
});

const netAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
```

---

## ENFORCEMENT

1. **Code Review** - All transaction operations reviewed
2. **Database Constraints** - No update permissions
3. **Audit Logging** - All creations logged
4. **Daily Reconciliation** - Verify integrity

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Money flow
- `../00-foundation/SYSTEM_PRINCIPLES.md` - Immutability principle
- `RECONCILIATION_PROCESS.md` - Daily checks

