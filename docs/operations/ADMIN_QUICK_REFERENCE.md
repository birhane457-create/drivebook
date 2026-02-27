# ADMIN QUICK REFERENCE - FINANCIAL LEDGER

**Last Updated:** February 24, 2026  
**For:** Platform Administrators  
**Status:** Dual-Write Phase Active

---

## 🎯 WHAT IS THIS?

The platform now uses a **Financial Ledger System** to track all money movements. This is a major upgrade from the old status-based system.

### Why This Matters:
- **Complete Audit Trail**: Every dollar tracked from source to destination
- **Reconciliation**: Can verify against Stripe at any time
- **No Lost Money**: Append-only system prevents data loss
- **Regulatory Compliance**: Meets accounting standards

---

## 📊 CURRENT STATUS

### Dual-Write Phase (Active Now)
- **Old System**: Still running (safety net)
- **New Ledger**: Running in parallel
- **Verification**: Automatic balance checks after each transaction
- **Duration**: 1 week minimum before full migration

### What's Migrated:
✅ Wallet credit additions  
✅ Bulk booking payments  
⏳ Single bookings (in progress)  
⏳ Payout processing (next)  
⏳ Refunds (next)  

---

## 🔍 HOW TO CHECK LEDGER STATUS

### 1. Check if Ledger Entry Exists for Booking

**Via Database:**
```javascript
// In MongoDB or Prisma Studio
db.FinancialLedger.find({ bookingId: "booking-id-here" })
// Should return 3 entries for each booking
```

**Via API (coming soon):**
```
GET /api/admin/ledger/booking/{bookingId}
```

### 2. Check Client Wallet Balance

**Old System:**
```javascript
db.ClientWallet.findOne({ userId: "user-id" })
// Look at creditsRemaining field
```

**New Ledger:**
```javascript
db.FinancialLedger.aggregate([
  {
    $match: {
      $or: [
        { creditAccount: "CLIENT_WALLET:user-id" },
        { debitAccount: "CLIENT_WALLET:user-id" }
      ]
    }
  },
  {
    $group: {
      _id: null,
      credits: {
        $sum: {
          $cond: [
            { $eq: ["$creditAccount", "CLIENT_WALLET:user-id"] },
            "$amount",
            0
          ]
        }
      },
      debits: {
        $sum: {
          $cond: [
            { $eq: ["$debitAccount", "CLIENT_WALLET:user-id"] },
            "$amount",
            0
          ]
        }
      }
    }
  },
  {
    $project: {
      balance: { $subtract: ["$credits", "$debits"] }
    }
  }
])
```

**These should match!** If they don't, investigate immediately.

### 3. Check Instructor Payables

**Old System:**
```javascript
db.Transaction.aggregate([
  { $match: { status: "PENDING" } },
  { $group: { _id: "$instructorId", total: { $sum: "$instructorPayout" } } }
])
```

**New Ledger:**
```javascript
db.FinancialLedger.aggregate([
  {
    $match: {
      creditAccount: { $regex: /^INSTRUCTOR_PAYABLE:/ }
    }
  },
  {
    $group: {
      _id: "$creditAccount",
      credits: { $sum: "$amount" }
    }
  }
])
// Then subtract any debits from INSTRUCTOR_PAYABLE accounts
```

---

## 🚨 WHAT TO WATCH FOR

### Red Flags:

**1. Balance Mismatch**
```
[Ledger] BALANCE MISMATCH DETECTED
  ledgerBalance: 100.00
  oldBalance: 95.00
  difference: 5.00
```

**Action:**
- Check application logs for this message
- Note the userId and timestamp
- Investigate which transaction caused mismatch
- Report to development team immediately

**2. Ledger Write Failure**
```
[Ledger] Failed to record booking payment: Error...
```

**Action:**
- Booking still created (old system works)
- But ledger entry missing
- Note the bookingId
- Report to development team
- May need manual ledger entry

**3. Idempotency Key Collision**
```
Error: Duplicate key error on idempotencyKey
```

**Action:**
- This is actually GOOD (prevents duplicates)
- But if happening frequently, investigate
- May indicate retry logic issues

---

## 📋 DAILY CHECKS (RECOMMENDED)

### Morning Routine:

**1. Check for Mismatches (5 min)**
```bash
# Search application logs for:
grep "MISMATCH DETECTED" logs/app.log
```

