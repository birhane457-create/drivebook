# Wallet Balance Synchronization Fix

**Date**: February 25, 2026  
**Issue**: `balance` and `creditsRemaining` fields are out of sync  
**Status**: 🔴 CRITICAL - System-wide fix required

---

## Problem

The ClientWallet model has TWO balance fields that should always be identical but are getting out of sync:

```prisma
model ClientWallet {
  balance           Float  @default(0)          // ❌ Sometimes wrong
  creditsRemaining  Float  @default(0)          // ✅ Usually correct
  totalPaid         Float  @default(0)
  totalSpent        Float  @default(0)
}
```

**Current State (chairman@erotc.org)**:
- `balance`: $0 ❌
- `creditsRemaining`: $957.26 ✅
- `totalPaid`: $957.26 ✅

**UI Shows**:
- Total Credits Added: $957.26 ✅
- Current Balance: $0 ❌ (reading from `balance` field)

---

## Root Causes

### 1. Inconsistent Field Updates

Different parts of the codebase update different fields:

**Some code updates `balance`**:
```typescript
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: {
    balance: { increment: amount }  // ❌ Only updates balance
  }
});
```

**Some code updates `creditsRemaining`**:
```typescript
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: {
    creditsRemaining: { increment: amount }  // ❌ Only updates creditsRemaining
  }
});
```

**Some code updates both**:
```typescript
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: {
    balance: { increment: amount },
    creditsRemaining: { increment: amount }  // ✅ Updates both
  }
});
```

### 2. No Single Source of Truth

The system doesn't enforce which field is authoritative:
- API sometimes returns `balance`
- API sometimes returns `creditsRemaining`
- UI reads from `balance`
- Calculations use `creditsRemaining`

---

## Solution: Eliminate Redundancy

### Option 1: Remove `balance` Field (RECOMMENDED)

**Rationale**: `creditsRemaining` is more descriptive and accurate.

**Schema Change**:
```prisma
model ClientWallet {
  id                String              @id @default(auto()) @map("_id") @db.ObjectId
  userId            String              @unique @db.ObjectId
  user              User                @relation(...)
  
  // ❌ REMOVE: balance           Float               @default(0)
  creditsRemaining  Float               @default(0)  // ✅ Single source of truth
  totalPaid         Float               @default(0)
  totalSpent        Float               @default(0)
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  transactions      WalletTransaction[]
}
```

**Migration**:
```javascript
// 1. Copy balance to creditsRemaining where different
await prisma.$executeRaw`
  UPDATE ClientWallet 
  SET creditsRemaining = balance 
  WHERE creditsRemaining != balance
`;

// 2. Drop balance column
// (Prisma migration will handle this)
```

**Code Updates**:
```typescript
// Before:
wallet.balance
wallet.creditsRemaining

// After:
wallet.creditsRemaining  // Only field
```

### Option 2: Keep Both But Sync (NOT RECOMMENDED)

**Rationale**: Maintains backward compatibility but adds complexity.

**Implementation**: Create a helper function that ALWAYS updates both:

```typescript
// lib/services/walletSync.ts
export async function updateWalletBalance(
  walletId: string,
  amount: number,
  operation: 'increment' | 'decrement' | 'set'
) {
  const data = operation === 'set'
    ? {
        balance: amount,
        creditsRemaining: amount
      }
    : {
        balance: { [operation]: amount },
        creditsRemaining: { [operation]: amount }
      };

  return await prisma.clientWallet.update({
    where: { id: walletId },
    data
  });
}
```

**Usage**:
```typescript
// Before:
await prisma.clientWallet.update({
  where: { id: wallet.id },
  data: { balance: { increment: 100 } }
});

// After:
await updateWalletBalance(wallet.id, 100, 'increment');
```

---

## Recommended Fix (Option 1)

### Step 1: Sync Existing Data
```javascript
// scripts/sync-wallet-balances.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncWalletBalances() {
  const wallets = await prisma.clientWallet.findMany();
  
  for (const wallet of wallets) {
    if (wallet.balance !== wallet.creditsRemaining) {
      console.log(`Syncing wallet ${wallet.id}`);
      console.log(`  balance: ${wallet.balance}`);
      console.log(`  creditsRemaining: ${wallet.creditsRemaining}`);
      
      // Use creditsRemaining as source of truth
      await prisma.clientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: wallet.creditsRemaining
        }
      });
      
      console.log(`  ✅ Synced to: ${wallet.creditsRemaining}`);
    }
  }
}

syncWalletBalances();
```

