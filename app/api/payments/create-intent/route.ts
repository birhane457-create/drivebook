import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Auth required — only the booking owner (client or instructor) can create a payment intent
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, transactionId, amount } = await req.json();

    // Handle both booking payments AND wallet/package purchases
    if (!bookingId && !transactionId) {
      return NextResponse.json(
        { error: 'Missing bookingId or transactionId' },
        { status: 400 }
      );
    }

    // ✅ Handle wallet/package purchase (book later)
    if (transactionId) {
      return handleWalletPaymentIntent(transactionId, amount);
    }

    // ✅ Handle booking payment (book now)
    return handleBookingPaymentIntent(bookingId, amount, session.user);
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
async function handleBookingPaymentIntent(bookingId: string, amount?: number, sessionUser?: { id: string; role: string }) {
  try {
    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { name: true, subscriptionTier: true } }
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Ownership check: only the client linked to this booking can pay for it
    // (or an admin — admins have no clientId so we check role)
    if (sessionUser) {
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
    }

    if (booking.isPaid) {
      return NextResponse.json(
        { error: 'Booking already paid' },
        { status: 400 }
      );
    }

    // Use provided amount or booking price
    const paymentAmount = amount || booking.price;

    // Check if payment intent already exists for this booking
    if (booking.paymentIntentId) {
      try {
        const existingIntent = await stripeService.retrievePaymentIntent(booking.paymentIntentId);
        // Only reuse if it's in a state where the client can still complete payment.
        // 'requires_action' and 'processing' are also safe to reuse.
        // Do NOT reuse 'succeeded', 'canceled', or 'requires_payment_method' with an
        // expired card — create a fresh intent instead.
        const reusableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];
        if (reusableStatuses.includes(existingIntent.status)) {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            amount: existingIntent.amount / 100,
          });
        }
        // Otherwise fall through and create a new intent
        console.log(`Payment intent ${booking.paymentIntentId} in status '${existingIntent.status}' — creating new one`);
      } catch (error) {
        console.log('Existing payment intent not found or invalid, creating new one');
      }
    }

    // Get clientEmail — look up linked client's user email
    let clientEmail = 'customer@example.com';
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
      clientEmail,
      description: `Driving lesson with ${booking.instructor.name}`,
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
