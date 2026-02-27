import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

// Stripe webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify webhook signature in production
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { bookingId } = metadata;

  if (!bookingId) {
    console.error('No bookingId in payment intent metadata');
    return;
  }

  // Update transaction status
  await prisma.transaction.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: {
      status: 'COMPLETED',
      processedAt: new Date(),
      stripeChargeId: paymentIntent.charges?.data[0]?.id,
    },
  });

  // Update booking as paid
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      isPaid: true,
      paidAt: new Date(),
      status: 'CONFIRMED',
      paymentCaptured: true,
      paymentCapturedAt: new Date(),
    } as any,
    include: {
      instructor: { include: { user: true } },
      client: true,
    },
  }) as any;

  // Parse booking notes to extract package details
  const notes = booking.notes || '';
  const hoursMatch = notes.match(/BULK PACKAGE: (\d+) hours/);
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const includesTestPackage = notes.includes('Test Package: Yes');
  const bookingType = notes.includes('Booking Type: now') ? 'now' : 'later';
  const registrationType = notes.includes('Registration Type: someone-else') ? 'someone-else' : 'myself';
  
  // Extract learner info if someone-else
  let learnerName = '';
  let learnerRelationship = '';
  if (registrationType === 'someone-else') {
    const learnerMatch = notes.match(/Learner: ([^\n]+)/);
    const relationshipMatch = notes.match(/Relationship: ([^\n]+)/);
    learnerName = learnerMatch ? learnerMatch[1] : '';
    learnerRelationship = relationshipMatch ? relationshipMatch[1] : '';
  }

  // CRITICAL FIX: Update wallet balance for package purchases
  if (booking.isPackageBooking && booking.userId) {
    try {
      // Idempotency key to prevent duplicate credits
      const idempotencyKey = `stripe_payment_${paymentIntentId}`;
      
      // Check if already processed
      const existingTransaction = await prisma.walletTransaction.findUnique({
        where: { idempotencyKey }
      });
      
      if (existingTransaction) {
        console.log(`✅ Wallet already credited for payment ${paymentIntentId} - skipping duplicate`);
      } else {
        // Get or create wallet
        const wallet = await prisma.clientWallet.upsert({
          where: { userId: booking.userId },
          create: {
            userId: booking.userId,
            totalPaid: booking.price,
            creditsRemaining: booking.price,
            totalSpent: 0
          },
          update: {
            totalPaid: { increment: booking.price },
            creditsRemaining: { increment: booking.price }
          }
        });

        // Create wallet transaction record with idempotency key
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: booking.price,
            description: `Package purchase: ${hours} hours`,
            status: 'completed',
            idempotencyKey,  // ✅ Prevents duplicate processing
            metadata: {
              bookingId: booking.id,
              packageHours: hours,
              includesTestPackage,
              stripePaymentIntentId: paymentIntentId
            }
          }
        });

        console.log(`✅ Wallet updated: Added $${booking.price} for user ${booking.userId}`);
      }
    } catch (walletError) {
      console.error(`❌ Failed to update wallet for user ${booking.userId}:`, walletError);
    }
  }

  // Send confirmation email to client with error handling
  try {
    await emailService.sendGenericEmail({
      to: booking.client.email,
      subject: `Booking Confirmed - ${booking.instructor.name}`,
      html: `
        <h2>🎉 Your Booking is Confirmed!</h2>
        <p>Hi ${booking.client.name},</p>
        <p>Thank you for your payment! Your driving lesson package has been confirmed.</p>
        
        <h3>Booking Details:</h3>
        <ul>
          <li><strong>Instructor:</strong> ${booking.instructor.name}</li>
          <li><strong>Package:</strong> ${hours} hours</li>
          ${includesTestPackage ? '<li><strong>Test Package:</strong> Included</li>' : ''}
          <li><strong>Total Paid:</strong> $${booking.price.toFixed(2)}</li>
          ${registrationType === 'someone-else' ? `<li><strong>Learner:</strong> ${learnerName} (${learnerRelationship})</li>` : ''}
        </ul>

        <h3>Next Steps:</h3>
        ${bookingType === 'now' ? `
          <p>Your scheduled lessons are confirmed. You'll receive individual reminders before each lesson.</p>
        ` : `
          <p>You can now schedule your lessons from your dashboard:</p>
          <p><a href="${process.env.NEXTAUTH_URL}/client-dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Go to Dashboard</a></p>
        `}

        <h3>Instructor Contact:</h3>
        <ul>
          <li><strong>Name:</strong> ${booking.instructor.name}</li>
          <li><strong>Phone:</strong> ${booking.instructor.phone}</li>
          <li><strong>Email:</strong> ${booking.instructor.user.email}</li>
        </ul>

        <p>If you have any questions, feel free to contact your instructor directly.</p>
        
        <p>Happy learning!</p>
        <p>The DriveBook Team</p>
      `
    });
    console.log(`✅ Confirmation email sent to ${booking.client.email}`);
  } catch (error) {
    console.error(`❌ Failed to send confirmation email to ${booking.client.email}:`, error);
  }

  // Send welcome email with login credentials if this is a new user
  const user = await prisma.user.findUnique({
    where: { email: booking.client.email },
    select: { id: true, createdAt: true }
  });

  // Check if user was created recently (within last 5 minutes) - indicates new account
  if (user && user.createdAt) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (user.createdAt > fiveMinutesAgo) {
      try {
        await emailService.sendWelcomeEmail({
          clientName: booking.client.name,
          clientEmail: booking.client.email
        });
        console.log(`✅ Welcome email sent to ${booking.client.email}`);
      } catch (error) {
        console.error(`❌ Failed to send welcome email to ${booking.client.email}:`, error);
      }
    }
  }

  // Send notification to instructor with error handling
  try {
    await emailService.sendGenericEmail({
      to: booking.instructor.user.email,
      subject: `Payment Received - ${booking.client.name}`,
      html: `
        <h2>💰 Payment Received!</h2>
        <p>Hi ${booking.instructor.name},</p>
        <p>Great news! Payment has been received for a booking package.</p>
        
        <h3>Booking Details:</h3>
        <ul>
          <li><strong>Client:</strong> ${booking.client.name}</li>
          <li><strong>Email:</strong> ${booking.client.email}</li>
          <li><strong>Phone:</strong> ${booking.client.phone}</li>
          <li><strong>Package:</strong> ${hours} hours</li>
          ${includesTestPackage ? '<li><strong>Test Package:</strong> Included</li>' : ''}
          ${registrationType === 'someone-else' ? `<li><strong>Learner:</strong> ${learnerName} (${learnerRelationship})</li>` : ''}
          <li><strong>Booking Type:</strong> ${bookingType === 'now' ? 'Book Now (lessons scheduled)' : 'Book Later (client will schedule)'}</li>
        </ul>

        <h3>Revenue:</h3>
        <ul>
          <li><strong>Total Package:</strong> $${booking.price.toFixed(2)}</li>
          <li><strong>Platform Fee:</strong> $${(booking.platformFee || 0).toFixed(2)}</li>
          <li><strong>Your Payout:</strong> $${(booking.instructorPayout || 0).toFixed(2)}</li>
        </ul>

        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/bookings" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">View in Dashboard</a></p>
        
        <p>The DriveBook Team</p>
      `
    });
    console.log(`✅ Notification email sent to ${booking.instructor.user.email}`);
  } catch (error) {
    console.error(`❌ Failed to send notification email to ${booking.instructor.user.email}:`, error);
  }

  console.log(`Payment successful for booking ${bookingId}`);
}