### Step 2: Update Schema
```prisma
model ClientWallet {
  id                String              @id @default(auto()) @map("_id") @db.ObjectId
  userId            String              @unique @db.ObjectId
  user              User                @relation(...)
  
  creditsRemaining  Float               @default(0)
  totalPaid         Float               @default(0)
  totalSpent        Float               @default(0)
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  transactions      WalletTransaction[]
}
```

### Step 3: Update All Code References

**Files to Update**:
1. `app/api/client/wallet/route.ts` - Return `creditsRemaining`
2. `app/api/client/wallet-add/route.ts` - Update `creditsRemaining`
3. `app/api/client/confirm-package-booking/route.ts` - Update `creditsRemaining`
4. `app/api/bookings/[id]/cancel/route.ts` - Update `creditsRemaining`
5. `app/api/admin/clients/[id]/wallet/add-credit/route.ts` - Update `creditsRemaining`
6. `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` - Update `creditsRemaining`
7. `lib/services/atomicRefund.ts` - Update `creditsRemaining`
8. All other wallet update locations

**Search & Replace**:
```bash
# Find all references to wallet.balance
grep -r "wallet\.balance" app/ lib/

# Replace with wallet.creditsRemaining
```

### Step 4: Update UI
```typescript
// app/client-dashboard/wallet/page.tsx
// Before:
<p>${wallet.balance.toFixed(2)}</p>

// After:
<p>${wallet.creditsRemaining.toFixed(2)}</p>
```

---

## Immediate Hotfix (While Planning Full Fix)

Update the wallet API to always return `creditsRemaining` as `balance`:

```typescript
// app/api/client/wallet/route.ts
return NextResponse.json({
  id: wallet.id,
  balance: wallet.creditsRemaining,  // ✅ Use creditsRemaining
  totalPaid: Number(totalPaid),
  totalSpent: Number(totalSpent),
  creditsRemaining: wallet.creditsRemaining,
  totalBookedHours,
  transactions: wallet.transactions,
  bookingsCount: bookings.length
});
```

This ensures UI shows correct balance immediately while we plan the full fix.

---

## Prevention Strategy

### 1. Single Source of Truth
- Use ONLY `creditsRemaining` field
- Remove `balance` field entirely
- No redundant data = no sync issues

### 2. Centralized Wallet Operations
Create a wallet service that handles ALL wallet updates:

```typescript
// lib/services/walletOperations.ts
export class WalletService {
  async addCredits(userId: string, amount: number, description: string) {
    const wallet = await this.getOrCreateWallet(userId);
    
    await prisma.$transaction([
      // Update wallet
      prisma.clientWallet.update({
        where: { id: wallet.id },
        data: {
          creditsRemaining: { increment: amount },
          totalPaid: { increment: amount }
        }
      }),
      
      // Create transaction
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amount,
          description,
          status: 'completed'
        }
      })
    ]);
  }
  
  async deductCredits(userId: string, amount: number, description: string, bookingId?: string) {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.creditsRemaining < amount) {
      throw new Error('Insufficient credits');
    }
    
    await prisma.$transaction([
      // Update wallet
      prisma.clientWallet.update({
        where: { id: wallet.id },
        data: {
          creditsRemaining: { decrement: amount },
          totalSpent: { increment: amount }
        }
      }),
      
      // Create transaction
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount: -amount,
          description,
          bookingId,
          status: 'completed'
        }
      })
    ]);
  }
}
```

### 3. Enforce Through Code
```typescript
// Never allow direct wallet updates
// ❌ BAD:
await prisma.clientWallet.update({ ... });

// ✅ GOOD:
await walletService.addCredits(userId, amount, description);
await walletService.deductCredits(userId, amount, description);
```

---

## Testing Checklist

- [ ] Sync all existing wallet balances
- [ ] Remove `balance` field from schema
- [ ] Update all code references
- [ ] Test package purchase → wallet credit
- [ ] Test booking from wallet → wallet debit
- [ ] Test refund → wallet credit
- [ ] Test admin wallet adjustment
- [ ] Verify UI shows correct balance
- [ ] Verify transactions create correctly
- [ ] Run full regression tests

---

## Summary

**Current Issue**:
- Two balance fields (`balance` and `creditsRemaining`) out of sync
- Inconsistent updates across codebase
- UI shows wrong balance

**Root Cause**:
- Redundant data fields
- No single source of truth
- Inconsistent update patterns

**Solution**:
1. **Immediate**: Return `creditsRemaining` as `balance` in API
2. **Short-term**: Sync all wallet balances
3. **Long-term**: Remove `balance` field, use only `creditsRemaining`
4. **Prevention**: Centralized wallet service, enforce single source of truth

**Result**:
- One balance field = no sync issues
- Centralized updates = consistent behavior
- Clear API = correct UI display
