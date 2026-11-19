import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { paymentService } from '@/lib/services/payment';
import { notifyBookingRequest, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { sendWalletLessonReceipt } from '@/lib/services/receipt-email';
import { checkProviderEligible } from '@/lib/booking/checkProviderEligible';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { executeWalletBookingTransaction, computeWalletBalance } from '@/lib/services/wallet-booking';

export const dynamic = 'force-dynamic';

const cartItemSchema = z.object({
  providerId: z.string().min(1),
  instructorName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  duration: z.number().min(0.5).max(8),
  price: z.number().nonnegative(), // client hint only â€” server recalculates
  pickupLocation: z.string().min(0).max(300).optional(),
  service: z.string().min(0).max(500).optional(),
});

const requestSchema = z.object({
  cart: z.array(cartItemSchema).min(1).max(10)
});

// CP-05 FIX: parseDateTime removed — localDateTimeToUTC() is used instead,
// passing the instructor's timezone so that "9:00 AM Perth" is stored as
// 01:00 UTC, not misinterpreted as 09:00 UTC (server local time).

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitId = getRateLimitIdentifier(
      session!.user!.id,
      request.headers.get('x-forwarded-for'),
      'bulk-booking'
    );
    const rateLimitResult = await checkRateLimit(bulkBookingRateLimit, rateLimitId);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429, headers: rateLimitResult.headers });
    }

    const body = await request.json();

    // Reject legacy special-service payloads
    for (const item of body.cart || []) {
      if (
        Object.prototype.hasOwnProperty.call(item, 'specialServiceId') ||
        Object.prototype.hasOwnProperty.call(item, 'specialServiceName') ||
        Object.prototype.hasOwnProperty.call(item, 'specialServiceType') ||
        Object.prototype.hasOwnProperty.call(item, 'customPackageId') ||
        Object.prototype.hasOwnProperty.call(item, 'customPackagePrice')
      ) {
        return NextResponse.json(
          { error: 'Instructor special services are not supported. Book standard hourly lessons or use platform bulk packages (6/10/15h).' },
          { status: 400 }
        );
      }
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const cartItems = parsed.data.cart;

    // â”€â”€ Pre-flight checks OUTSIDE transaction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const user = await prisma.user.findUnique({ where: { email: session!.user!.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const client = await prisma.customer.findFirst({ where: { userId: user.id } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // â”€â”€ Fetch current instructor rates (server-side price recalculation) â”€â”€â”€â”€â”€â”€â”€
    // "Book later" wallet funds are NOT rate-locked at purchase time.
    // Each lesson is priced at the instructor's CURRENT hourlyRate at booking time.
    // Client-submitted prices are ignored entirely.
    // CP-04 + CP-05 FIX: check provider eligibility (approval/active/subscription/docs)
    // and capture timezone for correct UTC conversion of submitted local times.
    const providerIds = [...new Set(cartItems.map((i: any) => i.providerId))];
    const eligibilityMap = new Map<string, { hourlyRate: number; timezone: string; userId: string | null }>();

    for (const pid of providerIds) {
      const eligible = await checkProviderEligible(pid, prisma);
      if (!eligible.allowed) {
        return NextResponse.json({ error: eligible.error, code: eligible.code }, { status: eligible.status });
      }
      const tz = eligible.provider.timezone
        ? resolveTimezone(eligible.provider.timezone)
        : (eligible.provider.state ? resolveTimezone(eligible.provider.state) : DEFAULT_TIMEZONE);
      eligibilityMap.set(pid, {
        hourlyRate: eligible.provider.hourlyRate,
        timezone: tz,
        userId: eligible.provider.userId,
      });
    }

    const recalculatedItems = cartItems.map(item => {
      const info = eligibilityMap.get(item.providerId)!;
      // price = current hourlyRate x duration (hours) - rate NOT locked at wallet purchase
      const serverPrice = parseFloat((info.hourlyRate * item.duration).toFixed(2));
      return { ...item, price: serverPrice };
    });

    const totalCost = recalculatedItems.reduce((s: number, it: any) => s + it.price, 0);

    // â”€â”€ Wallet balance check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fast-fail: check balance before pre-computing commissions
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: { transactions: { where: { status: 'CONFIRMED' } } }
    });
    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    const now = new Date();
    // CP-02 FIX: computeWalletBalance uses Number() on Prisma Decimal — prevents
    // string concatenation when multiple Decimal credits are summed.
    const actualBalance = computeWalletBalance(wallet.transactions, now);
    if (actualBalance < totalCost) {
      return NextResponse.json({
        error: `Insufficient credits. You have $${actualBalance.toFixed(2)} but need $${totalCost.toFixed(2)}`
      }, { status: 400 });
    }

    // Pre-compute commissions outside transaction (involves external calls)
    const commissions: any[] = [];
    for (const item of recalculatedItems) {
      const commission = await paymentService.calculateCommission(item.providerId, client.id, item.price);
      commissions.push(commission);
    }

    // ── Delegate to shared production service ─────────────────────────────
    // executeWalletBookingTransaction owns all CP-03/05 financial invariants:
    //   - Balance re-read inside SERIALIZABLE transaction
    //   - Slot conflict check per booking
    //   - Booking + debit written atomically
    //   - withSerializableRetry wraps the whole transaction
    const result = await executeWalletBookingTransaction(
      {
        userId:       user.id,
        customerId:   client.id,
        walletId:     wallet.id,
        items:        recalculatedItems.map((item, i) => ({
          ...item,
          timezone: eligibilityMap.get(item.providerId)!.timezone,
        })),
        commissions,
        totalCost,
      },
      prisma,
    );

    // Restore instructorUserId from eligibilityMap (service sets it to null)
    for (const c of result.created) {
      c.instructorUserId = eligibilityMap.get(c.booking.providerId)?.userId ?? null;
    }
    // Post-transaction: FinancialLedger entries per booking (non-critical)
    for (const c of result.created) {
      try {
        const { recordBookingPayment } = await import('@/lib/services/ledger-operations');
        const ledgerFee = parseFloat((c.commission.totalAmount - c.commission.providerPayout).toFixed(2));
        await recordBookingPayment({
          bookingId: c.booking.id,
          userId: user.id,
          providerId: c.booking.providerId,
          totalAmount: c.commission.totalAmount,
          platformFee: ledgerFee,
          providerPayout: c.commission.providerPayout,
          createdBy: user.id,
        });
      } catch (e: any) {
        if (!e?.message?.includes('idempotency')) {
          console.error('[FinancialLedger] create-bulk recordBookingPayment failed:', e?.message);
        }
      }
    }

    // â”€â”€ Post-transaction: transaction records + notifications + receipts â”€â”€â”€â”€â”€â”€â”€
    for (const c of result.created) {
      try {
        await prisma.transaction.create({
          data: {
            bookingId: c.booking.id,
            providerId: c.booking.providerId,
            type: 'BOOKING_PAYMENT',
            amount: c.commission.totalAmount,
            platformFee: c.commission.platformFee,
            providerPayout: c.commission.providerPayout,
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
          await notifyBookingRequest(c.instructorUserId, user.name || session!.user!.email, c.booking.id, new Date(c.booking.startTime));
        }
        if (c.clientUserId && c.booking.startTime) {
          await notifyClientBookingConfirmed(c.clientUserId, c.instructorName, c.booking.id, new Date(c.booking.startTime));
        }
      } catch (e) {
        console.error('[Notification] Failed:', e);
      }

      try {
        const durationHours = typeof c.booking.duration === 'number' ? c.booking.duration : 1;
        const hourlyRate = durationHours > 0 ? c.booking.price / durationHours : c.booking.price;
        const walletAfter = result.remaining - result.created.slice(result.created.indexOf(c) + 1).reduce((s: number, x: any) => s + x.booking.price, 0);
        await sendWalletLessonReceipt({
          customerName: user.name || session!.user!.email,
          customerEmail: session!.user!.email,
          receiptId: c.booking.id,
          bookedAt: new Date(),
          instructorName: c.instructorName,
          lessonDate: new Date(c.booking.startTime),
          durationHours,
          hourlyRate,
          lessonCost: c.booking.price,
          walletBalanceBefore: walletAfter + c.booking.price,
          walletBalanceAfter: walletAfter,
          bookedBy: 'customer',
          bookingId: c.booking.id,
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