async function handlePaymentFailed(paymentIntent: any) {
  const { id: paymentIntentId, metadata, last_payment_error } = paymentIntent;
  const { bookingId } = metadata;

  await prisma.transaction.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: last_payment_error?.message || 'Payment failed',
    },
  });

  console.log(`Payment failed for booking ${bookingId}: ${last_payment_error?.message}`);
}

async function handleSubscriptionUpdate(subscription: any) {
  const { customer, metadata, status, current_period_end } = subscription;
  const { instructorId, tier } = metadata;

  if (!instructorId) {
    console.error('No instructorId in subscription metadata');
    return;
  }

  // Find existing subscription by stripeSubscriptionId
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existingSubscription) {
    // Update existing subscription
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: status.toUpperCase(),
        currentPeriodEnd: new Date(current_period_end * 1000),
      },
    });
  } else {
    // Create new subscription
    await prisma.subscription.create({
      data: {
        instructorId,
        tier: tier || 'PRO',
        status: status.toUpperCase(),
        monthlyAmount: subscription.items.data[0].price.unit_amount / 100,
        billingCycle: 'monthly',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000),
        stripeCustomerId: customer,
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  console.log(`Subscription ${status} for instructor ${instructorId}`);
}

async function handleSubscriptionCancelled(subscription: any) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  console.log(`Subscription cancelled: ${subscription.id}`);
}
