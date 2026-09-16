═══════════════════════════════════════════════════════════════
  🔴 CRITICAL SECURITY ISSUES - BLOCKING PRODUCTION
═══════════════════════════════════════════════════════════════

File: /app/api/bookings/route.ts
Status: NOT PRODUCTION READY - 3 Critical Issues Identified
Assessment by: External Audit Review (User Feedback)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ISSUE #1: PACKAGE BOOKING BYPASS (Client-Controlled Security)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT CODE (Line ~128):
    const isPackageBooking = !!(body.packageId || body.isPackage)
    if (!isPackageBooking || !bookingSettings.packageBypassMinAdvance) {
      // Enforce minimum advance requirement
    }

PROBLEM:
    - packageId and isPackage are NOT in the Zod schema
    - Client can send { "isPackage": true } to bypass min-advance check
    - Server never verifies package ownership/validity
    - Privilege escalation vulnerability

IMPACT:
    - Clients can book with less advance notice than configured
    - Business rule bypass without authorization
    - Could be used to game peak-time restrictions

FIX REQUIRED:
    1. Remove packageId/isPackage from request body entirely
    2. Server determines package eligibility from database:
       - Query: Does customer have valid package?
       - Verify: Package belongs to this instructor
       - Check: Package not expired
       - Validate: Package has remaining credits
    3. Only then set isPackageBooking = true server-side

EXAMPLE FIX:
    // Server-side package determination
    let isPackageBooking = false
    if (client.userId) {
      const activePackage = await prisma.customerPackage.findFirst({
        where: {
          customerId: client.id,
          providerId: providerId,
          status: 'ACTIVE',
          remainingHours: { gt: 0 },
          expiresAt: { gt: now }
        }
      })
      isPackageBooking = !!activePackage
    }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ISSUE #2: LEDGER WRITE AFTER TRANSACTION COMMIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT CODE (Line ~565):
    }, SERIALIZABLE_TX)  // ← Transaction commits here
    
    // recordBookingPayment called AFTER commit
    try {
      if (booking.isPaid && client.userId) {
        await recordBookingPayment({
          bookingId: booking.id,
          userId: client.userId,
          // ...
        })
      }
    } catch (ledgerErr) {
      // Error logged but booking already committed
    }

PROBLEM:
    Booking Transaction:     ✅ COMMITTED
    Wallet Transaction:      ✅ COMMITTED  
    Financial Ledger:        ❌ FAILED
    
    Result: Accounting inconsistency

IMPACT:
    - Booking shows as CONFIRMED
    - Wallet debited
    - Financial ledger missing entry
    - Revenue reporting incorrect
    - Reconciliation fails
    - Audit trail incomplete

CLASSIFICATION:
    P1 Financial Consistency (NOT "non-blocking cleanup")

FIX OPTIONS:

Option A: Move inside transaction (recommended if recordBookingPayment supports it)
    booking = await prisma.\(async (tx) => {
      // ... create booking
      // ... create wallet transaction
      
      // Record ledger BEFORE commit
      await recordBookingPayment({
        bookingId: newBooking.id,
        // ...
      }, tx)  // ← Pass transaction client
      
      return newBooking
    }, SERIALIZABLE_TX)

Option B: Accept eventual consistency with robust reconciliation
    - Keep ledger write after commit
    - Add: Scheduled reconciliation job
    - Add: Alert on ledger write failure
    - Add: Manual reconciliation UI for ops
    - Document: This is eventual consistency by design

RECOMMENDATION:
    Option A if recordBookingPayment can accept tx parameter.
    Investigate recordBookingPayment implementation first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ISSUE #3: WALLET BALANCE FIELD STILL READ (After Removal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT CODE (Line ~677):
    const clientWallet = await prisma.clientWallet.findUnique({ 
      where: { userId: client.userId! } 
    })
    const walletAfter = toNumber(clientWallet?.balance)
    
    await sendWalletLessonReceipt({
      walletBalanceBefore: walletAfter + lessonPrice,
      walletBalanceAfter: walletAfter,
      // ...
    })

