import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { paymentService } from '@/lib/services/payment';
import { notifyBookingRequest, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { sendWalletLessonReceipt } from '@/lib/services/receipt-email';
import { checkProviderEligible } from '@/lib/booking/checkProviderEligible';
import { localDateTimeToUTC, resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import {
  calculatePdaTestPrice,
  createWalletBookingRequestFingerprint,
  executeWalletBookingTransaction,
  computeWalletBalanceDecimal,
  readWalletBookingIdempotencyState,
  WalletBookingIdempotencyConflict,
} from '@/lib/services/wallet-booking';
import { completeWalletBookingFinancialRecords } from '@/lib/services/wallet-booking-post-commit';

export const dynamic = 'force-dynamic';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

function financialRecordsPendingResponse() {
  return NextResponse.json({
    error: 'Checkout committed, but financial records are still processing. Retry with the same Idempotency-Key.',
    code: 'FINANCIAL_RECORDS_PENDING',
    checkoutStatus: 'COMMITTED',
    financialRecordsStatus: 'PENDING',
    fullyProcessed: false,
  }, { status: 503 });
}

const pdaDetailsSchema = z.object({
  configId: z.string().min(1),
  testCentreId: z.string().min(1),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  testTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  expectedPrice: z.number().nonnegative().optional(),
});

const pdaBookingSchema = pdaDetailsSchema.extend({
  providerId: z.string().min(1),
  parentBookingIndex: z.number().int().nonnegative().max(9).optional(),
});

const cartItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  providerId: z.string().min(1),
  instructorName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  duration: z.number().min(0.5).max(8),
  price: z.number().nonnegative(), // client hint only â€” server recalculates
  pickupLocation: z.string().min(0).max(300).optional(),
  service: z.string().min(0).max(500).optional(),
  pdaTest: pdaDetailsSchema.optional(),
});

