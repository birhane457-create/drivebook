# RECONCILIATION PROCESS

**Purpose**: Daily financial integrity checks  
**Owner**: Finance Team  
**Last Updated**: March 4, 2026  
**Scope**: Wallet, transactions, payouts  

---

## DAILY CHECKS

### 1. Wallet Balance Verification
```typescript
for (const wallet of allWallets) {
  const credits = SUM(transactions WHERE type = 'CREDIT');
  const debits = SUM(transactions WHERE type = 'DEBIT');
  const expected = credits - debits;
  
  if (wallet.balance !== expected) {
    ALERT('Wallet mismatch');
  }
}
```

### 2. Transaction-Booking Consistency
```typescript
const paidBookings = await prisma.booking.findMany({
  where: { isPaid: true }
});

for (const booking of paidBookings) {
  if (!booking.transactions.length) {
    ALERT('Missing transaction');
  }
}
```

### 3. Payout Verification
```typescript
const paidTransactions = await prisma.transaction.findMany({
  where: { status: 'PAID' }
});

for (const tx of paidTransactions) {
  if (tx.booking.status !== 'COMPLETED') {
    ALERT('Invalid payout');
  }
}
```

---

## SCHEDULE

**Time**: 2 AM daily  
**Duration**: ~5 minutes  
**Alert**: Email to finance@drivebook.com

---

## RELATED DOCUMENTS

- `../00-foundation/FINANCIAL_DOCTRINE.md` - Money flow
- `LEDGER_RULES.md` - Transaction rules

