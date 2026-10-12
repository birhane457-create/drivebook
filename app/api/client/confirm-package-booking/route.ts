// @ts-nocheck
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { withSerializableRetry } from '@/lib/utils/transaction-retry';

export const dynamic = 'force-dynamic';

// ── SERIALIZABLE transaction config ──────────────────────────────────────────
// H-02b: Upgrade from Read Committed (Prisma default) to Serializable.
// withSerializableRetry handles P2034 (serialization failure) with backoff.
const SERIALIZABLE_TX = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5000,
  timeout: 10000,
};

// ── Helper: coerce Prisma Decimal → JS number ─────────────────────────────────
// Prisma returns Decimal objects for Decimal(n,m) columns.
// Number.isFinite(Decimal) is always false — coerce before any numeric guard.
function toJsNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'toNumber' in (val as any)) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, packageBookingId, hoursToDeduct } = body;

    if (!bookingId || !packageBookingId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── INPUT VALIDATION ──────────────────────────────────────────────────────
    // hoursToDeduct must be a finite positive number.
    // Old check: `if (!hoursToDeduct)` — falsy only, so negative values passed.
    // A negative debit would ADD to wallet balance instead of deducting (financial vulnerability).
    if (
      typeof hoursToDeduct !== 'number' ||
      !Number.isFinite(hoursToDeduct) ||
      hoursToDeduct <= 0
    ) {
      return NextResponse.json(
        { error: 'hoursToDeduct must be a finite positive number' },
        { status: 400 }
      );
    }

    // ── PRE-FLIGHT: fetch child booking + ownership check ─────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        customer: { include: { user: true } },
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify the authenticated user owns this booking's customer record.
    // Without this, any authenticated user who knows bookingId + packageBookingId
    // could confirm a booking belonging to a different student.
    if (booking.customer?.user?.email !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── SERIALIZABLE TRANSACTION ──────────────────────────────────────────────
    // All validation, wallet checks, state changes, and ledger writes are atomic.
    // withSerializableRetry retries P2034 conflicts with exponential backoff.
    const updatedBooking = await withSerializableRetry(
      () => prisma.$transaction(async (tx) => {

        // ── 1. Fetch package booking (consistent snapshot) ───────────────────
        const packageBooking = await tx.booking.findUnique({
          where: { id: packageBookingId },
          include: { provider: true },
        }) as any;

        if (!packageBooking) {
          throw Object.assign(
            new Error('Package booking not found'),
            { code: 'PACKAGE_NOT_FOUND' }
          );
        }

        // ── 2. Cross-ownership check ─────────────────────────────────────────
        // Ensure child and package belong to the same customer.
        if (packageBooking.customerId !== booking.customerId) {
          throw Object.assign(
            new Error('Package booking does not belong to the same customer'),
            { code: 'OWNERSHIP_MISMATCH' }
          );
        }

        // ── 3. Hour availability check ───────────────────────────────────────
        // H-02b-F3 FIX: derive consumed hours exclusively from child booking
        // duration records, not from packageHoursUsed + child durations combined.
        //
        // The previous formula was:
        //   availableHours = packageTotalHours - packageUsedStored - otherUsedHours
        //
        // That double-counts every confirmed lesson because:
        //   - packageHoursUsed is incremented by this route after each confirmation
        //   - otherUsedHours is the sum of durations of those same confirmed child bookings
        //
        // Example: 10hr package, 1 confirmed lesson (1hr):
        //   packageHoursUsed = 1, otherUsedHours = 1
        //   old formula: 10 - 1 - 1 = 8 (wrong — should be 9)
        //
        // Authoritative source: child booking records.
        // These exist only if a confirmation transaction committed, so they cannot
        // be stale or spoofed. packageHoursUsed is kept for display/audit purposes
        // but must not participate in the availability calculation.
        //
        // Correct formula:
        //   availableHours = packageTotalHours - sum(OTHER confirmed/completed child durations)
        const otherChildBookings = await tx.booking.findMany({
          where: {
            parentBookingId: packageBookingId,
            id: { not: bookingId },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          select: { startTime: true, endTime: true },
        });

        const packageTotalHours = toJsNumber(packageBooking.packageHours);
        // packageUsedStored intentionally not used in calculations — child booking
        // records are the authoritative source (see comment above). The counter
        // packageHoursUsed is written absolutely from child records on each confirmation.

        const otherUsedHours = otherChildBookings.reduce((sum: number, b: any) => {
          const dur =
            (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
            (1000 * 60 * 60);
          return sum + dur;
        }, 0);

        // Single source: child booking records only
        const availableHours = packageTotalHours - otherUsedHours;

        if (availableHours < hoursToDeduct) {
          throw Object.assign(
            new Error(
              `Insufficient hours. Available: ${availableHours.toFixed(2)}, Requested: ${hoursToDeduct}`
            ),
            { code: 'INSUFFICIENT_HOURS', available: availableHours, requested: hoursToDeduct }
          );
        }

        // ── 4. Locked rate: coerce and validate ──────────────────────────────
        const lockedRate = toJsNumber(
          packageBooking.lockedHourlyRate ?? booking.provider?.hourlyRate
        );

        if (!Number.isFinite(lockedRate) || lockedRate <= 0) {
          throw Object.assign(
            new Error('Package booking has no valid locked hourly rate'),
            { code: 'INVALID_LOCKED_RATE' }
          );
        }

        const transactionAmount = hoursToDeduct * lockedRate;

        // ── 5. H-02b-F1: Wallet must exist — fail closed ─────────────────────
        // Previous code: `if (userWallet) { debit }` — missing wallet silently
        // allowed booking confirmation and hour-counter decrement without any
        // wallet debit. That creates a free lesson with no financial record.
        // Fix: wallet absence is a hard error that rolls back the entire transaction.
        const userWallet = await tx.clientWallet.findFirst({
          where: { user: { email: session.user.email } },
        });

        if (!userWallet) {
          throw Object.assign(
            new Error('Student wallet not found — cannot confirm booking without a wallet'),
            { code: 'WALLET_NOT_FOUND' }
          );
        }

        // ── 6. H-02b-F2: Authoritative dollar-balance sufficiency check ───────
        // Package-hour check (step 3) verifies hour capacity but does not verify
        // that the wallet holds enough dollars to cover this lesson.
        // A student could have package hours remaining but an empty or depleted
        // wallet (e.g. refunded, admin-deducted, or drained by a different path).
        // Re-aggregate the ledger balance inside this transaction so the check
        // is atomic with the debit that follows — no TOCTOU gap.
        const creditAgg = await tx.walletTransaction.aggregate({
          where: { walletId: userWallet.id, status: 'CONFIRMED', type: 'CREDIT' },
          _sum: { amount: true },
        });
        const debitAgg = await tx.walletTransaction.aggregate({
          where: { walletId: userWallet.id, status: 'CONFIRMED', type: 'DEBIT' },
          _sum: { amount: true },
        });

        const ledgerBalance =
          toJsNumber(creditAgg._sum.amount) - toJsNumber(debitAgg._sum.amount);

        if (ledgerBalance < transactionAmount) {
          throw Object.assign(
            new Error(
              `Insufficient wallet balance. Available: $${ledgerBalance.toFixed(2)}, Required: $${transactionAmount.toFixed(2)}`
            ),
            {
              code: 'INSUFFICIENT_WALLET_BALANCE',
              available: ledgerBalance,
              required: transactionAmount,
            }
          );
        }

        // ── 7. Confirm the child booking — conditional on PENDING status ──────
        // updateMany with status: 'PENDING' predicate creates a read-write conflict
        // that Serializable isolation detects. The second concurrent transaction
        // reads PENDING, but by the time it writes the first has changed it to
        // CONFIRMED — Postgres fires P2034. withSerializableRetry retries;
        // the retry finds status !== 'PENDING', guard.count === 0 → ALREADY_CONFIRMED.
        //
        // NOTE (H-02): price remains 0. Setting the correct lesson price on child
        // bookings is a separate change blocked on package entitlement policy.
        const guard = await tx.booking.updateMany({
          where: { id: bookingId, status: 'PENDING' },
          data: {
            status: 'CONFIRMED',
            isPackageBooking: false,
            parentBookingId: packageBookingId,
            paymentIntentId: `package-${packageBookingId}-${bookingId}`,
            paidAt: new Date(),
          },
        });

        if (guard.count === 0) {
          throw Object.assign(
            new Error('Booking is no longer available to confirm'),
            { code: 'ALREADY_CONFIRMED' }
          );
        }

        // Re-fetch for return value (updateMany does not return the record)
        const confirmed = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { provider: true, customer: true },
        });

        // ── 8. Update package hour counters ──────────────────────────────────
        // H-02b-F3 FIX: derive the new counter values from the same single source
        // used in the availability check (child booking records), not from the
        // stored counter plus child records (which double-counts).
        //
        //   totalConsumedHours = otherUsedHours (already confirmed) + hoursToDeduct (this one)
        //   newHoursRemaining  = packageTotalHours - totalConsumedHours
        //   newHoursUsed       = totalConsumedHours  (set absolutely, not incremented)
        //
        // Setting packageHoursUsed absolutely (not { increment }) means the counter
        // is always consistent with child booking records regardless of any prior
        // stale values.
        const totalConsumedHours = otherUsedHours + hoursToDeduct;
        const newHoursRemaining  = Math.max(0, packageTotalHours - totalConsumedHours);
        const newPackageStatus   = totalConsumedHours >= packageTotalHours ? 'completed' : 'active';

        await tx.booking.update({
          where: { id: packageBookingId },
          data: {
            packageHoursUsed:      { set: totalConsumedHours },   // absolute, not incremental
            packageHoursRemaining: { set: newHoursRemaining },
            packageStatus:         newPackageStatus,
          },
        });

        // ── 9. Wallet debit ───────────────────────────────────────────────────
        // Balance check (step 6) already confirmed sufficient funds.
        // NOTE (H-02): debit amount uses lockedHourlyRate × hours. This will
        // change to booking.price once H-02 is implemented.
        await tx.walletTransaction.create({
          data: {
            walletId: userWallet.id,
            type: 'DEBIT',
            amount: transactionAmount,
            status: 'CONFIRMED',
            description: `Package hours used — ${hoursToDeduct}h with ${booking.provider?.name ?? 'provider'}`,
            bookingId,
          },
        });

        // Sync stored balance cache (authoritative source is always the ledger aggregate)
        await tx.clientWallet.update({
          where: { id: userWallet.id },
          data: { balance: { decrement: transactionAmount } },
        });

        // ── 10. Platform transaction record ───────────────────────────────────
        await (tx as any).transaction.create({
          data: {
            bookingId,
            providerId: booking.providerId,
            amount: transactionAmount,
            platformFee: 0,
            providerPayout: transactionAmount,
            type: 'BOOKING_PAYMENT',
            status: 'COMPLETED',
            description: `Package hours — ${hoursToDeduct}h from package ${packageBookingId}`,
            metadata: {
              bookingId,
              packageBookingId,
              hoursDeducted: hoursToDeduct,
              instructorName: booking.provider?.name,
            },
          },
        });

        return confirmed;
      }, SERIALIZABLE_TX),
      { operationName: 'confirm-package-booking' }
    );

    return NextResponse.json({
      success: true,
      bookingId: updatedBooking.id,
      message: 'Booking confirmed using package hours',
    });

  } catch (error: any) {
    console.error('Error confirming package booking:', error);

    if (error?.code === 'PACKAGE_NOT_FOUND') {
      return NextResponse.json({ error: 'Package booking not found' }, { status: 404 });
    }
    if (error?.code === 'OWNERSHIP_MISMATCH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error?.code === 'INSUFFICIENT_HOURS') {
      return NextResponse.json(
        { error: error.message, available: error.available, requested: error.requested },
        { status: 400 }
      );
    }
    if (error?.code === 'INVALID_LOCKED_RATE') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'ALREADY_CONFIRMED') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error?.code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'INSUFFICIENT_WALLET_BALANCE') {
      return NextResponse.json(
        { error: error.message, available: error.available, required: error.required },
        { status: 402 }
      );
    }

    return NextResponse.json({ error: 'Failed to confirm package booking' }, { status: 500 });
  }
}
