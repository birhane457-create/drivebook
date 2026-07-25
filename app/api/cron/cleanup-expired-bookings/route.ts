import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

/**
 * P0 FIX #4: Cleanup Job for Expired Bookings
 * 
 * This endpoint is called by Vercel Cron every 5 minutes to:
 * 1. Expire PENDING_PAYMENT bookings older than 10 minutes
 * 2. Expire PENDING wallet transactions older than 10 minutes
 * 
 * This prevents:
 * - Slot pollution (expired bookings locking time slots)
 * - Wallet inconsistencies (pending transactions never resolved)
 * - Poor UX (users seeing unavailable slots that are actually expired)
 */
export async function GET(req: NextRequest) {
  try {
    // SECURITY: Verify cron secret
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }
    
    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Expire old PENDING_PAYMENT bookings
    const expiredBookings = await prisma.booking.updateMany({
      where: {
        status: 'PENDING_PAYMENT',
        createdAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    // Expire short-notice PENDING bookings (instructor approval) older than 2 hours
    // If neither client nor instructor-created pending booking is approved within 2 hours,
    // the slot is released.
    // P0-8 FIX: Removed createdBy: 'client' filter — instructor-created PENDING
    // bookings were never expiring, permanently locking slots.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Use findMany+loop so we can notify each client individually
    const shortNoticeToExpire = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: twoHoursAgo },
      },
      include: {
        client: { select: { userId: true } },
        instructor: { select: { name: true } },
      },
    });

    let expiredShortNoticeCount = 0;
    for (const b of shortNoticeToExpire) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: 'EXPIRED' },
      });
      expiredShortNoticeCount++;

      // Notify client their booking expired (instructor didn't respond in time)
      if (b.client?.userId) {
        try {
          const { notifyClientBookingCancelled } = await import('@/lib/services/notifications');
          await notifyClientBookingCancelled(
            b.client.userId,
            b.instructor?.name ?? 'the instructor',
            b.id
          );
        } catch (notifErr) {
          console.error('Expiry notification failed for booking', b.id, notifErr);
        }
      }

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            action: 'BOOKING_EXPIRED',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'BOOKING',
            targetId: b.id,
            success: true,
            metadata: { reason: 'short_notice_no_approval', expiredAt: new Date().toISOString() },
          },
        });
      } catch (auditErr) {
        console.error('Audit log failed for booking expiry', b.id, auditErr);
      }
    }
    const expiredShortNotice = { count: expiredShortNoticeCount };
    
    // Expire old PENDING wallet transactions
    const expiredTransactions = await prisma.walletTransaction.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    // Auto-complete CONFIRMED bookings whose end time has passed and check-in was recorded
    // (check-in already sets COMPLETED when endTime < now, this catches any that slipped through)
    const autoCompleted = await prisma.booking.updateMany({
      where: {
        status: 'CONFIRMED',
        endTime: { lt: twoHoursAgo },
        checkInTime: { not: null },
      } as any,
      data: { status: 'COMPLETED' },
    });

    // Auto no-show: CONFIRMED bookings that ended 3+ hours ago with NO check-in
    // P2-6 FIX: Use findMany + notify pattern instead of silent bulk updateMany,
    // so instructors/clients get an alert when a booking is auto-marked NO_SHOW.
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const noShowBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: { lt: threeHoursAgo },
        checkInTime: null,
      } as any,
      select: {
        id: true,
        instructor: { select: { userId: true, name: true } },
        client: { select: { userId: true } },
        clientName: true,
      },
    });

    let autoNoShowCount = 0;
    for (const b of noShowBookings) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: 'NO_SHOW' },
      });
      autoNoShowCount++;

      // Notify instructor their booking was marked NO_SHOW
      if (b.instructor?.userId) {
        try {
          const { sendAlert } = await import('@/lib/services/alert-service');
          await sendAlert({
            type: 'BOOKING_AUTO_NO_SHOW',
            severity: 'LOW',
            message: `Booking ${b.id} was automatically marked NO_SHOW (no check-in recorded)`,
            entityId: b.id,
            metadata: { bookingId: b.id, instructorUserId: b.instructor.userId },
          });
        } catch (alertErr) {
          console.error('NO_SHOW alert failed for booking', b.id, alertErr);
        }
      }
    }
    const autoNoShow = { count: autoNoShowCount };
    
    // Purge BookingIdempotencyKey records older than 24 hours.
    // Stripe's own idempotency window is 24h  keys older than this
    // can never be legitimately replayed, so it is safe to delete them.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const purgedIdempotencyKeys = await (prisma as any).bookingIdempotencyKey.deleteMany({
      where: { createdAt: { lt: twentyFourHoursAgo } },
    });

        const result = {
      success: true,
      expiredBookings: expiredBookings.count,
      expiredShortNotice: expiredShortNotice.count,
      expiredTransactions: expiredTransactions.count,
      autoCompleted: autoCompleted.count,
      autoNoShow: autoNoShow.count,
      timestamp: new Date().toISOString(),
      cutoffTime: tenMinutesAgo.toISOString(),
      purgedIdempotencyKeys: purgedIdempotencyKeys.count
    };
    
    console.log('✅ Cleanup job completed:', result);
    
    await pingCronHealth('cleanup-expired-bookings');
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Cleanup job error:', error);
    await failCronHealth('cleanup-expired-bookings', error);
    return NextResponse.json({ 
      error: 'Cleanup job failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
