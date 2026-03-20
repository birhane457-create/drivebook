import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { webhookRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyPaymentReceived } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';
import Stripe from 'stripe';


export const dynamic = 'force-dynamic';
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

/**
 * Handle wallet/package purchase payment success (book later)
 */
async function handleWalletPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string,
  transactionId?: string,
  walletId?: string
): Promise<void> {
  console.log(`💰 Processing wallet payment: transactionId=${transactionId}, walletId=${walletId}`);

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      transactionId,
      walletId,
      amount: paymentIntent.amount / 100,
      type: 'wallet_purchase'
    });

    // Find wallet transaction(s) to confirm
    let transactions: any[] = [];
    
    if (transactionId) {
      // Specific transaction ID provided
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: transactionId }
      });
      if (transaction) {
        transactions = [transaction];
      }
    } else if (walletId) {
      // Find recent PENDING transactions for this wallet
      transactions = await tx.walletTransaction.findMany({
        where: {
          walletId,
          status: 'PENDING',
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
        }
      });
    }

    if (transactions.length === 0) {
      console.error('❌ No wallet transactions found to confirm');
      throw new Error('No wallet transactions found');
    }

    // ✅ Confirm all PENDING wallet transactions
    for (const transaction of transactions) {
      await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: { status: 'CONFIRMED' }
      });
      
      console.log(`✅ Wallet transaction confirmed: ${transaction.id} (${transaction.type} ${transaction.amount})`);
    }

    // Get wallet details for logging
    const wallet = await tx.clientWallet.findUnique({
      where: { id: transactions[0].walletId },
      include: { user: true }
    });

    console.log(`✅ Wallet payment processed: ${wallet?.user.email} - ${transactions.length} transaction(s) confirmed`);
  });
}

