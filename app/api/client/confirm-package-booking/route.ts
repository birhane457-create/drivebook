// @ts-nocheck
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { withSerializableRetry } from '@/lib/utils/transaction-retry';

export const dynamic = 'force-dynamic';

// ── SERIALIZABLE transaction config ──────────────────────────────────────────
// H-02b: Serializable isolation prevents concurrent confirmations from both
// committing. withSerializableRetry handles P2034 with exponential backoff.
const SERIALIZABLE_TX = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5000,
  timeout: 10000,
};

// ── Helper: coerce Prisma Decimal → JS number ────────────────────────────────
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
    // It is NOT the financial authority — the server derives the authoritative
    // duration inside the transaction from DB booking times (F4, F5 fixes).
    // A mismatch between this value and the server-derived duration is rejected.
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

    // ── PRE-FLIGHT OWNERSHIP CHECK (fast-reject, no financial data read) ──────
    // H-02b-F5: This check reads ONLY the fields needed to verify the requesting
    // user owns this booking. It does NOT read startTime, endTime, price, or any
    // field used in financial calculations — those are read inside the transaction.
    //
    // This is a cheap deny-early guard. The authoritative ownership and duration
    // checks happen again inside the SERIALIZABLE transaction against a consistent
    // snapshot (steps 1b and 3a below), making this pre-flight check redundant for
    // correctness but valuable for avoiding unnecessary transaction overhead on
    // obviously unauthorized requests.
    const preflightBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        customerId: true,
        customer: {
          select: { user: { select: { email: true } } },
        },
      },
    }) as any;

    if (!preflightBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (preflightBooking.customer?.user?.email !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── SERIALIZABLE TRANSACTION ──────────────────────────────────────────────
    // ALL financial data is read inside this transaction: booking times, provider
    // rate, wallet balance. No value from outside the transaction is used in any
    // financial calculation.
    const updatedBooking = await withSerializableRetry(
      () => prisma.$transaction(async (tx) => {

        // ── 1a. Fetch package booking (transaction-scoped snapshot) ───────────
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

        // ── 1b. H-02b-F5: Fetch child booking inside transaction ──────────────
        // All financially relevant fields (startTime, endTime, customerId,
        // provider, status) are read here from the transaction-scoped snapshot,
        // not from the pre-flight fetch outside the transaction.
        //
        // This guarantees that the duration used for the wallet debit and hour
        // deduction is consistent with the booking record at the moment of
        // confirmation, not at some earlier point. Any concurrent modification
        // to the booking between the pre-flight check and this read will cause
        // Serializable isolation to abort and retry.
        const txBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            provider: true,
            customer: { include: { user: true } },
          },
        }) as any;

        if (!txBooking) {
          throw Object.assign(
            new Error('Booking not found inside transaction'),
            { code: 'BOOKING_NOT_FOUND' }
          );
        }

        // ── 2. Ownership checks (transaction-scoped) ──────────────────────────
        // Re-verify ownership against transaction-scoped data.
        if (txBooking.customer?.user?.email !== session.user.email) {
          throw Object.assign(
            new Error('Unauthorized'),
            { code: 'UNAUTHORIZED' }
          );
        }

        if (packageBooking.customerId !== txBooking.customerId) {
          throw Object.assign(
            new Error('Package booking does not belong to the same customer'),
            { code: 'OWNERSHIP_MISMATCH' }
          );
        }

        // ── 3a. F5: Derive authoritative duration from transaction-scoped record
        // startTime and endTime come from txBooking (read inside this transaction),
        // NOT from the pre-flight booking object. This ensures the duration is
        // consistent with the DB state at the time of confirmation.
        if (!txBooking.startTime || !txBooking.endTime) {
          throw Object.assign(
            new Error('Booking is missing start or end time — cannot derive authoritative duration'),
            { code: 'BOOKING_MISSING_TIMES' }
          );
        }

        const serverDerivedHours =
          (new Date(txBooking.endTime).getTime() - new Date(txBooking.startTime).getTime()) /
          (1000 * 60 * 60);

        if (!Number.isFinite(serverDerivedHours) || serverDerivedHours <= 0) {
          throw Object.assign(
            new Error('Booking has an invalid duration (endTime must be after startTime)'),
            { code: 'INVALID_BOOKING_DURATION' }
          );
        }

        // F4: validate client-supplied value matches server-derived duration
        const DURATION_TOLERANCE = 0.001; // ±0.001h (~3.6 seconds)
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

        // authorizedHours is derived entirely from trusted DB data inside this tx
        const authorizedHours = serverDerivedHours;

        // ── 3b. Hour availability check (child records as sole source, F3 fix) ─
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
          return sum + (
            (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60)
          );
        }, 0);

        const availableHours = packageTotalHours - otherUsedHours;

        if (availableHours < authorizedHours) {
          throw Object.assign(
            new Error(
              `Insufficient hours. Available: ${availableHours.toFixed(2)}, Required: ${authorizedHours.toFixed(2)}`
            ),
            { code: 'INSUFFICIENT_HOURS', available: availableHours, requested: authorizedHours }
          );
        }

        // ── 4. H-02 FIX: Locked rate and financial calculations ──────────────
        // POLICY (2026-10-18): Use instructor's CURRENT rate at booking confirmation
        // time, NOT the original package purchase rate. This implements the approved
        // dollar-credit wallet model where hours are estimates, not guarantees.
        //
        // The locked rate is the instructor's applicable rate when THIS booking is
        // confirmed. It is locked for THIS booking only — future bookings may use
        // different rates if the instructor changes their rate.
        //
        // See docs/audit/PACKAGE-ACCOUNTING-POLICY.md §3.1
        const applicableRate = toJsNumber(txBooking.provider?.hourlyRate);

        if (!Number.isFinite(applicableRate) || applicableRate <= 0) {
          throw Object.assign(
            new Error('Instructor has no valid hourly rate'),
            { code: 'INVALID_INSTRUCTOR_RATE' }
          );
        }

        // H-02 FIX: Calculate lesson price using authorized duration and applicable rate
        const lessonPrice = parseFloat((authorizedHours * applicableRate).toFixed(2));

        // H-02 FIX: Platform fee for wallet-funded lessons
        // POLICY (§2.2): Wallet-funded bookings do NOT incur a second platform fee.
        // The fee was collected when the package was purchased or wallet was topped up.
        // We set platformFee to 0 for this wallet-funded lesson to avoid double-counting
        // in financial reports. The original package purchase already recorded the fee.
        const platformFee = 0;

        // H-02 FIX: Get commission rate for this instructor's tier
        const { getCommissionRate } = await import('@/lib/services/platform-pricing');
        const commissionRatePct = await getCommissionRate(txBooking.provider.subscriptionTier ?? 'BASIC');
        const commissionRate = commissionRatePct / 100;
        const providerPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2));

        // Wallet debit amount (same as lesson price for package bookings)
        const transactionAmount = lessonPrice;

        // ── 5. Wallet must exist — fail closed ────────────────────────────────
        const userWallet = await tx.clientWallet.findFirst({
          where: { user: { email: session.user.email } },
        });

        if (!userWallet) {
          throw Object.assign(
            new Error('Student wallet not found — cannot confirm booking without a wallet'),
            { code: 'WALLET_NOT_FOUND' }
          );
        }

        // ── 6. Authoritative dollar-balance check (aggregated inside tx) ──────
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

        // ── 7. H-02 FIX: Confirm child booking with correct financial values ──
        // updateMany with WHERE status='PENDING' creates a read-write conflict
        // Serializable can detect. Second concurrent tx reads PENDING but first
        // already wrote CONFIRMED → P2034 → retry → guard.count===0 → 409.
        //
        // H-02 FIX: Set price, platformFee, providerPayout, commissionRate to actual
        // values calculated above. This makes the child booking an authoritative
        // financial record suitable for refund calculations and audit trails.
        const guard = await tx.booking.updateMany({
          where: { id: bookingId, status: 'PENDING' },
          data: {
            status: 'CONFIRMED',
            isPackageBooking: false,
            parentBookingId: packageBookingId,
            price: lessonPrice,
            platformFee,
            providerPayout,
            commissionRate,
            paymentIntentId: `package-${packageBookingId}-${bookingId}`,
            paidAt: new Date(),
            isPaid: true,
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

        // ── 8. Update package hour counters (absolute, F3 fix) ────────────────
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
            description: `Package hours used — ${authorizedHours.toFixed(2)}h with ${txBooking.provider?.name ?? 'provider'}`,
            bookingId,
          },
        });

        await tx.clientWallet.update({
          where: { id: userWallet.id },
          data: { balance: { decrement: transactionAmount } },
        });

        // ── 10. H-02 FIX: Platform transaction record with correct financials ─
        await (tx as any).transaction.create({
          data: {
            bookingId,
            providerId: txBooking.providerId,
            amount: lessonPrice,
            platformFee,
            providerPayout,
            commissionRate,
            type: 'BOOKING_PAYMENT',
            status: 'COMPLETED',
            description: `Package lesson — ${authorizedHours.toFixed(2)}h at $${applicableRate}/hr from package ${packageBookingId}`,
            metadata: {
              bookingId,
              packageBookingId,
              hoursDeducted: authorizedHours,
              suppliedHoursToDeduct: hoursToDeduct,
              applicableRate,
              lessonPrice,
              instructorName: txBooking.provider?.name,
              policyVersion: '2026-10-18',
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
    if (error?.code === 'BOOKING_NOT_FOUND') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (error?.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error?.code === 'OWNERSHIP_MISMATCH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (error?.code === 'BOOKING_MISSING_TIMES') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'INVALID_BOOKING_DURATION') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'HOURS_DURATION_MISMATCH') {
      return NextResponse.json(
        { error: error.message, supplied: error.supplied, serverDerived: error.serverDerived },
        { status: 409 }
      );
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
    if (error?.code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error?.code === 'INSUFFICIENT_WALLET_BALANCE') {
      return NextResponse.json(
        { code: 'INSUFFICIENT_WALLET_BALANCE', error: error.message, available: error.available, required: error.required },
        { status: 402 }
      );
    }
    if (error?.code === 'ALREADY_CONFIRMED') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to confirm package booking' }, { status: 500 });
  }
}
