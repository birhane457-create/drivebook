// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    
    // Verify webhook signature (in production)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const sig = req.headers.get('stripe-signature');
      
      try {
        const event = stripe.webhooks.constructEvent(
          body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
        
        await handleStripeEvent(event);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 400 }
        );
      }
    } else {
      // Development mode - parse without verification
      const event = JSON.parse(body);
      await handleStripeEvent(event);
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

async function handleStripeEvent(event: any) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionUpdate(subscription: any) {
  const { metadata, status, current_period_end, trial_end } = subscription;
  const { instructorId, tier } = metadata;

  if (!instructorId || !tier) {
    console.error('Missing metadata in subscription');
    return;
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];

  // Fetch current instructor tier BEFORE updating — needed for voice line logic
  const currentInstructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { subscriptionTier: true, voiceLine: true, voiceLineStatus: true },
  });

  // Update instructor
  await prisma.instructor.update({
    where: { id: instructorId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: status.toUpperCase(),
      // commissionRate and newStudentBonus removed — both were legacy fields no longer in schema.
      // commissionRate: the platform fee is now resolved at booking time via getCommissionRate()
      //   from platform-pricing service (DB-backed, not stored per-instructor).
      // newStudentBonus: deprecated — will be replaced by a referral system later.
      trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
    },
  });

  // ── Voice line: auto-assign when upgrading to PRO+ ────────────────────────
  // If instructor is moving from a non-dedicated tier (BASIC/TRIAL) to a
  // dedicated-line tier (PRO/STUDIO/BUSINESS), and they don't already have a
  // line, try to assign one from the pool. Non-fatal if pool is empty.
  try {
    const { isDedicatedLineTier, assignVoiceLine, releaseVoiceLine } = await import('@/lib/services/voice-line-service');
    const wasOnDedicatedTier = currentInstructor?.subscriptionTier ? isDedicatedLineTier(currentInstructor.subscriptionTier) : false;
    const isNowOnDedicatedTier = isDedicatedLineTier(tier);

    if (!wasOnDedicatedTier && isNowOnDedicatedTier && !currentInstructor?.voiceLine) {
      // Upgraded to PRO+ — assign a number
      const assigned = await assignVoiceLine(instructorId);
      console.log(`[VoiceLine] Auto-assigned ${assigned.phoneNumber} to instructor ${instructorId} on ${tier} upgrade`);
    } else if (wasOnDedicatedTier && !isNowOnDedicatedTier && currentInstructor?.voiceLine) {
      // Downgraded from PRO+ to BASIC — release the number back to the pool
      await releaseVoiceLine(instructorId);
      console.log(`[VoiceLine] Released voice line from instructor ${instructorId} on downgrade to ${tier}`);
    }
  } catch (voiceErr: any) {
    // Non-fatal — subscription still updates even if voice line pool is empty
    console.error(`[VoiceLine] Voice line assignment/release failed for instructor ${instructorId}:`, voiceErr.message);
  }

  // Update or create subscription record
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: status.toUpperCase() as any,
        currentPeriodEnd: new Date(current_period_end * 1000),
        trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        instructorId,
        tier: tier as any,
        status: status.toUpperCase() as any,
        monthlyAmount: subscription.items.data[0].price.unit_amount / 100,
        billingCycle: subscription.items.data[0].price.recurring.interval === 'year' ? 'annual' : 'monthly',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000),
        trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  // Send email notification
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    include: { user: true },
  });

  if (instructor && status === 'active') {
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: 'Subscription Activated',
      html: `
        <h2>Your ${plan.name} subscription is now active!</h2>
        <p>Thank you for subscribing to DriveBook.</p>
        <p><strong>Plan Details:</strong></p>
        <ul>
          <li>Tier: ${plan.name}</li>
          <li>Platform commission: ${plan.commissionRate}% per booking</li>
        </ul>
        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/subscription">Manage Subscription</a></p>
      `,
    });
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  const { metadata } = subscription;
  const { instructorId } = metadata;

  if (!instructorId) return;

  await prisma.instructor.update({
    where: { id: instructorId },
    data: {
      subscriptionStatus: 'CANCELLED',
    },
  });

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  // ── Voice line: release on cancellation ──────────────────────────────────
  try {
    const { releaseVoiceLine } = await import('@/lib/services/voice-line-service');
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { voiceLine: true },
    });
    if (instructor?.voiceLine) {
      await releaseVoiceLine(instructorId);
      console.log(`[VoiceLine] Released voice line from instructor ${instructorId} on subscription cancellation`);
    }
  } catch (voiceErr: any) {
    console.error(`[VoiceLine] Release failed on cancellation for instructor ${instructorId}:`, voiceErr.message);
  }

  // Send cancellation email
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    include: { user: true },
  });

  if (instructor) {
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: 'Subscription Cancelled',
      html: `
        <h2>Your subscription has been cancelled</h2>
        <p>Your subscription will remain active until ${new Date(subscription.current_period_end * 1000).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })}.</p>
        <p>You can reactivate anytime from your dashboard.</p>
        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/subscription">Reactivate Subscription</a></p>
      `,
    });
  }
}

async function handleTrialEnding(subscription: any) {
  const { metadata, trial_end } = subscription;
  const { instructorId } = metadata;

  if (!instructorId) return;

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    include: { user: true },
  });

  if (instructor) {
    const daysLeft = Math.ceil((new Date(trial_end * 1000).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: `Your trial ends in ${daysLeft} days`,
      html: `
        <h2>Your free trial is ending soon</h2>
        <p>Your trial will end on ${new Date(trial_end * 1000).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })}.</p>
        <p>To continue using DriveBook, your payment method will be charged automatically.</p>
        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/subscription">Manage Subscription</a></p>
      `,
    });
  }
}

async function handlePaymentSucceeded(invoice: any) {
  const { subscription, customer } = invoice;

  if (!subscription) return;

  // Payment succeeded - subscription is active
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription },
    data: {
      status: 'ACTIVE',
    },
  });
}

async function handlePaymentFailed(invoice: any) {
  const { subscription, customer } = invoice;

  if (!subscription) return;

  // Payment failed - mark as past due
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription },
    data: {
      status: 'PAST_DUE',
    },
  });

  await prisma.instructor.updateMany({
    where: { stripeSubscriptionId: subscription },
    data: {
      subscriptionStatus: 'PAST_DUE',
    },
  });

  // Send payment failed email
  const instructor = await prisma.instructor.findFirst({
    where: { stripeSubscriptionId: subscription },
    include: { user: true },
  });

  if (instructor) {
    await emailService.sendGenericEmail({
      to: instructor.user.email,
      subject: 'Payment Failed',
      html: `
        <h2>Payment Failed</h2>
        <p>We were unable to process your payment.</p>
        <p>Please update your payment method to continue using DriveBook.</p>
        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/subscription">Update Payment Method</a></p>
      `,
    });
  }
}