**2. Verify Escrow Balance (2 min)**
```javascript
// Escrow should always be $0 or very close
db.FinancialLedger.aggregate([
  {
    $match: {
      $or: [
        { creditAccount: "PLATFORM_ESCROW" },
        { debitAccount: "PLATFORM_ESCROW" }
      ]
    }
  },
  {
    $group: {
      _id: null,
      credits: {
        $sum: {
          $cond: [
            { $eq: ["$creditAccount", "PLATFORM_ESCROW"] },
            "$amount",
            0
          ]
        }
      },
      debits: {
        $sum: {
          $cond: [
            { $eq: ["$debitAccount", "PLATFORM_ESCROW"] },
            "$amount",
            0
          ]
        }
      }
    }
  }
])
// Balance should be 0 ± $0.01
```

**3. Check Recent Bookings Have Ledger Entries (3 min)**
```javascript
// Get bookings from last 24 hours
const recentBookings = db.Booking.find({
  createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) },
  createdBy: "client"
})

// For each booking, check ledger entries
recentBookings.forEach(booking => {
  const entries = db.FinancialLedger.find({ bookingId: booking.id })
  if (entries.length !== 3) {
    console.log(`WARNING: Booking ${booking.id} has ${entries.length} entries (expected 3)`)
  }
})
```

---

## 🔧 COMMON ISSUES & FIXES

### Issue 1: Client Says Balance is Wrong

**Steps:**
1. Check old system balance:
   ```javascript
   db.ClientWallet.findOne({ userId: "user-id" })
   ```

2. Check ledger balance (use query above)

3. Compare the two

4. If mismatch:
   - Check recent transactions
   - Look for failed ledger writes
   - Check for duplicate entries
   - Report to dev team

### Issue 2: Instructor Not Paid But Shows as Paid

**Steps:**
1. Check Payout record:
   ```javascript
   db.Payout.findOne({ instructorId: "instructor-id", status: "paid" })
   ```

2. Check ledger entries:
   ```javascript
   db.FinancialLedger.find({ payoutId: "payout-id" })
   // Should have 2 entries
   ```

3. Check Stripe payout:
   - Go to Stripe dashboard
   - Search for stripePayoutId
   - Verify status

4. If Stripe shows failed but we show paid:
   - This is a critical issue
   - Report immediately
   - May need to reverse ledger entries

### Issue 3: Booking Created But No Ledger Entries

**Steps:**
1. Check if booking was created by instructor or client:
   ```javascript
   db.Booking.findOne({ id: "booking-id" })
   // Look at createdBy field
   ```

