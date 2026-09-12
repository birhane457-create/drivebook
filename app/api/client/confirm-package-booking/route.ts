// @ts-nocheck
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
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
    if (!bookingId || !packageBookingId || !hoursToDeduct) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    // Get the current booking to finalize
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        user: true
      }
    }) as any;
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    // Verify user owns the booking
    if (booking.user?.email !== session!.user!.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    // ── FIX #2 & #12: Atomic transaction with hours validation inside ────────
    // FIX #2: Move ALL hours validation INSIDE transaction (prevents TOCTOU race)
    // FIX #12: Use correct 'provider' relation instead of non-existent 'instructor'
    // Previously: hours check was OUTSIDE transaction → concurrent requests could overdraw
    // Now: Query + validate + update ALL inside single transaction (atomic + race-safe)
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // 1. Fetch package booking with CORRECT relation name (FIX #12)
      const packageBooking = await tx.booking.findUnique({
        where: { id: packageBookingId },
        include: { provider: true },  // ✅ FIXED: was 'instructor' (doesn't exist in schema)
      }) as any;
      if (!packageBooking) {
        throw Object.assign(
          new Error('Package booking not found'),
          { code: 'PACKAGE_NOT_FOUND' }
        );
      }
      // 2. Re-query other child bookings INSIDE transaction (FIX #2)
      // This prevents race: two concurrent confirmations both passing hours check
      const otherChildBookings = await tx.booking.findMany({
        where: {
          parentBookingId: packageBookingId,
          id: { not: bookingId },
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        },
        select: { startTime: true, endTime: true }
      });
      // 3. Recalculate available hours INSIDE transaction (authoritative check - FIX #2)
      const packageTotalHours = packageBooking.packageHours || 0;
      const packageUsedStored = packageBooking.packageHoursUsed || 0;
      const otherUsedHours = otherChildBookings.reduce((sum: any, b: any) => {
        const dur = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
        return sum + dur;
      }, 0);
      const availableHours = packageTotalHours - packageUsedStored - otherUsedHours;
      // 4. Validate INSIDE transaction → atomic with decrement (FIX #2)
      if (availableHours < hoursToDeduct) {
        throw Object.assign(
          new Error(`Insufficient hours. Available: ${availableHours.toFixed(2)}, Requested: ${hoursToDeduct}`),
          { code: 'INSUFFICIENT_HOURS', available: availableHours, requested: hoursToDeduct }
        );
      }
      // 5. Confirm child booking
      const confirmed = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          price: 0,
          isPackageBooking: false,
          parentBookingId: packageBookingId,
          paymentIntentId: `package-${packageBookingId}-${bookingId}`,
          paidAt: new Date(),
        },
        include: { provider: true, user: true },
      });
      // 6. Decrement remaining hours on parent package booking (atomic with validation above)
      const newHoursRemaining = Math.max(0, packageTotalHours - (packageUsedStored + otherUsedHours + hoursToDeduct));
      const newPackageStatus = (packageUsedStored + otherUsedHours + hoursToDeduct) >= packageTotalHours
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
      // 7. Wallet: create WalletTransaction ledger record + decrement balance cache
      const userWallet = await tx.clientWallet.findFirst({
        where: { user: { email: session!.user!.email } },
      });
      if (userWallet) {
        // RATE LOCKING DESIGN (AUDIT NOTE):
        // Package bookings use lockedHourlyRate if available, else current provider rate.
        // Note: lockedHourlyRate stores the DISCOUNT RATE (e.g., hourlyRate with 10% off),
        // NOT the instructor's rate at package purchase time.
        // The instructor's rate is always CURRENT at booking time (allows instructor switches).
        // Only the package DISCOUNT PERCENTAGE is locked, not the base instructor rate.
        const lockedRate = packageBooking.lockedHourlyRate ?? booking.provider?.hourlyRate ?? 0;
        const transactionAmount = hoursToDeduct * lockedRate;
        // Authoritative ledger entry — getWalletBalance() reads from here
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
        // 8. Platform transaction record for payouts/reporting
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
    }).catch((txErr: any) => {
      // Handle specific transaction errors
      if (txErr?.code === 'PACKAGE_NOT_FOUND') {
        throw txErr;
      }
      if (txErr?.code === 'INSUFFICIENT_HOURS') {
        throw txErr;
      }
      // Re-throw other errors
      throw txErr;
    });
    return NextResponse.json({
      success: true,
      bookingId: updatedBooking.id,
      message: 'Booking confirmed using package hours'
    });
  } catch (error: any) {
    console.error('Error confirming package booking:', error);
    // Handle specific error codes
    if (error?.code === 'PACKAGE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Package booking not found' },
        { status: 404 }
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
    return NextResponse.json(
      { error: 'Failed to confirm package booking' },
      { status: 500 }
    );
  }
}
