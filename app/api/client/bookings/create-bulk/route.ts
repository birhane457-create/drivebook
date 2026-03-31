import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { paymentService } from '@/lib/services/payment';
import { notifyBookingRequest, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { sendWalletLessonReceipt } from '@/lib/services/receipt-email';

export const dynamic = 'force-dynamic';

const cartItemSchema = z.object({
  instructorId: z.string().min(1),
  instructorName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  duration: z.number().min(0.5).max(8),
  price: z.number().nonnegative(),
  pickupLocation: z.string().min(0).max(300).optional(),
  service: z.string().min(0).max(500).optional()
});

const requestSchema = z.object({
  cart: z.array(cartItemSchema).min(1).max(10)
});

function parseDateTime(dateStr: string, timeStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

export async function POST(request: NextRequest) {
  console.log('=== CREATE BULK BOOKING API CALLED ===');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
      request.headers.get('x-forwarded-for'),
      'bulk-booking'
    );
    const rateLimitResult = await checkRateLimit(bulkBookingRateLimit, rateLimitId);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429, headers: rateLimitResult.headers });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const cartItems = parsed.data.cart;

    // ── Pre-flight checks OUTSIDE transaction ─────────────────────────────────
    // These are read-only and slow — do them before opening the transaction.

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const client = await prisma.client.findFirst({ where: { userId: user.id } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: { transactions: { where: { status: 'CONFIRMED' } } }
    });
    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    const totalCredits = wallet.transactions.filter(t => t.type.toUpperCase() === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const totalDebits = wallet.transactions.filter(t => t.type.toUpperCase() === 'DEBIT').reduce((s, t) => s + Math.abs(t.amount), 0);
    const actualBalance = totalCredits - totalDebits;
    const totalCost = cartItems.reduce((s, it) => s + it.price, 0);

    console.log('[BOOKING] Balance check:', { totalCredits, totalDebits, actualBalance, totalCost, sufficient: actualBalance >= totalCost });

    if (actualBalance < totalCost) {
      return NextResponse.json({
        error: `Insufficient credits. You have $${actualBalance.toFixed(2)} but need $${totalCost.toFixed(2)}`
      }, { status: 400 });
    }

    // Pre-compute commissions outside transaction (involves external calls)
    const commissions: any[] = [];
    for (const item of cartItems) {
      const commission = await paymentService.calculateCommission(item.instructorId, client.id, item.price);
      commissions.push(commission);
    }

    // Validate instructors exist outside transaction
    const instructorIds = [...new Set(cartItems.map(i => i.instructorId))];
    const instructors = await prisma.instructor.findMany({
      where: { id: { in: instructorIds } },
      select: { id: true, userId: true }
    });
    const instructorMap = new Map(instructors.map(i => [i.id, i]));

    // ── Minimal transaction: slot claim + booking create + wallet debit ────────
    // Keep this as small as possible to stay within the 5s timeout.
    const result = await prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const commission = commissions[i];
        const startTime = parseDateTime(item.date, item.time);
        const endTime = new Date(startTime.getTime() + item.duration * 60 * 60 * 1000);

        // Conflict check inside transaction (atomic slot claim)
        const conflict = await tx.booking.findFirst({
          where: {
            instructorId: item.instructorId,
            status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } }
            ]
          },
          select: { id: true }
        });
        if (conflict) throw new Error(`Time slot no longer available for ${item.instructorName} at ${item.date} ${item.time}`);

        const booking = await tx.booking.create({
          data: {
            instructor: { connect: { id: item.instructorId } },
            client: { connect: { id: client.id } },
            bookingType: 'LESSON',
            status: 'CONFIRMED',
            startTime,
            endTime,
            duration: item.duration,
            pickupAddress: item.pickupLocation || null,
            price: item.price,
            platformFee: commission.platformFee,
            instructorPayout: commission.instructorPayout,
            commissionRate: commission.commissionRate,
            isFirstBooking: commission.isFirstBooking,
            notes: item.service || null,
            createdBy: 'client',
            originalStartTime: startTime,
            isPaid: true,
            paidAt: new Date()
          } as any
        });

        created.push({
          booking,
          instructorName: item.instructorName,
          instructorUserId: instructorMap.get(item.instructorId)?.userId,
          clientUserId: user.id,
          commission,
        });
      }

      // Debit wallet
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: totalCost,
          description: `Booked ${cartItems.length} lesson${cartItems.length > 1 ? 's' : ''}`,
          status: 'CONFIRMED',
        }
      });

      return { created, totalCost, remaining: actualBalance - totalCost };
    }, {
      timeout: 15000, // 15s — enough for the minimal work inside
    });

    // ── Post-transaction: ledger + transaction records + notifications ─────────
    // These are non-critical and can run after the transaction commits.
    for (const c of result.created) {
      try {
        await (prisma as any).transaction.create({
          data: {
            bookingId: c.booking.id,
            instructorId: c.booking.instructorId,
            type: 'BOOKING_PAYMENT',
            amount: c.commission.totalAmount,
            platformFee: c.commission.platformFee,
            instructorPayout: c.commission.instructorPayout,
            commissionRate: c.commission.commissionRate,
            status: 'COMPLETED',
            description: `Booking payment - ${c.commission.isFirstBooking ? 'First booking' : 'Repeat booking'}`,
            metadata: { isFirstBooking: c.commission.isFirstBooking },
          },
        });
      } catch (e) {
        console.error('[Transaction record] Failed:', e);
      }

      try {
        if (c.instructorUserId && c.booking.startTime) {
          await notifyBookingRequest(c.instructorUserId, user.name || session.user.email, c.booking.id, new Date(c.booking.startTime));
        }
        if (c.clientUserId && c.booking.startTime) {
          await notifyClientBookingConfirmed(c.clientUserId, c.instructorName, c.booking.id, new Date(c.booking.startTime));
        }
      } catch (e) {
        console.error('[Notification] Failed:', e);
      }

      // Send receipt per booking
      try {
        const durationHours = typeof c.booking.duration === 'number' ? c.booking.duration : 1;
        const hourlyRate = durationHours > 0 ? c.booking.price / durationHours : c.booking.price;
        const walletAfter = result.remaining - result.created.slice(result.created.indexOf(c) + 1).reduce((s: number, x: any) => s + x.booking.price, 0);
        await sendWalletLessonReceipt({
          clientName: user.name || session.user.email,
          clientEmail: session.user.email,
          receiptId: c.booking.id,
          bookedAt: new Date(),
          instructorName: c.instructorName,
          lessonDate: new Date(c.booking.startTime),
          durationHours,
          hourlyRate,
          lessonCost: c.booking.price,
          walletBalanceBefore: walletAfter + c.booking.price,
          walletBalanceAfter: walletAfter,
          bookedBy: 'client',
        });
      } catch (e) {
        console.error('[Receipt] Failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      bookings: result.created.map((c: any) => ({
        id: c.booking.id,
        date: c.booking.startTime.toISOString().split('T')[0],
        time: `${String(new Date(c.booking.startTime).getHours()).padStart(2, '0')}:${String(new Date(c.booking.startTime).getMinutes()).padStart(2, '0')}`,
        instructor: c.instructorName
      })),
      totalCost: result.totalCost,
      remainingBalance: result.remaining
    });
  } catch (error) {
    console.error('=== BOOKING CREATION ERROR ===', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.startsWith('Insufficient') || message.startsWith('Time slot') ? 400 : 500;
    return NextResponse.json({ error: 'Failed to create bookings', details: message }, { status });
  }
}