2. If `createdBy: "instructor"`:
   - This is expected (instructor bookings don't use ledger yet)
   - Will be migrated soon

3. If `createdBy: "client"`:
   - This is a problem
   - Check application logs for errors
   - Report to dev team
   - May need manual ledger entry

---

## 📊 REPORTS YOU CAN RUN

### Platform Revenue (This Month)
```javascript
db.FinancialLedger.aggregate([
  {
    $match: {
      creditAccount: "PLATFORM_REVENUE",
      createdAt: {
        $gte: new Date("2026-02-01"),
        $lt: new Date("2026-03-01")
      }
    }
  },
  {
    $group: {
      _id: null,
      totalRevenue: { $sum: "$amount" }
    }
  }
])
```

### Instructor Payables (What We Owe)
```javascript
db.FinancialLedger.aggregate([
  {
    $match: {
      $or: [
        { creditAccount: { $regex: /^INSTRUCTOR_PAYABLE:/ } },
        { debitAccount: { $regex: /^INSTRUCTOR_PAYABLE:/ } }
      ]
    }
  },
  {
    $group: {
      _id: {
        $cond: [
          { $regexMatch: { input: "$creditAccount", regex: /^INSTRUCTOR_PAYABLE:/ } },
          "$creditAccount",
          "$debitAccount"
        ]
      },
      credits: {
        $sum: {
          $cond: [
            { $regexMatch: { input: "$creditAccount", regex: /^INSTRUCTOR_PAYABLE:/ } },
            "$amount",
            0
          ]
        }
      },
      debits: {
        $sum: {
          $cond: [
            { $regexMatch: { input: "$debitAccount", regex: /^INSTRUCTOR_PAYABLE:/ } },
            "$amount",
            0
          ]
        }
      }
    }
  },
  {
    $project: {
      instructor: "$_id",
      balance: { $subtract: ["$credits", "$debits"] }
    }
  },
  {
    $match: {
      balance: { $gt: 0 }
    }
  }
])
```

### Client Wallet Balances (Total Held)
```javascript
db.FinancialLedger.aggregate([
  {
    $match: {
      $or: [
        { creditAccount: { $regex: /^CLIENT_WALLET:/ } },
        { debitAccount: { $regex: /^CLIENT_WALLET:/ } }
      ]
    }
  },
  {
    $group: {
      _id: {
        $cond: [
          { $regexMatch: { input: "$creditAccount", regex: /^CLIENT_WALLET:/ } },
          "$creditAccount",
          "$debitAccount"
        ]
      },
      credits: {
        $sum: {
          $cond: [
            { $regexMatch: { input: "$creditAccount", regex: /^CLIENT_WALLET:/ } },
            "$amount",
            0
          ]
        }
      },
      debits: {
        $sum: {
          $cond: [
            { $regexMatch: { input: "$debitAccount", regex: /^CLIENT_WALLET:/ } },
            "$amount",
            0
          ]
        }
      }
    }
  },
  {
    $project: {
      client: "$_id",
      balance: { $subtract: ["$credits", "$debits"] }
    }
  },
  {
    $group: {
      _id: null,
      totalClientFunds: { $sum: "$balance" }
    }
  }
])
```

---

## 🎓 UNDERSTANDING THE LEDGER

### Account Types:

**CLIENT_WALLET:user-id**
- Client's prepaid balance
- Money they've added but not spent

**PLATFORM_ESCROW**
- Temporary holding account
- Should always be $0 (money flows through, not stored)

**PLATFORM_REVENUE**
- Commission we've earned
- Our actual income

**INSTRUCTOR_PAYABLE:instructor-id**
- What we owe each instructor
- Cleared when we process payout

**INSTRUCTOR_PAID:instructor-id**
- What we've actually paid out
- Historical record

### Money Flow Example:

**Client books $100 lesson (20% commission):**

1. **Entry 1:** CLIENT_WALLET → PLATFORM_ESCROW ($100)
   - Client's money moves to escrow

2. **Entry 2:** PLATFORM_ESCROW → PLATFORM_REVENUE ($20)
   - We take our commission

3. **Entry 3:** PLATFORM_ESCROW → INSTRUCTOR_PAYABLE ($80)
   - Instructor's share allocated

**Result:**
- Client wallet: -$100
- Platform revenue: +$20
- Instructor payable: +$80
- Escrow: $0 (all allocated)

**When we pay instructor:**

4. **Entry 4:** INSTRUCTOR_PAYABLE → INSTRUCTOR_PAID ($80)
   - Mark as paid

**Result:**
- Instructor payable: $0 (cleared)
- Instructor paid: +$80 (historical record)

---

## 🚨 EMERGENCY PROCEDURES

### If You Suspect Data Loss:

1. **STOP** - Don't make any changes
2. **DOCUMENT** - Screenshot everything
3. **NOTIFY** - Contact development team immediately
4. **PRESERVE** - Don't delete any records

### If Stripe and Ledger Don't Match:

1. Export Stripe payout report
2. Export ledger entries for same period
3. Compare line by line
4. Document discrepancies
5. Report to development team

### If Client Complains About Balance:

1. Check old system balance
2. Check ledger balance
3. Check recent transactions
4. If mismatch, escalate immediately
5. Don't manually adjust until investigated

---

## 📞 WHO TO CONTACT

### For Technical Issues:
- Development team
- Include: userId/bookingId, timestamp, error message

### For Financial Discrepancies:
- Development team + Finance team
- Include: amounts, accounts involved, expected vs actual

### For Stripe Issues:
- Development team
- Include: Stripe payout ID, amount, status

---

## 🏁 SUMMARY

**The ledger is your friend.**

It provides:
- Complete audit trail
- Reconciliation capability
- Regulatory compliance
- Data integrity

**During dual-write phase:**
- Both systems run in parallel
- Automatic verification
- Old system is safety net
- Report any mismatches

**After full migration:**
- Ledger becomes source of truth
- Old system deprecated
- Better reporting
- Easier reconciliation

**Your role:**
- Monitor for mismatches
- Run daily checks
- Report issues promptly
- Trust the ledger

---

**Status:** Dual-Write Active  
**Next Review:** After 1 week of testing  
**Questions?** Contact development team

**Remember:** If ledger and old system disagree, investigate immediately. Don't ignore mismatches.
