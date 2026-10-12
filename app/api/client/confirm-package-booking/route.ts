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

    // ── INPUT FORMAT VALIDATION ───────────────────────────────────────────────
    // hoursToDeduct must be a finite positive number.
    // This validates the caller sent a sensible value — it is NOT the financial
    // authority. The server derives the authoritative duration from booking records
    // inside the transaction (step 3a) and rejects any mismatch (H-02b-F4).
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

        // ── 3a. H-02b-F4: Derive authoritative lesson duration from DB ────────
        // The client-supplied hoursToDeduct is a hint, not a financial authority.
        // The actual duration is computed from booking.startTime / booking.endTime,
        // which were written by the server when the booking was created and cannot
        // be tampered with by the client at confirmation time.
        //
        // A mismatch means the client is either:
        //   (a) sending a stale value (e.g. from a previous booking duration), or
        //   (b) deliberately undercharging themselves (financial manipulation).
        // Both are rejected. The caller must send the value that matches reality.
        //
        // Tolerance: ±0.001h (~3.6 seconds) to absorb floating-point rounding
        // in clients that compute the duration themselves.
        if (!booking.startTime || !booking.endTime) {
          throw Object.assign(
            new Error('Booking is missing start or end time — cannot derive authoritative duration'),
            { code: 'BOOKING_MISSING_TIMES' }
          );
        }

        const serverDerivedHours =
          (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) /
          (1000 * 60 * 60);

        if (!Number.isFinite(serverDerivedHours) || serverDerivedHours <= 0) {
          throw Object.assign(
            new Error('Booking has an invalid duration (endTime must be after startTime)'),
            { code: 'INVALID_BOOKING_DURATION' }
          );
        }

        const DURATION_TOLERANCE = 0.001; // hours (~3.6 seconds)
        if (Math.abs(hoursToDeduct - serverDerivedHours) > DURATION_TOLERANCE) {
          throw Object.assign(
            new Error(
              `hoursToDeduct (${hoursToDeduct.toFixed(4)}h) does not match the booking duration (${serverDerivedHours.toFixed(4)}h). Use the actual booking duration.`
            ),
            {
              code: 'HOURS_DURATION_MISMATCH',
              supplied: hoursToDeduct,
              serverDerived: serverDerivedHours,
            }
          );
        }

        // From this point, use serverDerivedHours as the authoritative value.
        // hoursToDeduct is not referenced again.
        const authorizedHours = serverDerivedHours;

        // ── 3b. Hour availability check (F3 fix: child records as sole source) ─
        const otherChildBookings = await tx.booking.findMany({
          where: {
            parentBookingId: packageBookingId,
            id: { not: bookingId },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          select: { startTime: true, endTime: true },
        });

        const packageTotalHours = toJsNumber(packageBooking.packageHours);

        const otherUsedHours = otherChildBookings.reduce((sum: number, b: any) => {
          const dur =
            (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
            (1000 * 60 * 60);
          return sum + dur;
        }, 0);

        // Single source: child booking records only (not packageHoursUsed counter)
        const availableHours = packageTotalHours - otherUsedHours;

        if (availableHours < authorizedHours) {
          throw Object.assign(
            new Error(
              `Insufficient hours. Available: ${availableHours.toFixed(2)}, Required: ${authorizedHours.toFixed(2)}`
            ),
            { code: 'INSUFFICIENT_HOURS', available: availableHours, requested: authorizedHours }
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

        // transactionAmount now uses the server-derived hours — client cannot manipulate
        const transactionAmount = authorizedHours * lockedRate;

        // ── 5. Wallet must exist — fail closed ───────────────────────────────
        const userWallet = await tx.clientWallet.findFirst({
          where: { user: { email: session.user.email } },
        });

        if (!userWallet) {
          throw Object.assign(
            new Error('Student wallet not found — cannot confirm booking without a wallet'),
            { code: 'WALLET_NOT_FOUND' }
          );
        }

        // ── 6. Authoritative dollar-balance sufficiency check ─────────────────
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

        // ── 8. Update package hour counters (F3 fix: absolute from child records)
        const totalConsumedHours = otherUsedHours + authorizedHours;
        const newHoursRemaining  = Math.max(0, packageTotalHours - totalConsumedHours);
        const newPackageStatus   = totalConsumedHours >= packageTotalHours ? 'completed' : 'active';

        await tx.booking.update({
          where: { id: packageBookingId },
          data: {
            packageHoursUsed:      { set: totalConsumedHours },
            packageHoursRemaining: { set: newHoursRemaining },
            packageStatus:         newPackageStatus,
          },
        });

        // ── 9. Wallet debit ───────────────────────────────────────────────────
        await tx.walletTransaction.create({
          data: {
            walletId: userWallet.id,
            type: 'DEBIT',
            amount: transactionAmount,
            status: 'CONFIRMED',
            description: `Package hours used — ${authorizedHours.toFixed(2)}h with ${booking.provider?.name ?? 'provider'}`,
            bookingId,
          },
        });

        await tx.clientWallet.update({
          where: { id: userWallet.id },
          data: { balance: { decrement: transactionAmount } },
        });

        // ── 10. Platform transaction record ──────────────────────────────────
        await (tx as any).transaction.create({
          data: {
            bookingId,
            providerId: booking.providerId,
            amount: transactionAmount,
            platformFee: 0,
            providerPayout: transactionAmount,
            type: 'BOOKING_PAYMENT',
            status: 'COMPLETED',
            description: `Package hours — ${authorizedHours.toFixed(2)}h from package ${packageBookingId}`,
            metadata: {
              bookingId,
              packageBookingId,
              hoursDeducted: authorizedHours,
              suppliedHoursToDeduct: hoursToDeduct,
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
    if (error?.code === 'BOOKING_MISSING_TIMES') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'INVALID_BOOKING_DURATION') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'HOURS_DURATION_MISMATCH') {
      return NextResponse.json(
        {
          error: error.message,
          supplied: error.supplied,
          serverDerived: error.serverDerived,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to confirm package booking' }, { status: 500 });
  }
}
