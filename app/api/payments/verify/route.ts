import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { logFinancialAction, ActorRole } from '@/lib/services/auditLogger';
import { writeAuditLog } from '@/lib/services/audit';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * POST /api/payments/verify
 * 
 * SECURITY FIX: Read-only endpoint - webhook is the sole source of truth for mutations.
 * 
 * Called by the confirmation page after Stripe redirects back.
 * Returns current payment and booking status without making any mutations.
 * The webhook handler is responsible for all booking confirmations and wallet credits.
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, bookingId, paymentToken } = await req.json();

    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // ✅ SECURITY FIX: Authentication required - either paymentToken OR session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !paymentToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If paymentToken provided, validate it
    if (paymentToken) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { paymentToken: true }
      });
      
      if (booking?.paymentToken !== paymentToken) {
        return NextResponse.json({ error: 'Invalid payment token' }, { status: 403 });
      }
    }

    // ✅ READ ONLY: Just check Stripe status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify PI belongs to this booking
    if (paymentIntent.metadata?.bookingId !== bookingId) {
      return NextResponse.json({ 
        error: 'Payment intent does not match booking' 
      }, { status: 400 });
    }

    // ✅ SECURITY FIX: Validate amount matches expected booking price
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, isPaid: true, price: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Validate amount_received matches booking.price (in cents)
    const expectedAmountCents = Math.round(Number(booking.price) * 100);
    if (paymentIntent.amount_received && paymentIntent.amount_received !== expectedAmountCents) {
      console.error(`⚠️ Amount mismatch: Stripe received ${paymentIntent.amount_received} cents, expected ${expectedAmountCents} cents for booking ${bookingId}`);
      // Log but don't block - webhook will reject if amounts don't match
    }

    // Return status - let webhook handle all mutations
    return NextResponse.json({
      stripeStatus: paymentIntent.status,
      bookingStatus: booking?.status,
      isPaid: booking?.isPaid,
      amountReceived: paymentIntent.amount_received,
      message: paymentIntent.status === 'succeeded' 
        ? 'Payment confirmed. Processing your booking...' 
        : 'Payment in progress'
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

/**
 * GET /api/payments/verify?bookingId=X
 * 
 * SECURITY FIX: ADMIN-only manual wallet credit endpoint.
 * 
 * Re-runs wallet crediting for a confirmed booking that has no wallet transactions.
 * Should only be used by admins for manual intervention/recovery scenarios.
 * Includes Stripe verification and audit logging.
 * Safe to call multiple times — idempotent.
 */
export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY FIX: Require ADMIN or SUPER_ADMIN role
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        isPaid: true,
        price: true,
        customerId: true,
        paymentIntentId: true,
        packageHours: true,
        isPackageBooking: true,
        packageTotalPaid: true,
        startTime: true,
      }
    });

    if (!booking || !booking.isPaid) {
      return NextResponse.json({ error: 'Booking not found or not paid' }, { status: 404 });
    }

    if (!booking.customerId) {
      return NextResponse.json({ status: 'no_client', message: 'No client linked to booking' });
    }

    // ✅ SECURITY FIX: Verify with Stripe before crediting wallet
    if (booking.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json({
            error: 'Payment not succeeded in Stripe',
            stripeStatus: paymentIntent.status
          }, { status: 400 });
        }

        // Validate amount matches
        const expectedAmountCents = Math.round(Number(booking.price) * 100);
        if (paymentIntent.amount_received !== expectedAmountCents) {
          return NextResponse.json({
            error: 'Amount mismatch between booking and Stripe',
            bookingAmount: booking.price,
            stripeAmount: paymentIntent.amount_received / 100
          }, { status: 400 });
        }
      } catch (stripeError) {
        console.error('Stripe verification failed:', stripeError);
        return NextResponse.json({
          error: 'Failed to verify payment with Stripe'
        }, { status: 500 });
      }
    }

    const client = await prisma.customer.findUnique({
      where: { id: booking.customerId },
      select: { userId: true },
    });

    if (!client?.userId) {
      return NextResponse.json({ status: 'no_user', message: 'No user linked to client' });
    }

    const wallet = await prisma.clientWallet.upsert({
      where: { userId: client.userId },
      update: {},
      create: { userId: client.userId },
    });

    // ✅ SECURITY FIX: Metadata-based idempotency
    const idempotencyKey = `admin-credit-${bookingId}`;
    const alreadyCredited = await prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        status: 'CONFIRMED',
        OR: [
          { description: { contains: `booking #${bookingId}` } },
          { metadata: { path: ['idempotencyKey'], equals: idempotencyKey } }
        ],
      },
    });

    if (alreadyCredited) {
      return NextResponse.json({ status: 'already_credited' });
    }

    const packageTotalPaid = booking.packageTotalPaid as number | null;
    const isPackage = booking.isPackageBooking && booking.packageHours && Number(booking.packageHours) > 1;

    let creditAmount: number;
    let debitAmount: number;

    if (isPackage && packageTotalPaid) {
      await prisma.$transaction(async (tx) => {
        const verifyTz = DEFAULT_TIMEZONE;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: packageTotalPaid,
            description: `Package purchase — ${booking.packageHours} hrs · booking #${bookingId}`,
            status: 'CONFIRMED',
            metadata: { idempotencyKey, adminUserId: session.user.id }
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: booking.price,
            description: `First lesson — ${new Date(booking.startTime!).toLocaleDateString('en-AU', { timeZone: verifyTz })} · booking #${bookingId}`,
            status: 'CONFIRMED',
            metadata: { idempotencyKey, adminUserId: session.user.id }
          },
        });
      });
      creditAmount = packageTotalPaid;
      debitAmount = Number(booking.price);
    } else {
      await prisma.$transaction(async (tx) => {
        const verifyTz = DEFAULT_TIMEZONE;
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: booking.price,
            description: `Lesson payment · booking #${bookingId}`,
            status: 'CONFIRMED',
            metadata: { idempotencyKey, adminUserId: session.user.id }
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: booking.price,
            description: `Lesson booked — ${new Date(booking.startTime!).toLocaleDateString('en-AU', { timeZone: verifyTz })} · booking #${bookingId}`,
            status: 'CONFIRMED',
            metadata: { idempotencyKey, adminUserId: session.user.id }
          },
        });
        // AUDIT-01/02 fix (Tier 2): audit written atomically with wallet credit/debit.
        await writeAuditLog(tx, {
          action:     'ADMIN_WALLET_CREDIT_MANUAL',
          actorId:    session.user.id,
          actorRole:  'ADMIN',
          targetType: 'WALLET',
          targetId:   wallet.id,
          ipAddress:  req.headers.get('x-forwarded-for') ?? null,
          userAgent:  req.headers.get('user-agent') ?? null,
          metadata:   { bookingId, creditAmount: Number(booking.price), isPackage, idempotencyKey },
          success:    true,
        });
      });
      creditAmount = Number(booking.price);
      debitAmount = Number(booking.price);
    }

    return NextResponse.json({ 
      status: 'credited', 
      amount: creditAmount,
      debit: debitAmount 
    });
  } catch (error) {
    console.error('Manual wallet credit error:', error);
    return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 });
  }
}
