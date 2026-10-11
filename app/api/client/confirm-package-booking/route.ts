// @ts-nocheck
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { withSerializableRetry } from '@/lib/utils/transaction-retry';

export const dynamic = 'force-dynamic';

// ── SERIALIZABLE transaction config ──────────────────────────────────────────
// H-02b FIX: Upgrade from default Read Committed to Serializable.
// The previous $transaction() call used Read Committed (Prisma default), meaning
// two concurrent confirmation requests for the same package could both read the
// same packageHoursUsed value, both pass the hours check, and both commit —
// overdrawing the package. Serializable eliminates this TOCTOU race.
// withSerializableRetry handles P2034 (serialization failure) with backoff.
const SERIALIZABLE_TX = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5000,
  timeout: 10000,
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId, packageBookingId, hoursToDeduct } = body;

    if (!bookingId || !packageBookingId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ── H-02b INPUT VALIDATION: hoursToDeduct must be a finite positive number ──
    // Previous check: `if (!hoursToDeduct)` — falsy, so 0 is blocked but any
    // negative number passes (e.g. hoursToDeduct = -5 would pass !(-5) === false).
    // A negative debit in the wallet would ADD to the balance rather than deduct.
    // This is a financial integrity vulnerability; reject unconditionally here.
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

    // Fetch the child booking and verify the requesting user is its owner
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        customer: { include: { user: true } },
      },
    }) as any;

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // ── H-02b OWNERSHIP CHECK ────────────────────────────────────────────────
    // Verify the authenticated user owns the child booking's customer record.
    // Without this, any authenticated user who knows bookingId + packageBookingId
    // could confirm a booking belonging to a different student.
    if (booking.customer?.user?.email !== session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ── SERIALIZABLE TRANSACTION ─────────────────────────────────────────────
    // withSerializableRetry retries on P2034 (PostgreSQL serialization failure)
    // with exponential backoff. All validation, deduction, and state changes
    // happen atomically. No partial state is visible between concurrent requests.
    const updatedBooking = await withSerializableRetry(
      () => prisma.$transaction(async (tx) => {

        // 1. Fetch package booking inside transaction (sees consistent snapshot)
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

        // ── H-02b CROSS-OWNERSHIP CHECK (inside transaction) ─────────────────
        // Verify the child booking and the package booking belong to the same
        // customer. This prevents a student from confirming their own child
        // booking against a package belonging to a different student.
        if (packageBooking.customerId !== booking.customerId) {
          throw Object.assign(
            new Error('Package booking does not belong to the same customer'),
            { code: 'OWNERSHIP_MISMATCH' }
          );
        }

        // 2. Re-query other confirmed/completed child bookings inside transaction
        //    to get the most recent view of hours consumed.
        const otherChildBookings = await tx.booking.findMany({
          where: {
            parentBookingId: packageBookingId,
            id: { not: bookingId },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          select: { startTime: true, endTime: true },
        });

        // 3. Recalculate available hours inside transaction (authoritative)
        const packageTotalHours = packageBooking.packageHours || 0;
        const packageUsedStored = packageBooking.packageHoursUsed || 0;
        const otherUsedHours = otherChildBookings.reduce((sum: number, b: any) => {
          const dur =
            (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
            (1000 * 60 * 60);
          return sum + dur;
        }, 0);

        const availableHours = packageTotalHours - packageUsedStored - otherUsedHours;

        // 4. Validate hours availability inside transaction (atomic with decrement)
        if (availableHours < hoursToDeduct) {
          throw Object.assign(
            new Error(
              `Insufficient hours. Available: ${availableHours.toFixed(2)}, Requested: ${hoursToDeduct}`
            ),
            {
              code: 'INSUFFICIENT_HOURS',
              available: availableHours,
              requested: hoursToDeduct,
            }
          );
        }

        // 5. Confirm the child booking with a status guard.
        //
        //    H-02b CONCURRENCY FIX: use updateMany with status: 'PENDING' as the
        //    conditional predicate. This creates a real read-write conflict that
        //    Serializable isolation can detect and abort.
        //
        //    Without this guard, both concurrent transactions do a blind write to
        //    the same row (tx.booking.update with no WHERE on status), so Postgres
        //    sees no conflicting read — both commit, producing two 200 responses.
        //
        //    With this guard, each transaction reads status='PENDING' to decide
        //    whether to write. When the first commits and changes status to
        //    'CONFIRMED', the second transaction's earlier read is invalidated —
        //    Postgres aborts it with P2034. withSerializableRetry retries; the
        //    retry finds status!='PENDING', guard.count===0, throws ALREADY_CONFIRMED.
        //
        //    NOTE (H-02): price remains 0 as-stored. The H-02 fix (correct lesson
        //    price on child bookings) is a separate change pending policy decision.
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

        // Re-fetch for the return value (updateMany does not return the record)
        const confirmed = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { provider: true, customer: true },
        });

        // 6. Decrement hour counters on parent package booking (atomic with check above)
        const newHoursRemaining = Math.max(
          0,
          packageTotalHours - (packageUsedStored + otherUsedHours + hoursToDeduct)
        );
        const newPackageStatus =
          packageUsedStored + otherUsedHours + hoursToDeduct >= packageTotalHours
            ? 'completed'
            : 'active';

        await tx.booking.update({
          where: { id: packageBookingId },
          data: {
            packageHoursUsed: { increment: hoursToDeduct },
            packageHoursRemaining: { set: newHoursRemaining },
            packageStatus: newPackageStatus,
          },
        });

        // 7. Wallet debit — using lockedHourlyRate × hoursToDeduct.
        //    NOTE (H-02): this debit amount will change once the child booking
        //    stores the correct lesson price. Until then, the existing formula
        //    is preserved unchanged.
        const userWallet = await tx.clientWallet.findFirst({
          where: { user: { email: session.user.email } },
        });

        if (userWallet) {
          // Coerce Prisma Decimal to JS number before arithmetic and guards.
          // packageBooking.lockedHourlyRate is stored as Decimal(10,2) in the DB;
          // Prisma returns a Decimal object, not a plain number. Number.isFinite()
          // on a Decimal object always returns false, which would trigger the guard
          // even for a valid positive rate.
          const lockedRateRaw =
            packageBooking.lockedHourlyRate ?? booking.provider?.hourlyRate ?? 0;
          const lockedRate =
            typeof lockedRateRaw === 'object' && lockedRateRaw !== null && 'toNumber' in lockedRateRaw
              ? (lockedRateRaw as { toNumber(): number }).toNumber()
              : Number(lockedRateRaw);

          // ── H-02b: lockedRate guard ───────────────────────────────────────
          // lockedRate should always be > 0; if somehow zero, deducting 0
          // would silently allow free lessons. Reject rather than proceed.
          if (!Number.isFinite(lockedRate) || lockedRate <= 0) {
            throw Object.assign(
              new Error('Package booking has no valid locked hourly rate'),
              { code: 'INVALID_LOCKED_RATE' }
            );
          }

          const transactionAmount = hoursToDeduct * lockedRate;

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

          // Keep stored balance field in sync (performance cache only)
          await tx.clientWallet.update({
            where: { id: userWallet.id },
            data: { balance: { decrement: transactionAmount } },
          });

          // Platform transaction record for payouts/reporting
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
        }

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
      return NextResponse.json(
        { error: 'Package booking not found' },
        { status: 404 }
      );
    }
    if (error?.code === 'OWNERSHIP_MISMATCH') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    if (error?.code === 'INSUFFICIENT_HOURS') {
      return NextResponse.json(
        {
          error: error.message,
          available: error.available,
          requested: error.requested,
        },
        { status: 400 }
      );
    }
    if (error?.code === 'INVALID_LOCKED_RATE') {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      );
    }
    if (error?.code === 'ALREADY_CONFIRMED') {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to confirm package booking' },
      { status: 500 }
    );
  }
}
