import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
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
    return handleBookingPaymentIntent(bookingId, amount);
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
async function handleBookingPaymentIntent(bookingId: string, amount?: number) {
  try {
    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { name: true } }
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
        // Retrieve existing payment intent from Stripe
        const existingIntent = await stripeService.retrievePaymentIntent(booking.paymentIntentId);
        
        // If it's still valid (not succeeded or canceled), reuse it
        if (existingIntent.status !== 'succeeded' && existingIntent.status !== 'canceled') {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            amount: existingIntent.amount / 100,
          });
        }
      } catch (error) {
        console.log('Existing payment intent not found or invalid, creating new one');
      }
    }

    // Use clientEmail from booking
    const clientEmail = booking.clientEmail || 'customer@example.com';

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: paymentAmount,
      instructorId: booking.instructorId,
      bookingId: booking.id,
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
