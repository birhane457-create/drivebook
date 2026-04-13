import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getTrialEndDate, calculateCommission } from '@/lib/config/subscriptions';


export const dynamic = 'force-dynamic';
// GET - Get current subscription details
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        instructor: {
          select: {
            id: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            customDomain: true,
            brandedBookingPage: true,
            maxInstructors: true,
          },
        },
      },
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Derive commission/bonus from config — not stored in DB
    const plan = SUBSCRIPTION_PLANS[user.instructor.subscriptionTier as keyof typeof SUBSCRIPTION_PLANS];

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        instructorId: user.instructor.id,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      current: {
        tier: user.instructor.subscriptionTier,
        status: user.instructor.subscriptionStatus,
        commissionRate: plan.commissionRate,
        newStudentBonus: plan.newStudentBonus,
        trialEndsAt: user.instructor.trialEndsAt,
        customDomain: user.instructor.customDomain,
        brandedBookingPage: user.instructor.brandedBookingPage,
        maxInstructors: user.instructor.maxInstructors,
        subscription: subscription ? {
          id: subscription.id,
          monthlyAmount: subscription.monthlyAmount,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEndsAt: subscription.trialEndsAt ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        } : null,
      },
      plans: SUBSCRIPTION_PLANS,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// POST - Create or update subscription
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tier, billingCycle = 'monthly' } = body;

    if (!tier || !['BASIC', 'PRO', 'STUDIO', 'BUSINESS'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true },
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];

    // Check if subscription exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        instructorId: user.instructor.id,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
    });

    // If user is on trial and clicking their current plan, create checkout to add payment
    if (existingSubscription && 
        existingSubscription.status === 'TRIAL' && 
        existingSubscription.tier === tier &&
        !existingSubscription.stripeSubscriptionId) {
      
      // Import Stripe
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
      });

      // Get price ID from config
      const { getStripePriceId } = require('@/lib/config/subscriptions');
      const priceId = getStripePriceId(tier as any, billingCycle);

      // Create checkout session to add payment method
      const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: user.email,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true&payment_added=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?cancelled=true`,
        metadata: {
          instructorId: user.instructor.id,
          tier,
          billingCycle,
        },
        subscription_data: {
          // Don't set trial_period_days - let it start billing immediately
          metadata: {
            instructorId: user.instructor.id,
            tier,
          },
        },
      });

      return NextResponse.json({
        success: true,
        checkoutUrl: checkoutSession.url,
        message: 'Redirecting to payment setup...'
      });
    }

    // Otherwise, create/update trial subscription (no payment required yet)
    const amount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    let subscription;
    if (existingSubscription) {
      // Changing tier mid-trial — keep the ORIGINAL trial end date, never reset it.
      // The instructor gets one trial across all tiers, not a fresh trial per tier change.
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          tier: tier as any,
          monthlyAmount: amount,
          billingCycle,
          currentPeriodEnd: periodEnd,
          // trialEndsAt intentionally NOT updated — preserve original trial window
        },
      });

      // Update instructor tier but keep existing trialEndsAt
      await prisma.instructor.update({
        where: { id: user.instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: subscription.status as any,
          maxInstructors: plan.limits.instructors,
          // trialEndsAt intentionally NOT updated
        },
      });

      const daysLeft = existingSubscription.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(existingSubscription.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      return NextResponse.json({
        success: true,
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          monthlyAmount: subscription.monthlyAmount,
          billingCycle: subscription.billingCycle,
          trialEndsAt: existingSubscription.trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        message: daysLeft > 0
          ? `Switched to ${plan.name} plan — ${daysLeft} trial day${daysLeft !== 1 ? 's' : ''} remaining`
          : `Switched to ${plan.name} plan`,
      });
    } else {
      // First-ever subscription — start fresh trial
      const trialEnd = getTrialEndDate(tier as any);
      subscription = await prisma.subscription.create({
        data: {
          instructorId: user.instructor.id,
          tier,
          status: 'TRIAL',
          monthlyAmount: amount,
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: trialEnd,
        },
      });

      await prisma.instructor.update({
        where: { id: user.instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: trialEnd,
          maxInstructors: plan.limits.instructors,
        },
      });

      return NextResponse.json({
        success: true,
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          monthlyAmount: subscription.monthlyAmount,
          billingCycle: subscription.billingCycle,
          trialEndsAt: subscription.trialEndsAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        message: `Started ${plan.trialDays}-day free trial of ${plan.name} plan`,
      });
    }
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel subscription
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true },
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Find active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        instructorId: user.instructor.id,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Mark for cancellation at period end
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      endsAt: subscription.currentPeriodEnd,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
