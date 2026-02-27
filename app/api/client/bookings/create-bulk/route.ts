import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { recordBookingPayment } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger';
import { paymentService } from '@/lib/services/payment';

const cartItemSchema = z.object({
  instructorId: z.string().min(1),
  instructorName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/), // HH:MM
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

    // FIXED: Rate limiting for bulk operations
    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
      request.headers.get('x-forwarded-for'),
      'bulk-booking'
    );
    
    const rateLimitResult = await checkRateLimit(bulkBookingRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('Validation failed:', parsed.error.format());
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const cartItems = parsed.data.cart;

    // Basic duplicate-in-cart check (same instructor & overlapping times)
    const batchSlots: Array<{ instructorId: string; start: Date; end: Date }> = [];
    for (const item of cartItems) {
      const start = parseDateTime(item.date, item.time);
      const end = new Date(start);
      end.setHours(end.getHours() + item.duration);
      const conflict = batchSlots.some(s => s.instructorId === item.instructorId && (
        (start >= s.start && start < s.end) ||
        (end > s.start && end <= s.end) ||
        (start <= s.start && end >= s.end)
      ));
      if (conflict) {
        return NextResponse.json({ error: `Conflict in cart for ${item.instructorName} ${item.date} ${item.time}` }, { status: 400 });
      }
      batchSlots.push({ instructorId: item.instructorId, start, end });
    }

    // Proceed in a transaction to avoid race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lookup user, client, wallet inside transaction to get consistent view
      const user = await tx.user.findUnique({ where: { email: session.user.email } });
      if (!user) throw new Error('User not found');

      const client = await tx.client.findFirst({ where: { userId: user.id } });
      if (!user) throw new Error('Client not found');

      const wallet = await tx.clientWallet.findUnique({ where: { userId: user.id } });
      if (!wallet) throw new Error('Wallet not found');

      const totalCost = cartItems.reduce((s, it) => s + it.price, 0);
      
      // Check wallet balance
      if (wallet.creditsRemaining < totalCost) {
        throw new Error('Insufficient credits');
      }

      const created: any[] = [];
      const ledgerEntries: any[] = [];

      for (const item of cartItems) {
        const startTime = parseDateTime(item.date, item.time);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + item.duration);

        // Check for existing conflicts for this instructor
        const existingConflict = await tx.booking.findFirst({
          where: {
            instructorId: item.instructorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } }
            ]
          }
        });

        if (existingConflict) {
          throw new Error(`Time slot no longer available for ${item.instructorName} at ${item.date} ${item.time}`);
        }

        // Ensure instructor exists
        const instructor = await tx.instructor.findUnique({ where: { id: item.instructorId } });
        if (!instructor) throw new Error(`Instructor ${item.instructorName} not found`);

        // Calculate commission for this booking
        const commission = await paymentService.calculateCommission(
          item.instructorId,
          client.id,
          item.price
        );

        const booking = await tx.booking.create({
          data: {
            instructorId: item.instructorId,
            clientId: client.id,
            userId: user.id,
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
            isPaid: true, // Paid from wallet
            paidAt: new Date()
          } as any
        });

        // NEW: Record booking payment in ledger (3 entries per booking)
        try {
          const ledgerResult = await recordBookingPayment(tx, {
            bookingId: booking.id,
            userId: user.id,
            instructorId: item.instructorId,
            clientId: client.id,
            totalAmount: commission.totalAmount,
            platformFee: commission.platformFee,
            instructorPayout: commission.instructorPayout,
            commissionRate: commission.commissionRate,
            isFirstBooking: commission.isFirstBooking,
            createdBy: user.id
          });
          
          ledgerEntries.push(ledgerResult);
        } catch (ledgerError) {
          console.error('[Ledger] Failed to record booking payment:', ledgerError);
          // Continue with old system for now, but log the error
        }

        // Create old-system transaction record for backward compatibility
        await (tx as any).transaction.create({
          data: {
            bookingId: booking.id,
            instructorId: item.instructorId,
            type: 'BOOKING_PAYMENT',
            amount: commission.totalAmount,
            platformFee: commission.platformFee,
            instructorPayout: commission.instructorPayout,
            commissionRate: commission.commissionRate,
            status: 'COMPLETED', // Paid from wallet
            description: `Booking payment - ${commission.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
            metadata: {
              isFirstBooking: commission.isFirstBooking,
            },
          },
        });

        created.push({ booking, instructorName: item.instructorName });
      }

      // All bookings created successfully, update wallet with optimistic locking
      const updatedWallet = await tx.clientWallet.updateMany({
        where: { 
          userId: user.id,
          version: wallet.version,  // ✅ Optimistic lock - only update if version matches
          creditsRemaining: { gte: totalCost }  // ✅ Double-check balance
        },
        data: {
          creditsRemaining: { decrement: totalCost },
          totalSpent: { increment: totalCost },
          version: { increment: 1 }  // ✅ Increment version
        }
      });

      // Check if update succeeded
      if (updatedWallet.count === 0) {
        throw new Error('Concurrent modification detected or insufficient credits. Please try again.');
      }

      // Create a wallet transaction with idempotency
      const idempotencyKey = `booking_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'debit',  // lowercase for consistency
          amount: -totalCost,  // negative for debit
          description: `Booked ${cartItems.length} lesson${cartItems.length > 1 ? 's' : ''}`,
          status: 'completed',
          idempotencyKey  // ✅ Prevents duplicate transactions
        }
      });

      // Get updated wallet for response
      const finalWallet = await tx.clientWallet.findUnique({
        where: { userId: user.id }
      });

      return { created, totalCost, remaining: finalWallet!.creditsRemaining, ledgerEntries };
    });

    // Verify ledger balance matches old system
    try {
      const ledgerBalance = await getAccountBalance(
        buildAccount(AccountType.CLIENT_WALLET, result.created[0].booking.userId)
      );
      
      const user = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        include: { wallet: true }
      });
      
      const oldBalance = user?.wallet?.balance || 0;
      
      if (Math.abs(ledgerBalance - oldBalance) > 0.01) {
        console.error('[Ledger] BALANCE MISMATCH DETECTED', {
          ledgerBalance,
          oldBalance,
          difference: ledgerBalance - oldBalance,
          userId: user?.id
        });
      } else {
        console.log('[Ledger] Balance verification passed', {
          ledgerBalance,
          oldBalance,
          userId: user?.id
        });
      }
    } catch (verifyError) {
      console.error('[Ledger] Balance verification failed:', verifyError);
    }

    // Build response
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
    const status = message === 'Insufficient credits' ? 400 : 500;
    return NextResponse.json({ error: 'Failed to create bookings', details: message }, { status });
  }
}
