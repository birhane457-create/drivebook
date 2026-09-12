# Booking Flow Audit — Implementation Plan
**Date:** 2026-09-04  
**Based On:** BOOKING_FLOW_AUDIT_2026_09_04.md  
**Status:** 📋 READY FOR EXECUTION  
---
## Executive Summary
**Total Issues:** 23 (8 HIGH, 11 MEDIUM, 3 LOW, 1 INFORMATIONAL)  
**Implementation Strategy:** Fix HIGH → MEDIUM → Defer LOW to TODO.md  
**Estimated Effort:** 2-3 sessions for HIGH, 1-2 sessions for MEDIUM  
---
## Implementation Order
### PHASE 1: CRITICAL FIXES (HIGH PRIORITY) — Start Immediately
#### FIX #1: Slot Reservation Cleanup Cron
**Issues:** #2, #21  
**Effort:** 30 minutes  
**Files to Create:**
- `lib/cron/cleanup-expired-slot-reservations.ts`
**Files to Update:**
- `app/api/cron/daily/route.ts`
**Implementation:**
```typescript
// lib/cron/cleanup-expired-slot-reservations.ts
import { prisma } from '@/lib/prisma';
export async function cleanupExpiredSlotReservations() {
  const now = new Date();
  const result = await prisma.slotReservation.deleteMany({
    where: { expiresAt: { lt: now } }
  });
  console.log(`[Cron] Deleted ${result.count} expired slot reservations at ${now.toISOString()}`);
  return {
    deleted: result.count,
    timestamp: now.toISOString(),
    success: true,
  };
}
```
**Add to `app/api/cron/daily/route.ts`:**
```typescript
import { cleanupExpiredSlotReservations } from '@/lib/cron/cleanup-expired-slot-reservations';
// Inside the POST handler:
const slotCleanup = await cleanupExpiredSlotReservations();
```
**Verification:**
- Run cron manually via admin panel
- Check logs for deletion count
- Create test slot reservation with past expiresAt, verify deletion
---
#### FIX #2: Package Hours Race Condition
**Issue:** #10  
**Effort:** 45 minutes  
**Files to Update:**
- `app/api/client/confirm-package-booking/route.ts`
**Implementation:**
Move ALL hours validation INSIDE the transaction with re-check:
```typescript
const updatedBooking = await prisma.$transaction(async (tx) => {
  // 1. Lock package booking row (prevents concurrent modifications)
  const packageBooking = await tx.booking.findUnique({
    where: { id: packageBookingId },
    select: { 
      id: true, 
      packageHours: true, 
      packageHoursUsed: true,
      packageHoursRemaining: true 
    },
  });
  if (!packageBooking) throw new Error('Package booking not found');
  // 2. Re-query other child bookings INSIDE transaction
  const otherChildBookings = await tx.booking.findMany({
    where: {
      parentBookingId: packageBookingId,
      id: { not: bookingId },
      status: { in: ['COMPLETED', 'CONFIRMED'] }
    },
    select: { startTime: true, endTime: true }
  });
  // 3. Recalculate available hours (authoritative check inside tx)
  const packageTotalHours = packageBooking.packageHours || 0;
  const packageUsedStored = packageBooking.packageHoursUsed || 0;
  const otherUsedHours = otherChildBookings.reduce((sum, b) => {
    const dur = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
    return sum + dur;
  }, 0);
  const availableHours = packageTotalHours - packageUsedStored - otherUsedHours;
  // 4. Validate INSIDE transaction (prevents TOCTOU race)
  if (availableHours < hoursToDeduct) {
    throw Object.assign(
      new Error(`Insufficient hours. Available: ${availableHours.toFixed(2)}, Requested: ${hoursToDeduct}`),
      { code: 'INSUFFICIENT_HOURS' }
    );
  }
  // 5. Now safe to proceed with atomic updates
  // ... rest of transaction logic (child booking confirm, package hours decrement, wallet)
});
```
**Verification:**
- Create concurrent requests test (2 confirmations for same package)
- Verify only one succeeds, other gets INSUFFICIENT_HOURS
- Check package hours never go negative
---
#### FIX #3: Admin Booking Wallet Race Condition
**Issue:** #18  
**Effort:** 30 minutes  
**Files to Update:**
- `app/api/admin/bookings/route.ts` (POST handler)
**Implementation:**
Move balance check INSIDE transaction:
```typescript
export async function POST(req: NextRequest) {
  // ... session and validation ...
  // REMOVE pre-flight balance check (lines 190-196)
  // Delete these lines:
  // const wallet = await prisma.clientWallet.findUnique({ ... });
  // const balance = wallet ? Number(wallet.balance) : 0;
  // if (balance < lessonPrice) { return NextResponse.json({ error: ... }); }
  // START transaction immediately
  const booking = await prisma.$transaction(async (tx) => {
    const wallet = await tx.clientWallet.findUnique({
      where: { userId: client.userId! },
      select: { id: true, balance: true },
    });
    if (!wallet) throw Object.assign(new Error('Wallet not found'), { code: 'WALLET_NOT_FOUND' });
    // Re-check balance INSIDE transaction (authoritative check)
    const balance = Number(wallet.balance);
    if (balance < lessonPrice) {
      throw Object.assign(
        new Error(`Insufficient balance. Client has $${balance.toFixed(2)}, needs $${lessonPrice.toFixed(2)}`),
        { code: 'INSUFFICIENT_BALANCE', balance, required: lessonPrice }
      );
    }
    // Now safe to decrement
    await tx.clientWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: lessonPrice } },
    });
    // ... rest of transaction (wallet transaction record, booking creation)
  });
  // Catch and handle specific error codes
  catch (txErr: any) {
    if (txErr?.code === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({
        error: txErr.message,
        insufficientBalance: true,
        balance: txErr.balance,
        required: txErr.required,
      }, { status: 422 });
    }
    if (txErr?.code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }
    throw txErr;
  }
}
```
**Verification:**
- Create concurrent admin booking requests for same client
- Verify balance never goes negative
- Check transaction rollback on insufficient balance
---
#### FIX #4: State Machine Centralization
**Issues:** #1, #20  
**Effort:** 90 minutes  
**Files to Create:**
- `lib/services/booking-state-machine.ts`
**Files to Update:**
- `app/api/bookings/[id]/route.ts` (PATCH)
- `app/api/admin/bookings/route.ts` (PATCH)
- `lib/services/booking-service.ts` (confirmBooking, cancelBooking)
- `app/api/stripe/webhook/route.ts` (payment confirmation)
**Implementation:**
**1. Create state machine validator:**
```typescript
// lib/services/booking-state-machine.ts
export type BookingStatus = 
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';
export const BOOKING_STATE_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [], // Terminal state (no transitions allowed)
  CANCELLED: [], // Terminal state (admin can override via allowAdminOverride)
  NO_SHOW: ['COMPLETED'], // Admin can resolve dispute
  EXPIRED: ['CANCELLED'], // Auto-transition only
};
export interface StateTransitionContext {
  isAdmin: boolean;
  reason?: string;
  allowAdminOverride?: boolean;
}
export interface StateTransitionResult {
  valid: boolean;
  error?: string;
  requiresAdminOverride?: boolean;
}
export function validateStateTransition(
  from: BookingStatus,
  to: BookingStatus,
  context: StateTransitionContext = { isAdmin: false }
): StateTransitionResult {
  // Same status = no transition
  if (from === to) {
    return { valid: true };
  }
  const allowedTransitions = BOOKING_STATE_TRANSITIONS[from] || [];
  // Admin override for dispute resolution
  if (context.isAdmin && context.allowAdminOverride) {
    // Allow admin to resolve NO_SHOW disputes
    if (from === 'NO_SHOW' && to === 'COMPLETED') {
      return { valid: true };
    }
    // Allow admin to reinstate CANCELLED bookings
    if (from === 'CANCELLED' && to === 'CONFIRMED') {
      return { valid: true };
    }
    // Block nonsensical admin transitions
    if (from === 'COMPLETED' && to !== 'COMPLETED') {
      return { 
        valid: false, 
        error: 'Cannot modify a completed booking. Create a new booking instead.' 
      };
    }
  }
  // Check if transition is allowed by state machine
  if (!allowedTransitions.includes(to)) {
    return {
      valid: false,
      error: `Invalid state transition: ${from} → ${to}. Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
      requiresAdminOverride: context.isAdmin && ['NO_SHOW', 'CANCELLED'].includes(from),
    };
  }
  return { valid: true };
}
export function getTerminalStatuses(): BookingStatus[] {
  return ['COMPLETED', 'CANCELLED'];
}
export function isPendingStatus(status: BookingStatus): boolean {
  return ['PENDING', 'PENDING_PAYMENT'].includes(status);
}
export function isActiveStatus(status: BookingStatus): boolean {
  return ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'].includes(status);
}
```
**2. Apply in routes:**
In `app/api/bookings/[id]/route.ts` (PATCH):
```typescript
import { validateStateTransition } from '@/lib/services/booking-state-machine';
// Before updating booking status:
if (data.status && data.status !== booking.status) {
  const transitionResult = validateStateTransition(booking.status, data.status, {
    isAdmin,
    allowAdminOverride: true,
  });
  if (!transitionResult.valid) {
    return NextResponse.json({ error: transitionResult.error }, { status: 422 });
  }
}
```
In `app/api/admin/bookings/route.ts` (PATCH):
```typescript
import { validateStateTransition } from '@/lib/services/booking-state-machine';
// Before updating booking status:
const transitionResult = validateStateTransition(booking.status, status, {
  isAdmin: true,
  allowAdminOverride: true,
});
if (!transitionResult.valid) {
  return NextResponse.json({ 
    error: transitionResult.error,
    requiresOverride: transitionResult.requiresAdminOverride,
  }, { status: 422 });
}
```
**Verification:**
- Test all allowed transitions (PENDING → CONFIRMED, etc.)
- Test blocked transitions (COMPLETED → PENDING should fail)
- Test admin overrides (CANCELLED → CONFIRMED should work for admin)
- Verify error messages are clear
---
#### FIX #5: Wallet Rate-Locking Decision (Product Decision Required)
**Issue:** #9  
**Effort:** Depends on decision  
**Options:**
**Option A: Implement Rate Locking (Technical Solution)**
- Add `lockedHourlyRate` and `lockedRateExpiry` to wallet top-up
- Apply locked rate during booking if within expiry window
- Effort: 2-3 hours (schema change + migration + logic)
**Option B: Document Current Behavior (Documentation Solution)**
- Add to platform-model.md: "Wallet credits do NOT lock instructor rates"
- Add UI warning during wallet purchase: "Instructor rates may change"
- Update wallet purchase confirmation email with rate warning
- Effort: 30 minutes
**Option C: Hybrid Approach**
- Keep current behavior (no rate lock)
- Add clear UI/email warnings
- Show current instructor rate during booking (not wallet purchase rate)
- Effort: 45 minutes
**Recommendation:** Start with **Option B** (document + warn), revisit Option A after customer feedback
**Implementation (Option B):**
1. Update `platform-model.md`:
```markdown
## Wallet Credits vs Package Rate Locking
**Packages:** Rate locked at purchase time via `lockedHourlyRate` field  
**Wallet Credits:** Use instructor's CURRENT rate at booking time (NOT locked)
**Why:**
- Packages are pre-purchased lessons at a specific rate
- Wallet credits are "book later" funds, subject to current pricing
- Instructor can raise rates between wallet purchase and booking
**Customer Communication:**
- Wallet purchase confirmation email includes rate warning
- Booking page shows current instructor rate (not wallet purchase rate)
```
2. Update wallet purchase confirmation email template
3. Add UI warning on wallet purchase page
---
### PHASE 2: CONSISTENCY FIXES (MEDIUM PRIORITY) — After Phase 1 Complete
#### FIX #6: Package Overbooking Validation
**Issue:** #3  
**Effort:** 30 minutes  
**File:** `app/api/public/bookings/bulk/route.ts`
Check if customer already has active package with this provider before allowing additional bookings from same package.
---
#### FIX #7: User Creation Race Condition
**Issue:** #4  
**Effort:** 15 minutes  
**File:** `app/api/public/bookings/bulk/route.ts`
Replace `findUnique` + `create` with `upsert`:
```typescript
const user = await prisma.user.upsert({
  where: { email: data.accountHolderEmail },
  create: { email, password: hashedPassword, role: 'CLIENT' },
  update: {}, // no-op if exists
});
```
---
#### FIX #8: Idempotency Key Length Mismatch
**Issue:** #5  
**Effort:** 15 minutes  
**Files:** All routes using idempotency keys
Standardize to 255 (matches schema) or 128 (update schema). Prefer 255.
---
#### FIX #9: Notification Retry Pattern
**Issues:** #6, #14, #22  
**Effort:** 45 minutes  
**Files:** All notification callsites
Apply consistent pattern using `enqueueNotification()` fallback on all notification failures.
---
#### FIX #10: Balance Check Method Consistency
**Issues:** #11, #23  
**Effort:** 60 minutes  
**Files:** `lib/services/wallet-helpers.ts`, all wallet balance checks
Standardize on transaction aggregate as authoritative source, document in platform-model.md.
---
#### FIX #11: Package Confirmation Field Name
**Issue:** #12  
**Effort:** 5 minutes  
**File:** `app/api/client/confirm-package-booking/route.ts`
Change `instructor` to `provider` in include clause.
---
#### FIX #12: Package Expiry Check Order
**Issue:** #13  
**Effort:** 5 minutes  
**File:** `app/api/client/schedule-package-hours/route.ts`
Reorder validation: expiry → status → hours.
---
#### FIX #13: Instructor Reschedule Penalty Audit Trail
**Issue:** #16  
**Effort:** 20 minutes  
**File:** `app/api/bookings/[id]/reschedule/route.ts`
Add audit log entry when `confirmedPenaltyWaiver` is true.
---
#### FIX #14: Admin Status Update State Validation
**Issue:** #19  
**Effort:** 15 minutes (depends on FIX #4 completion)  
**File:** `app/api/admin/bookings/route.ts`
Apply state machine validator from FIX #4.
---
### PHASE 3: DEFER TO TODO.md (LOW PRIORITY)
The following issues are LOW priority UX enhancements — add to TODO.md with cross-references:
- **#7:** PDA test booking failure handling
- **#8:** Booking email clarity for PENDING_PAYMENT
- **#14:** Client reschedule notification retry (covered by #22)
- **#17:** Offline platform client guard phone check
---
## Verification Checklist
After each fix:
- ✅ Manual testing of happy path
- ✅ Manual testing of error cases
- ✅ Concurrent request testing (for race condition fixes)
- ✅ Check audit logs created where applicable
- ✅ Update relevant DOCROLEBASE docs
- ✅ Mark issue as ✅ FIXED in audit document
---
## Documentation Updates Required
As fixes are implemented, update these docs:
1. **platform-model.md**
   - Add wallet rate-locking behavior
   - Document wallet balance authoritative source
   - Add state machine transition rules
2. **BOOKING_FLOW_AUDIT_2026_09_04.md**
   - Mark issues as ✅ FIXED as completed
   - Add "Fixed in: [PR/commit reference]" notes
3. **TODO.md**
   - Add LOW priority items from Phase 3
   - Remove HIGH/MEDIUM items as fixed
4. **CODEBASE_MAP.md** (if applicable)
   - Document new state machine validator
   - Document slot cleanup cron
---
## Rollout Strategy
### Before Starting:
1. Create feature branch: `fix/booking-audit-high-priority`
2. Ensure test environment available
3. Backup production database
### During Implementation:
1. Fix issues in order (FIX #1 → #2 → #3 → #4 → #5)
2. Commit after each fix with reference to issue number
3. Test each fix before proceeding to next
### After All HIGH Fixes Complete:
1. Full regression testing of booking flow
2. Code review with focus on race conditions
3. Deploy to staging, monitor for 24h
4. Deploy to production during low-traffic window
5. Monitor audit logs for state transition errors
### After All MEDIUM Fixes Complete:
1. Update all DOCROLEBASE docs
2. Archive audit findings doc
3. Clean up TODO.md
---
## Estimated Timeline
- **Phase 1 (HIGH):** 4-5 hours implementation + 2 hours testing = **1 full session**
- **Phase 2 (MEDIUM):** 3-4 hours implementation + 1 hour testing = **1 full session**
- **Phase 3 (LOW):** Add to TODO.md = **10 minutes**
**Total:** 2 sessions to clear all HIGH/MEDIUM issues
---
**Status:** 📋 READY FOR EXECUTION  
**Next Action:** Start with FIX #1 (Slot Reservation Cleanup Cron)  
**Created:** 2026-09-04  
**Owner:** Development Team
