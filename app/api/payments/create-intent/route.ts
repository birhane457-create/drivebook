import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const { bookingId, amount } = await req.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId' },
        { status: 400 }
      );
    }


    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { name: true } },
        // Database schema in this project has no client relation
        // so only select instructor info.
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

    // Use clientEmail from booking (added in schema update)
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
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
