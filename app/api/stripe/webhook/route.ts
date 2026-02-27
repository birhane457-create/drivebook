import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { webhookRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

/**
 * UNIFIED Stripe Webhook Handler
 * 
 * Handles ALL Stripe events:
 * - Booking payments (payment_intent.*)
 * - Subscription events (customer.subscription.*)
 * - Invoice events (invoice.*)
 * 
 * Security Features:
 * ✅ Webhook signature verification
 * ✅ Idempotency protection
 * ✅ Rate limiting
 * ✅ Audit logging
 * ✅ Atomic operations
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const rateLimitId = getRateLimitIdentifier(
      undefined,
      req.headers.get('x-forwarded-for'),
      'webhook'
    );
    
    const rateLimitResult = await checkRateLimitStrict(webhookRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      console.error('🚨 Webhook rate limit exceeded:', rateLimitId);
      return NextResponse.json(
        { error: 'Too many webhook requests' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // SECURITY: Verify webhook signature
    const event = await verifyStripeWebhook(req);
    
    // SECURITY: Idempotency check
    const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
    const existingEvent = await (prisma as any).webhookEvent.findUnique({
      where: { idempotencyKey }
    });
    
    if (existingEvent) {
      console.log('✅ Webhook already processed (idempotent):', idempotencyKey);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Process event based on type
    await handleStripeEvent(event, idempotencyKey);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('🚨 Webhook error:', error);
    
    // Log security events
    if (error.message?.includes('signature')) {
      await logSubscriptionAction({
        subscriptionId: 'unknown',
        instructorId: 'unknown',
        action: AuditAction.WEBHOOK_VERIFICATION_FAILED,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        success: false,
        errorMessage: error.message
      });
    }
    
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Verify Stripe webhook signature
 * CRITICAL: This prevents unauthorized webhook calls
 */
async function verifyStripeWebhook(req: NextRequest): Promise<Stripe.Event> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  
  if (!sig) {
    throw new Error('Missing stripe-signature header');
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set - webhook not verified!');
    console.warn('   This is DANGEROUS in production!');
    return JSON.parse(body);
  }
  
  try {
    return stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('🚨 Webhook verification failed:', err.message);
    throw new Error(`Invalid webhook signature: ${err.message}`);
  }
}

/**
 * Route events to appropriate handlers
 */
async function handleStripeEvent(event: Stripe.Event, idempotencyKey: string): Promise<void> {
  console.log(`📥 Processing webhook: ${event.type}`);
  
  switch (event.type) {
    // CHECKOUT EVENTS
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, idempotencyKey);
      break;

    // BOOKING PAYMENTS
    case 'payment_intent.succeeded':
      await handleBookingPaymentSuccess(event.data.object as Stripe.PaymentIntent, idempotencyKey);
      break;

    case 'payment_intent.payment_failed':
      await handleBookingPaymentFailed(event.data.object as Stripe.PaymentIntent, idempotencyKey);
      break;

    // SUBSCRIPTION EVENTS
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    // INVOICE EVENTS
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, idempotencyKey);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, idempotencyKey);
      break;

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
      // Still record it for idempotency
      await recordWebhookEvent(idempotencyKey, event.type, event.id, {});
  }
}

// ============================================================================
// CHECKOUT HANDLERS
// ============================================================================

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session,
  idempotencyKey: string
): Promise<void> {
  const { customer, metadata } = checkoutSession;
  const { instructorId } = metadata || {};

  if (!instructorId || !customer) {
    console.error('❌ Missing instructorId or customer in checkout session');
    await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
      error: 'Missing instructorId or customer'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
      instructorId,
      customerId: customer
    });

    // Update instructor with Stripe customer ID
    await tx.instructor.update({
      where: { id: instructorId },
      data: { stripeCustomerId: customer as string }
    });

    // Update subscription with customer ID if exists
    await tx.subscription.updateMany({
      where: { instructorId },
      data: { stripeCustomerId: customer as string }
    });

    // Audit log
    await logSubscriptionAction({
      subscriptionId: checkoutSession.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      metadata: {
        event: 'checkout_completed',
        customerId: customer
      }
    });
  });

  console.log(`✅ Checkout completed: Synced customer ${customer} for instructor ${instructorId}`);
}

// ============================================================================
// BOOKING PAYMENT HANDLERS
// ============================================================================

async function handleBookingPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string
): Promise<void> {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { bookingId } = metadata;

  if (!bookingId) {
    console.error('❌ No bookingId in payment intent metadata');
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      error: 'Missing bookingId'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      bookingId,
      amount: paymentIntent.amount / 100
    });

    // Update booking
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        status: 'CONFIRMED',
        paymentCaptured: true,
        paymentCapturedAt: new Date(),
      } as any
    });

    // Update transaction
    await (tx as any).transaction.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        stripeChargeId: (paymentIntent as any).charges?.data[0]?.id,
      }
    });

    // Update wallet
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { client: true }
    });

    if (booking?.client?.userId) {
      const wallet = await tx.clientWallet.findUnique({
        where: { userId: booking.client.userId }
      });

      if (wallet) {
        await tx.clientWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: booking.price } }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: booking.price,
            type: 'CREDIT',
            description: `Payment received for booking`,
            status: 'COMPLETED'
          }
        });
      }
    }
  });

  console.log(`✅ Booking payment processed: ${bookingId}`);
}

