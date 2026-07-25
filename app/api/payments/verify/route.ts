import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * POST /api/payments/verify
 * Called by the confirmation page after Stripe redirects back.
 * Verifies the payment intent directly with Stripe and confirms the booking
 * if the webhook hasn't fired yet (common in local dev, rare in production).
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, bookingId } = await req.json();

    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Fetch booking with all fields (cast to any to access custom fields)
    const booking = await (prisma.booking.findUnique as any)({
      where: { id: bookingId },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // If not yet confirmed, verify with Stripe and update booking status
    if (!(booking.status === 'CONFIRMED' && booking.isPaid)) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ status: paymentIntent.status });
      }

      // Verify the payment intent belongs to this booking
      if (paymentIntent.metadata?.bookingId !== bookingId) {
        return NextResponse.json({ error: 'Payment intent does not match booking' }, { status: 400 });
      }

      // Payment succeeded but webhook hasn't fired yet — confirm booking now
      await (prisma.booking.update as any)({
        where: { id: bookingId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          status: 'CONFIRMED',
          paymentCaptured: true,
          paymentCapturedAt: new Date(),
        },
      });
    }

    // Credit wallet for package bookings (idempotent — skipped if already credited)
    if (booking.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: booking.clientId },
        select: { userId: true },
      });

      if (client?.userId) {
        const wallet = await prisma.clientWallet.upsert({
          where: { userId: client.userId },
          update: {},
          create: { userId: client.userId },
        });

        // Check idempotency before entering the transaction
        const alreadyCredited = await prisma.walletTransaction.findFirst({
          where: {
            walletId: wallet.id,
            status: 'CONFIRMED',
            OR: [
              { description: { contains: `booking #${bookingId}` } },
              { description: { contains: `booking #${bookingId.slice(0, 8)}` } },
            ],
          },
        });

        if (!alreadyCredited) {
          const packageTotalPaid = booking.packageTotalPaid as number | null;
          const isPackage = booking.isPackageBooking && booking.packageHours > 1;

          // ── Atomic: all wallet transaction creates in one $transaction ────────
          // Previously these were separate writes — if the second create failed,
          // the wallet would have a dangling CREDIT with no matching DEBIT.
          await prisma.$transaction(async (tx) => {
            if (isPackage && packageTotalPaid) {
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'CREDIT',
                  amount: packageTotalPaid,
                  description: `Package purchase — ${booking.packageHours} hrs · booking #${bookingId}`,
                  status: 'CONFIRMED',
                },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'DEBIT',
                  amount: booking.price,
                  description: `First lesson — ${new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })} · booking #${bookingId}`,
                  status: 'CONFIRMED',
                },
              });
            } else {
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'CREDIT',
                  amount: booking.price,
                  description: `Lesson payment · booking #${bookingId}`,
                  status: 'CONFIRMED',
                },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'DEBIT',
                  amount: booking.price,
                  description: `Lesson booked — ${new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })} · booking #${bookingId}`,
                  status: 'CONFIRMED',
                },
              });
            }
          });
        }
      }
    }

    return NextResponse.json({ status: 'confirmed' });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

/**
 * GET /api/payments/verify?bookingId=X
 * Re-runs wallet crediting for a confirmed booking that has no wallet transactions.
 * Safe to call multiple times — idempotent.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get('bookingId');

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
  }

  const booking = await (prisma.booking.findUnique as any)({ where: { id: bookingId } }) as any;
  if (!booking || !booking.isPaid) {
    return NextResponse.json({ error: 'Booking not found or not paid' }, { status: 404 });
  }

  if (!booking.clientId) {
    return NextResponse.json({ status: 'no_client', message: 'No client linked to booking' });
  }

  const client = await prisma.client.findUnique({
    where: { id: booking.clientId },
    select: { userId: true },
  });

  if (!client?.userId) {
    return NextResponse.json({ status: 'no_user', message: 'No user linked to client' });
  }

  let wallet = await prisma.clientWallet.upsert({
    where: { userId: client.userId },
    update: {},
    create: { userId: client.userId },
  });

  const alreadyCredited = await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      status: 'CONFIRMED',
      OR: [
        { description: { contains: `booking #${bookingId}` } },
      ],
    },
  });

  if (alreadyCredited) {
    return NextResponse.json({ status: 'already_credited' });
  }

  const packageTotalPaid = booking.packageTotalPaid as number | null;
  const isPackage = booking.isPackageBooking && booking.packageHours > 1;

  if (isPackage && packageTotalPaid) {
    await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: packageTotalPaid,
          description: `Package purchase — ${booking.packageHours} hrs · booking #${bookingId}`,
          status: 'CONFIRMED',
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: booking.price,
          description: `First lesson — ${new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })} · booking #${bookingId}`,
          status: 'CONFIRMED',
        },
      });
    });
    return NextResponse.json({ status: 'credited', amount: packageTotalPaid, debit: booking.price });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: booking.price,
          description: `Lesson payment · booking #${bookingId}`,
          status: 'CONFIRMED',
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: booking.price,
          description: `Lesson booked — ${new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })} · booking #${bookingId}`,
          status: 'CONFIRMED',
        },
      });
    });
    return NextResponse.json({ status: 'credited', amount: booking.price });
  }
}
