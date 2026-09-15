import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getTrialEndDate } from '@/lib/config/subscriptions';
import { cancelSubscription } from '@/lib/services/subscription-cancel';


export const dynamic = 'force-dynamic';
// GET - Get current subscription details
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: {
        provider: {
          select: {
            id: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            customDomain: true,
            brandedBookingPage: true,
            maxProviders: true,
          },
        },
      },
    });

    if (!user?.provider) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Derive commission/bonus from config — not stored in DB
    const plan = SUBSCRIPTION_PLANS[user.provider?.subscriptionTier as keyof typeof SUBSCRIPTION_PLANS];

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        providerId: user.provider?.id,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      current: {
        tier: user.provider?.subscriptionTier,
        status: user.provider?.subscriptionStatus,
        commissionRate: plan.commissionRate,
        trialEndsAt: user.provider?.trialEndsAt,
        customDomain: user.provider?.customDomain,
        brandedBookingPage: user.provider?.brandedBookingPage,
        maxProviders: user.provider?.maxProviders,
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

    if (!tier || !['BASIC', 'PRO', 'STUDIO', 'PREMIUM'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: { provider: true },
    });

    if (!user?.provider) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];

    // Check if subscription exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        providerId: user.provider?.id,
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

      // Get or create Stripe customer — use existing customer ID to prevent duplicates on retry
      let customerId = user.provider?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.provider?.name || user.name || undefined,
          metadata: { providerId: user.provider?.id },
        });
        customerId = customer.id;
        await prisma.provider.update({
          where: { id: user.provider?.id },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create checkout session to add payment method
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,          // ← use customer ID, NOT customer_email
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true&payment_added=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?cancelled=true`,
        metadata: {
          providerId: user.provider?.id,
          tier,
          billingCycle,
        },
        subscription_data: {
          metadata: {
            providerId: user.provider?.id,
            tier,
            billingCycle,
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
      //
      // SUB-02-A FIX: Both writes are inside a single $transaction so a failure between
      // them cannot leave Subscription and Provider in inconsistent states.
      subscription = await prisma.$transaction(async (tx) => {
        const updatedSub = await tx.subscription.update({
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
        await tx.provider.update({
          where: { id: user.provider?.id },
          data: {
            subscriptionTier: tier as any,
            subscriptionStatus: updatedSub.status as any,
            maxProviders: plan.limits.providers,
            // trialEndsAt intentionally NOT updated
          },
        });

        return updatedSub;
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
      // First-ever subscription — start fresh trial.
      //
      // SUB-02-A FIX: Both writes are inside a single $transaction.
      // SUB-02-B FIX: Re-check inside the transaction that no concurrent request
      // already created a subscription. If one is found (race), return it directly
      // without creating a duplicate.
      const trialEnd = getTrialEndDate(tier as any);

      // Read stripeCustomerId before entering transaction (read-only, no locking needed).
      const provider = await prisma.provider.findUnique({
        where: { id: user.provider?.id },
        select: { stripeCustomerId: true },
      });

      const result = await prisma.$transaction(async (tx) => {
        // SUB-02-B: Re-check for an existing subscription INSIDE the transaction.
        // With SERIALIZABLE isolation any concurrent transaction that reads the same
        // absent row will either retry or get a serialization error, ensuring exactly
        // one row is created.
        const raceCheck = await tx.subscription.findFirst({
          where: {
            providerId: user.provider!.id,
            status: { in: ['TRIAL', 'ACTIVE'] },
          },
        });

        if (raceCheck) {
          // A concurrent request already created the subscription — return it.
          return { existing: raceCheck };
        }

        // F-13 FIX: Copy Provider's stripeCustomerId into Subscription row for
        // authoritative webhook-to-trial correlation.
        const newSub = await tx.subscription.create({
          data: {
            providerId: user.provider!.id,
            tier,
            status: 'TRIAL',
            monthlyAmount: amount,
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt: trialEnd,
            stripeCustomerId: provider?.stripeCustomerId || null,
          },
        });

        await tx.provider.update({
          where: { id: user.provider!.id },
          data: {
            subscriptionTier: tier as any,
            subscriptionStatus: 'TRIAL',
            trialEndsAt: trialEnd,
            maxProviders: plan.limits.providers,
          },
        });

        return { created: newSub };
      }, {
        isolationLevel: 'Serializable',
      });

      const subscription = 'existing' in result ? result.existing : result.created;

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
      where: { email: session!.user!.email },
      include: { provider: true },
    });

    if (!user?.provider) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // SUB-09-A FIX: Delegate to the authoritative cancellation service.
    // The service calls Stripe first (when a Stripe subscription ID exists) and only
    // updates the local DB after Stripe confirms cancellation. If Stripe fails, this
    // throws and the local row is left unchanged — the caller receives a 502 so the
    // user knows the cancellation did not go through rather than seeing a false success.
    const result = await cancelSubscription({
      providerId: user.provider.id,
      mode: 'period_end',
      actorEmail: session!.user!.email,
      reason: 'Instructor-initiated cancellation via dashboard',
    });

    if (result.stripeAction === 'already_cancelled') {
      return NextResponse.json({
        success: true,
        message: result.message,
        endsAt: result.endsAt,
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      endsAt: result.endsAt,
    });
  } catch (error: any) {
    // Stripe failure — surface as 502 so the client knows Stripe was not cancelled.
    // Do NOT return 200 or silently swallow this: the instructor would believe they
    // cancelled while Stripe continues billing (the original SUB-09-A defect).
    console.error('Subscription cancellation error:', error);
    const isStripeError = error?.type?.startsWith('Stripe') || error?.raw?.type;
    return NextResponse.json(
      {
        error: isStripeError
          ? 'Could not cancel with Stripe. Your subscription has not been cancelled — please try again or contact support.'
          : 'Failed to cancel subscription',
      },
      { status: isStripeError ? 502 : 500 },
    );
  }
}