const requestSchema = z.object({
  cart: z.array(cartItemSchema).max(10).default([]),
  pdaBookings: z.array(pdaBookingSchema).max(10).default([]),
}).superRefine((data, context) => {
  if (data.cart.length === 0 && data.pdaBookings.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one lesson or PDA test',
    });
  }

  data.pdaBookings.forEach((booking, index) => {
    if (
      booking.parentBookingIndex !== undefined &&
      booking.parentBookingIndex >= data.cart.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pdaBookings', index, 'parentBookingIndex'],
        message: 'PDA booking parent lesson was not found',
      });
    }
  });
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
    if (session.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientIdempotencyKey = request.headers.get('Idempotency-Key')?.trim();
    if (!clientIdempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key is required' }, { status: 400 });
    }
    if (clientIdempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return NextResponse.json({ error: 'Idempotency-Key too long' }, { status: 400 });
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

    const idempotency = {
      key: `client-wallet:${user.id}:${clientIdempotencyKey}`,
      email: user.email,
      requestFingerprint: createWalletBookingRequestFingerprint(parsed.data),
    };
    const existingIdempotencyRecord = await prisma.bookingIdempotencyKey.findUnique({
      where: { key: idempotency.key },
    });
    if (existingIdempotencyRecord) {
      try {
        const stored = readWalletBookingIdempotencyState(existingIdempotencyRecord, idempotency);
        if (stored.financialRecordsStatus !== 'COMPLETED') {
          try {
            await completeWalletBookingFinancialRecords({
              idempotency,
              userId: user.id,
              responseBody: stored.body,
              walletTransactionId: stored.walletTransactionId,
            });
          } catch (error) {
            console.error('[Wallet checkout] Financial recovery failed:', error);
            return financialRecordsPendingResponse();
          }
        }
        return NextResponse.json(stored.body);
      } catch (error) {
        if (error instanceof WalletBookingIdempotencyConflict) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }

    const client = await prisma.customer.findFirst({
      where: { userId: user.id },
      orderBy: { id: 'desc' },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const pdaRequests = [
      ...cartItems.flatMap((item, parentBookingIndex) => item.pdaTest
        ? [{ ...item.pdaTest, providerId: item.providerId, parentBookingIndex }]
        : []),
      ...parsed.data.pdaBookings,
    ];

    // â”€â”€ Fetch current instructor rates (server-side price recalculation) â”€â”€â”€â”€â”€â”€â”€
    // "Book later" wallet funds are NOT rate-locked at purchase time.
    // Each lesson is priced at the instructor's CURRENT hourlyRate at booking time.
    // Client-submitted prices are ignored entirely.
    // CP-04 + CP-05 FIX: check provider eligibility (approval/active/subscription/docs)
    // and capture timezone for correct UTC conversion of submitted local times.
    const providerIds = [...new Set([
      ...cartItems.map(item => item.providerId),
      ...pdaRequests.map(item => item.providerId),
    ])];
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

    const priceChanges = cartItems.flatMap(item => {
      const info = eligibilityMap.get(item.providerId)!;
      const currentPrice = parseFloat((info.hourlyRate * item.duration).toFixed(2));
      return Math.abs(currentPrice - item.price) > 0.01
        ? [{
            cartItemId: item.id ?? null,
            providerId: item.providerId,
            date: item.date,
            time: item.time,
            duration: item.duration,
            submittedPrice: item.price,
            currentPrice,
          }]
        : [];
    });
    if (priceChanges.length > 0) {
      return NextResponse.json({
        error: 'An instructor rate changed. Review the updated lesson price before booking.',
        code: 'PRICE_CHANGED',
        priceChanges,
      }, { status: 409 });
    }

    const recalculatedItems = cartItems.map(item => {
      const info = eligibilityMap.get(item.providerId)!;
      const serverPrice = parseFloat((info.hourlyRate * item.duration).toFixed(2));
      return { ...item, price: serverPrice };
    });

    const resolvedPdaBookings = [];
    for (const item of pdaRequests) {
      const config = await prisma.pDATestConfig.findUnique({
        where: { id: item.configId },
        include: {
          testCentres: {
            where: { testCentreId: item.testCentreId },
            select: { testCentreId: true },
          },
        },
      });

      if (!config || !config.isActive) {
        return NextResponse.json({ error: 'PDA test option not found or inactive' }, { status: 404 });
      }
      if (config.providerId !== item.providerId) {
        return NextResponse.json({ error: 'PDA test option does not belong to this instructor' }, { status: 403 });
      }
      if (config.testCentres.length === 0) {
        return NextResponse.json({ error: 'Test centre is not available for this PDA option' }, { status: 404 });
      }

      const timezone = eligibilityMap.get(item.providerId)!.timezone;
      const testStart = localDateTimeToUTC(item.testDate, item.testTime.padStart(5, '0'), timezone);
      if (!Number.isFinite(testStart.getTime()) || testStart <= new Date()) {
        return NextResponse.json({ error: 'PDA test date and time must be in the future' }, { status: 400 });
      }

      const pdaPrice = calculatePdaTestPrice(config.price, config.discountPercent);
      if (
        item.expectedPrice !== undefined &&
        pdaPrice.toFixed(2) !== new Prisma.Decimal(item.expectedPrice).toFixed(2)
      ) {
        return NextResponse.json({
          error: 'PDA test price changed. Review the updated price before booking.',
          configId: item.configId,
          currentPrice: pdaPrice.toNumber(),
        }, { status: 409 });
      }

      resolvedPdaBookings.push({
        ...item,
        timezone: eligibilityMap.get(item.providerId)!.timezone,
        durationMinutes: config.durationMinutes,
        price: pdaPrice.toNumber(),
        discountPercent: config.discountPercent == null ? null : Number(config.discountPercent),
      });
    }

    const totalCostDecimal = recalculatedItems.reduce(
      (sum, item) => sum.plus(item.price),
      new Prisma.Decimal(0),
    ).plus(resolvedPdaBookings.reduce(
      (sum, item) => sum.plus(item.price),
      new Prisma.Decimal(0),
    ));
    const totalCost = Number(totalCostDecimal.toFixed(2));

    // â”€â”€ Wallet balance check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fast-fail: check balance before pre-computing commissions
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
      include: { transactions: { where: { status: 'CONFIRMED' } } }
    });
    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    const now = new Date();
    // CP-02 FIX: Decimal arithmetic avoids precision loss across wallet transactions.
    const actualBalance = computeWalletBalanceDecimal(wallet.transactions, now);
    const requestedCost = new Prisma.Decimal(totalCost.toFixed(2));
    if (actualBalance.lessThan(requestedCost)) {
      return NextResponse.json({
        error: `Insufficient credits. You have $${actualBalance.toFixed(2)} but need $${requestedCost.toFixed(2)}`
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
        items:        recalculatedItems.map(({ pdaTest, ...item }) => ({
          ...item,
          timezone: eligibilityMap.get(item.providerId)!.timezone,
        })),
        pdaBookings:  resolvedPdaBookings,
        commissions,
        totalCost,
        idempotency,
      },
      prisma,
    );

    try {
      await completeWalletBookingFinancialRecords({
        idempotency,
        userId: user.id,
        responseBody: result.responseBody,
        walletTransactionId: result.walletTransactionId,
      });
    } catch (error) {
      console.error('[Wallet checkout] Financial recovery failed:', error);
      return financialRecordsPendingResponse();
    }

    if (result.replayed) {
      return NextResponse.json(result.responseBody);
    }

    // Restore instructorUserId from eligibilityMap (service sets it to null)
    for (const c of result.created) {
      c.instructorUserId = eligibilityMap.get(c.booking.providerId)?.userId ?? null;
    }
    // â”€â”€ Post-transaction: transaction records + notifications + receipts â”€â”€â”€â”€â”€â”€â”€
    for (const c of result.created) {
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
        const durationHours = typeof c.booking.duration === 'number' ? c.booking.duration / 60 : 1;
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

    return NextResponse.json(result.responseBody);
  } catch (error) {
    console.error('=== BOOKING CREATION ERROR ===', error);
    if (error instanceof WalletBookingIdempotencyConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.startsWith('Insufficient')
      ? 400
      : message.startsWith('Time slot') || message.startsWith('PDA test slot')
        ? 409
        : message.startsWith('PDA test date')
          ? 400
          : 500;
    return NextResponse.json({ error: 'Failed to create bookings', details: message }, { status });
  }
}
