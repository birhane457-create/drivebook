import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';
import { getDisplayName } from '@/lib/utils/account';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, transactionId, amount, paymentToken } = body;

    // Handle both booking payments AND wallet/package purchases
    if (!bookingId && !transactionId) {
      return NextResponse.json(
        { error: 'Missing bookingId or transactionId' },
        { status: 400 }
      );
    }

    // ✅ Handle wallet/package purchase (book later) — always requires session
    if (transactionId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handleWalletPaymentIntent(transactionId, amount);
    }

    // ✅ Handle booking payment (book now)
    // Two auth paths:
    //   1. paymentToken provided (unauthenticated payment page) — token is validated in handler
    //   2. session present (dashboard / admin) — session ownership is validated in handler
    const session = await getServerSession(authOptions);
    return handleBookingPaymentIntent(bookingId, amount, session?.user ?? undefined, paymentToken);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Create payment intent for wallet/package purchase (book later)
 */
async function handleWalletPaymentIntent(transactionId: string, amount?: number) {
  try {
    // Get wallet transaction details
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: true
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status === 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Transaction already confirmed' },
        { status: 400 }
      );
    }

    // Use provided amount or transaction amount
    const paymentAmount = amount || transaction.amount;
    const clientEmail = transaction.wallet.user.email;

    // Create payment intent with transactionId in metadata
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: paymentAmount,
      instructorId: '', // Not applicable for wallet purchases
      transactionId: transaction.id, // ✅ Pass transactionId instead of bookingId
      walletId: transaction.walletId, // ✅ Also pass walletId for webhook
      clientEmail,
      description: transaction.description || 'Package purchase',
    });

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      amount: paymentIntent.amount,
    });
  } catch (error) {
    console.error('Error in handleWalletPaymentIntent:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Create payment intent for booking payment (book now)
 */
async function handleBookingPaymentIntent(bookingId: string, amount?: number, sessionUser?: { id: string; role: string }, paymentToken?: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { id: true, name: true, businessName: true, accountType: true, paymentMode: true, subscriptionTier: true } }
      },
    }) as any;

    // ── Payment mode guard (phase 2 safety net) ───────────────────────────────
    if (booking?.instructor?.paymentMode === 'DIRECT') {
      console.error(`[create-intent] instructor ${booking.instructor.id} has paymentMode=DIRECT which is not yet implemented`);
      return NextResponse.json({
        error: 'Direct payment mode is not yet available. Please contact support.',
        code: 'PAYMENT_MODE_NOT_IMPLEMENTED',
      }, { status: 503 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── Auth gate ──────────────────────────────────────────────────────────
    // Either a valid paymentToken (payment page) OR a valid session (dashboard) is required.
    // Both provide identity verification — token proves SMS receipt, session proves login.
    if (paymentToken) {
      // Token path: unauthenticated payment page
      const storedToken = booking.paymentToken ?? '';
      if (!storedToken || storedToken !== paymentToken) {
        return NextResponse.json({ error: 'Invalid payment token' }, { status: 403 });
      }
    } else if (sessionUser) {
      // Session path: authenticated dashboard/admin
      const isAdmin = sessionUser.role === 'ADMIN' || sessionUser.role === 'SUPER_ADMIN';
      if (!isAdmin && booking.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: booking.clientId },
          select: { userId: true },
        });
        if (client?.userId !== sessionUser.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    } else {
      // No token and no session — reject
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (booking.isPaid) {
      return NextResponse.json(
        { error: 'Booking already paid' },
        { status: 400 }
      );
    }

    // Validate booking is still in a payable state
    // Never create/reuse a PaymentIntent for expired, cancelled, or completed bookings
    const SLOT_HOLD_MINUTES = 10;
    const expiresAt = new Date(booking.createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000);
    const isExpired =
      booking.status === 'EXPIRED' ||
      (booking.status === 'PENDING_PAYMENT' && new Date() > expiresAt);

    if (isExpired) {
      return NextResponse.json(
        { error: 'This booking has expired. The slot has been released — please book again.', code: 'BOOKING_EXPIRED' },
        { status: 410 }
      );
    }

    if (!['PENDING_PAYMENT', 'PENDING'].includes(booking.status)) {
      return NextResponse.json(
        { error: `Booking is not in a payable state (status: ${booking.status})`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Use provided amount or booking price
    const paymentAmount = amount || booking.price;

    // FIX: PaymentIntent deduplication with DB-level advisory lock.
    //
    // RACE CONDITION (before fix):
    //   Two tabs both read booking.paymentIntentId = null simultaneously.
    //   Both skip the existing-intent check. Both call stripe.paymentIntents.create().
    //   Last UPDATE wins — the first intent is orphaned in Stripe forever.
    //
    // FIX: PostgreSQL advisory lock per booking ID.
    //   Only one request at a time can reach the create + update path for a given bookingId.
    //   The lock is released automatically at transaction end.
    //
    // Implementation: pg_advisory_xact_lock(bigint) takes an integer. We hash the bookingId
    // string to a stable 64-bit integer using hashtext() which is available in all Postgres versions.

    const dedupeResult = await prisma.$transaction(async (tx) => {
      // Acquire exclusive lock for this bookingId — blocks concurrent requests
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;

      // Re-read booking inside the lock to get the latest paymentIntentId
      const freshBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { paymentIntentId: true, isPaid: true, status: true },
      }) as any;

      if (!freshBooking) return { status: 'not_found' as const };
      if (freshBooking.isPaid) return { status: 'already_paid' as const };
      if (!['PENDING_PAYMENT', 'PENDING'].includes(freshBooking.status)) {
        return { status: 'invalid_status' as const, bookingStatus: freshBooking.status };
      }

      // Check existing intent while holding the lock — no race possible here
      if (freshBooking.paymentIntentId) {
        try {
          const existingIntent = await stripeService.retrievePaymentIntent(freshBooking.paymentIntentId);
          const reusableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];
          if (reusableStatuses.includes(existingIntent.status)) {
            return {
              status: 'reuse' as const,
              clientSecret: existingIntent.client_secret,
              amount: existingIntent.amount / 100,
            };
          }
          // Existing intent is not reusable (succeeded/canceled/etc) — we'll create a new one
          // (Stripe payment intents cannot be cancelled, only refunded if succeeded)
        } catch {
          // Intent not found in Stripe — create new one
        }
      }

      return { status: 'create_new' as const };
    });

    if (dedupeResult.status === 'not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (dedupeResult.status === 'already_paid') {
      return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });
    }
    if (dedupeResult.status === 'invalid_status') {
      return NextResponse.json(
        { error: `Booking is not in a payable state (status: ${dedupeResult.bookingStatus})`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }
    if (dedupeResult.status === 'reuse') {
      return NextResponse.json({
        clientSecret: dedupeResult.clientSecret,
        amount: dedupeResult.amount,
      });
    }
    // dedupeResult.status === 'create_new' — fall through to create

    // Get clientEmail — look up linked client's user email.
    // Use null if not found — never fall back to a placeholder that misdirects Stripe receipts.
    let clientEmail: string | null = null;
    if (booking.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: booking.clientId },
        include: { user: true }
      });
      if (client?.user?.email) clientEmail = client.user.email;
      else if (client?.email) clientEmail = client.email;
    }

    // Get tier-aware commission rate from DB settings
    const commissionRate = await getCommissionRate(booking.instructor.subscriptionTier ?? 'BASIC');

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: paymentAmount,
      instructorId: booking.instructorId,
      bookingId: booking.id,
      commissionRate,
      clientEmail: clientEmail ?? '',
      description: `Driving lesson with ${getDisplayName(booking.instructor)}`,
    });

    // Update booking with payment intent ID
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: paymentIntent.paymentIntentId } as any,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      amount: paymentIntent.amount,
    });
  } catch (error) {
    console.error('Error in handleBookingPaymentIntent:', error);
    return NextResponse.json(
      { error: 'Failed to create booking payment intent' },
      { status: 500 }
    );
  }
}