PROBLEM:
    - We removed: clientWallet.update({ balance: { decrement }})
    - But still reading: clientWallet.balance for receipts
    - Balance field is now STALE (never updated)
    - Receipt shows incorrect balance

EXAMPLE SCENARIO:
    Ledger (authoritative):      \
    clientWallet.balance (stale): \
    
    Receipt sent to customer:
    "Balance after lesson: \" ← WRONG!

IMPACT:
    - Customers receive incorrect financial information
    - Legal/compliance issue for receipts
    - Undermines ledger-authoritative architecture

FIX REQUIRED:
    Replace clientWallet.balance read with ledger aggregation:
    
    // Compute authoritative balance from ledger
    const balanceAgg = await prisma.walletTransaction.aggregate({
      where: { 
        walletId: wallet.id, 
        status: 'CONFIRMED', 
        type: 'CREDIT' 
      },
      _sum: { amount: true },
    })
    const debitAgg = await prisma.walletTransaction.aggregate({
      where: { 
        walletId: wallet.id, 
        status: 'CONFIRMED', 
        type: 'DEBIT' 
      },
      _sum: { amount: true },
    })
    const walletAfter = toNumber(balanceAgg._sum.amount) - toNumber(debitAgg._sum.amount)
    
    await sendWalletLessonReceipt({
      walletBalanceBefore: walletAfter + lessonPrice,
      walletBalanceAfter: walletAfter,
      // ...
    })

ALTERNATIVE:
    Extract balance calculation into shared helper:
    const walletAfter = await getWalletBalance(client.userId)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟠 HIGH PRIORITY: SERIALIZABLE RETRY HANDLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INCORRECT STATEMENT:
    "SERIALIZABLE transaction conflicts (PostgreSQL will auto-retry)"

REALITY:
    PostgreSQL returns serialization_failure to application.
    Application MUST retry manually.

CURRENT CODE:
    booking = await prisma.\(..., SERIALIZABLE_TX)
    
PROBLEM:
    Concurrent requests → serialization failure → 500 error
    (Not automatically retried)

FIX REQUIRED:
    async function executeWithRetry<T>(
      fn: () => Promise<T>,
      maxRetries = 3
    ): Promise<T> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error) {
          const isSerializationError = 
            error?.code === 'P2034' ||  // Prisma serialization error
            error?.message?.includes('serialization')
          
          if (!isSerializationError || attempt === maxRetries) {
            throw error
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          )
        }
      }
      throw new Error('Max retries exceeded')
    }
    
    // Usage:
    booking = await executeWithRetry(() =>
      prisma.\(async (tx) => {
        // ... booking logic
      }, SERIALIZABLE_TX)
    )

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟠 HIGH PRIORITY: ADDITIONAL VALIDATION GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. END TIME VALIDATION
   Missing: if (newEnd <= newStart) { return 400 }
   
2. DURATION BOUNDS
   Missing: Minimum/maximum duration limits
   
3. GET ENDPOINT DATE VALIDATION
   Missing: Validate from/to are valid dates
   Missing: Validate from < to
   Missing: Validate source enum

4. isFirstBooking OUTSIDE TRANSACTION
   Current: Computed before transaction
   Issue: Two concurrent bookings both see isFirstBooking=true
   Impact: Incorrect commission/promotions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REVISED PRODUCTION ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREVIOUS ASSESSMENT (Incorrect):
    "✅ Production Ready"

CORRECT ASSESSMENT:
    "❌ NOT PRODUCTION READY"
    
    Status: Production candidate pending:
    - 🔴 3 Critical security/financial fixes
    - 🟠 4 High-priority correctness fixes
    
    Classification: "Critical race-condition fixes applied;
                     financial consistency verification required."

BLOCKING ISSUES:
    1. Package bypass vulnerability (privilege escalation)
    2. Ledger write atomicity (accounting inconsistency)
    3. Receipt balance accuracy (legal/compliance)

RECOMMENDED BEFORE PRODUCTION:
    4. SERIALIZABLE retry logic
    5. End time validation
    6. isFirstBooking moved into transaction
    7. GET endpoint validation tightening

═══════════════════════════════════════════════════════════════