async function handleBookingPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string
): Promise<void> {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { bookingId, transactionId, walletId } = metadata;

  // Handle both booking payments AND wallet/package purchases
  if (!bookingId && !transactionId && !walletId) {
    console.error('❌ No bookingId, transactionId, or walletId in payment intent metadata');
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      error: 'Missing bookingId, transactionId, or walletId'
    });
    return;
  }

  // ✅ Handle wallet/package purchase (book later)
  if (transactionId || walletId) {
    await handleWalletPaymentSuccess(paymentIntent, idempotencyKey, transactionId, walletId);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      bookingId,
      amount: paymentIntent.amount / 100
    });

    // Fetch booking to validate
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { client: true }
    });

    if (!booking) {
      console.error('❌ Booking not found:', bookingId);
      throw new Error(`Booking not found: ${bookingId}`);
    }

    // ── Handle EXPIRED booking recovery ──────────────────────────────────────
    // Race: cron expired the booking at 10:00, webhook arrived at 10:01.
    // Stripe already charged the client — we MUST honour the payment.
    // Revive the booking to CONFIRMED so the client gets their lesson.
    if (booking.status === 'EXPIRED') {
      console.warn(`⚠️ Booking ${bookingId} was EXPIRED — reviving to CONFIRMED (payment received)`);
      // Fall through — the update below will set it to CONFIRMED
    } else if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
      // Already processed (idempotent replay) — skip wallet ops but don't error
      console.log(`ℹ️ Booking ${bookingId} already ${booking.status} — skipping wallet ops`);
      await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
        bookingId, note: 'already_confirmed'
      });
      return;
    }

    // ✅ Validate payment amount matches what was charged
    // For packages: Stripe charged packageTotalPaid. For single lessons: booking.price.
    const chargedAmount = (booking as any).packageTotalPaid || booking.price;
    const expectedAmount = Math.round(chargedAmount * 100); // Convert to cents
    const receivedAmount = paymentIntent.amount_received;
    
    if (receivedAmount !== expectedAmount) {
      console.error('❌ Payment amount mismatch:', {
        expected: expectedAmount,
        received: receivedAmount,
        bookingId
      });
      throw new Error(
        `Payment amount mismatch: expected ${expectedAmount} cents, received ${receivedAmount} cents`
      );
    }

    // Get userId from client relation — try multiple fallbacks
    let userId = booking.client?.userId;
    
    if (!userId && booking.clientId) {
      // Direct lookup by clientId (most reliable)
      const client = await tx.client.findUnique({ where: { id: booking.clientId } });
      userId = client?.userId ?? undefined;
    }

    if (!userId && booking.clientPhone) {
      const client = await tx.client.findFirst({
        where: { phone: booking.clientPhone }
      });
      userId = client?.userId ?? undefined;
    }

    if (!userId) {
      console.warn(`⚠️ Could not resolve userId for booking ${bookingId} — wallet ops skipped`);
    }

    // ✅ P0 FIX #5: Verify payment customer matches instructor
    if (paymentIntent.customer) {
      const instructor = await tx.instructor.findUnique({ 
        where: { id: booking.instructorId } 
      });
      
      if (instructor?.stripeCustomerId && instructor.stripeCustomerId !== paymentIntent.customer) {
        console.error('❌ Payment customer mismatch:', {
          instructorId: booking.instructorId,
          instructorStripeCustomerId: instructor.stripeCustomerId,
          paymentCustomerId: paymentIntent.customer
        });
        throw new Error('Payment customer does not match instructor');
      }
    }

    // ✅ All validations passed - Update booking
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

    // ── Wallet: credit full package amount, debit first lesson ──────────────
    // Per financial doctrine (PATH 2: STRIPE BOOKING):
    //   CREDIT wallet = full package amount paid via Stripe (packageTotalPaid)
    //   DEBIT  wallet = first lesson price (booking.price = 1hr × hourlyRate)
    // Remaining balance = credits available for future lessons from this package.
    // For single lessons: just confirm any pending wallet transactions.
    if (userId) {
      let wallet = await tx.clientWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.clientWallet.create({ data: { userId } });
      }

      const packageTotalPaid = (booking as any).packageTotalPaid as number | null;
      const isPackage = (booking as any).isPackageBooking && (booking as any).packageHours > 1;

      if (isPackage && packageTotalPaid) {
        // CREDIT: full package amount the client paid via Stripe
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: packageTotalPaid,
            description: `Package purchase — ${(booking as any).packageHours} hours (Stripe)`,
            status: 'CONFIRMED',
          }
        });

        // DEBIT: first lesson already scheduled (booking.price = 1hr × hourlyRate)
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: booking.price,
            description: `First lesson — ${new Date(booking.startTime!).toLocaleDateString('en-AU')} (booking #${bookingId})`,
            status: 'CONFIRMED',
          }
        });

        const remaining = packageTotalPaid - booking.price;
        console.log(`✅ Package wallet: +${packageTotalPaid} CREDIT / -${booking.price} DEBIT = ${remaining.toFixed(2)} remaining for userId=${userId}`);
      } else {
        // Single lesson — confirm any pending wallet transactions
        await tx.walletTransaction.updateMany({
          where: {
            walletId: wallet.id,
            status: 'PENDING',
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
          },
          data: { status: 'CONFIRMED' }
        });
      }
    }
  });

  console.log(`✅ Booking payment processed with validations: ${bookingId}`);

  // Notify instructor of payment received (outside transaction - non-critical)
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { instructor: true, client: true }
    });
    const payChannels = getNotifChannels('PAYMENT_RECEIVED');
    if (payChannels.inApp && booking?.instructor?.userId) {
      await notifyPaymentReceived(
        booking.instructor.userId,
        booking.price,
        booking.client?.name || booking.clientName || 'Client',
        bookingId
      );
    }
  } catch (notifError) {
    console.error('Failed to create payment notification:', notifError);
  }
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

    if (instructor?.user) {
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

  if (instructor?.user && trial_end) {
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

    // Find instructor via subscription
    const subscriptionRecord = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription as string }
    });

    if (subscriptionRecord) {
      await tx.instructor.update({
        where: { id: subscriptionRecord.instructorId },
        data: { subscriptionStatus: 'PAST_DUE' as any }
      });
    }
  });

  // Send payment failed email
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription as string },
    include: { 
      instructor: {
        include: { user: true }
      }
    }
  });

  if (subscriptionRecord?.instructor?.user) {
    await emailService.sendGenericEmail({
      to: subscriptionRecord.instructor.user.email,
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