async function handleBookingPaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = paymentIntent;
  const { bookingId } = metadata;

  if (!bookingId) {
    await recordWebhookEvent(idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
      error: 'Missing bookingId'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
      bookingId
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'PENDING',
        paymentCaptured: false,
      } as any
    });
  });

  console.log(`❌ Booking payment failed: ${bookingId}`);
}

// ============================================================================
// SUBSCRIPTION HANDLERS
// ============================================================================

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata, status } = subscription;
  const current_period_end = (subscription as any).current_period_end;
  const trial_end = (subscription as any).trial_end;
  const { instructorId, tier } = metadata;

  if (!instructorId || !tier) {
    console.error('❌ Missing metadata in subscription:', subscription.id);
    await recordWebhookEvent(idempotencyKey, 'subscription.updated', subscription.id, {
      error: 'Missing instructorId or tier'
    });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  if (!plan) {
    console.error('❌ Invalid tier:', tier);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'subscription.updated', subscription.id, {
      instructorId,
      tier,
      status
    });

    // Update instructor
    await tx.instructor.update({
      where: { id: instructorId },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: status.toUpperCase() as any,
        commissionRate: plan.commissionRate,
        newStudentBonus: plan.newStudentBonus,
        trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
      }
    });

    // Update or create subscription record
    const existingSubscription = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (existingSubscription) {
      await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: status.toUpperCase() as any,
          currentPeriodEnd: new Date(current_period_end * 1000),
          trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
        }
      });
    } else {
      const current_period_start = (subscription as any).current_period_start;
      await tx.subscription.create({
        data: {
          instructorId,
          tier: tier as any,
          status: status.toUpperCase() as any,
          monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
          billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
          currentPeriodStart: new Date(current_period_start * 1000),
          currentPeriodEnd: new Date(current_period_end * 1000),
          trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
        }
      });
    }

    // Audit log
    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      metadata: {
        tier,
        status,
        commissionRate: plan.commissionRate,
        amount: subscription.items.data[0].price.unit_amount! / 100
      }
    });
  });

  // Send email if active
  if (status === 'active') {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      include: { user: true }
    });

    if (instructor) {
      await emailService.sendGenericEmail({
        to: instructor.user.email,
        subject: 'Subscription Activated',
        html: `
          <h2>Your ${plan.name} subscription is now active!</h2>
          <p>Thank you for subscribing to DriveBook.</p>
          <p><strong>Plan Details:</strong></p>
          <ul>
            <li>Tier: ${plan.name}</li>
            <li>Commission: ${plan.commissionRate}%</li>
            <li>New Student Bonus: ${plan.newStudentBonus}%</li>
          </ul>
        `
      });
    }
  }

  console.log(`✅ Subscription updated: ${subscription.id} (${tier}, ${status})`);
}

async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const { instructorId } = metadata;

  if (!instructorId) {
    await recordWebhookEvent(idempotencyKey, 'subscription.cancelled', subscription.id, {
      error: 'Missing instructorId'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'subscription.cancelled', subscription.id, {
      instructorId
    });

    await tx.instructor.update({
      where: { id: instructorId },
      data: { subscriptionStatus: 'CANCELLED' as any }
    });

    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_CANCELLED
    });
  });

  console.log(`✅ Subscription cancelled: ${subscription.id}`);
}

async function handleTrialEnding(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const trial_end = (subscription as any).trial_end;
  const { instructorId } = metadata;

  if (!instructorId) return;

  await recordWebhookEvent(idempotencyKey, 'subscription.trial_ending', subscription.id, {
    instructorId,
    trialEnd: trial_end
  });

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    include: { user: true }
  });

  if (instructor && trial_end) {
    const daysLeft = Math.ceil((new Date(trial_end * 1000).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: `Your trial ends in ${daysLeft} days`,
      html: `
        <h2>Your free trial is ending soon</h2>
        <p>Your trial will end on ${new Date(trial_end * 1000).toLocaleDateString()}.</p>
        <p>To continue using DriveBook, your payment method will be charged automatically.</p>
      `
    });

    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_TRIAL_ENDING,
      metadata: { daysLeft }
    });
  }

  console.log(`✅ Trial ending notification sent: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_succeeded', invoice.id, {});
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_succeeded', invoice.id, {
      subscriptionId: subscription
    });

    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription as string },
      data: { status: 'ACTIVE' }
    });
  });

  console.log(`✅ Invoice payment succeeded: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_failed', invoice.id, {});
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_failed', invoice.id, {
      subscriptionId: subscription
    });

    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription as string },
      data: { status: 'PAST_DUE' }
    });

    await tx.instructor.updateMany({
      where: { stripeSubscriptionId: subscription as string },
      data: { subscriptionStatus: 'PAST_DUE' as any }
    });
  });

  // Send payment failed email
  const instructor = await prisma.instructor.findFirst({
    where: { stripeSubscriptionId: subscription as string },
    include: { user: true }
  });

  if (instructor) {
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: 'Payment Failed',
      html: `
        <h2>Payment Failed</h2>
        <p>We were unable to process your payment.</p>
        <p>Please update your payment method to continue using DriveBook.</p>
      `
    });
  }

  console.log(`❌ Invoice payment failed: ${invoice.id}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Record webhook event for idempotency
 * CRITICAL: This prevents duplicate processing
 */
async function recordWebhookEvent(
  idempotencyKey: string,
  eventType: string,
  stripeEventId: string,
  metadata: any
): Promise<void> {
  await (prisma as any).webhookEvent.create({
    data: {
      idempotencyKey,
      eventType,
      stripeEventId,
      metadata,
      processedAt: new Date()
    }
  });
}
