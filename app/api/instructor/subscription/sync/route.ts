/**
 * POST /api/instructor/subscription/sync
 *
 * Syncs the instructor's Stripe subscription state back to our DB.
 * Called after returning from the Stripe Billing Portal to ensure
 * any plan changes (upgrade/downgrade) are reflected immediately —
 * without waiting for the webhook to arrive.
 *
 * This is a safety net: the webhook is the source of truth, but it
 * can arrive seconds after the instructor lands back on the page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        instructor: {
          include: {
            subscriptions: {
              where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const instructor = user.instructor;
    const activeSubscription = instructor.subscriptions[0];

    // Nothing to sync if no Stripe subscription exists
    if (!activeSubscription?.stripeSubscriptionId) {
      return NextResponse.json({ synced: false, reason: 'No Stripe subscription to sync' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });

    // Fetch live subscription from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(
      activeSubscription.stripeSubscriptionId,
      { expand: ['items.data.price'] }
    );

    // Derive tier from price ID
    const priceId = stripeSub.items?.data?.[0]?.price?.id;
    const priceToTier: Record<string, string> = {
      [process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || '']: 'BASIC',
      [process.env.STRIPE_BASIC_ANNUAL_PRICE_ID || '']: 'BASIC',
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
      [process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '']: 'PRO',
      [process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID || '']: 'STUDIO',
      [process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID || '']: 'STUDIO',
      [process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '']: 'BUSINESS',
      [process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || '']: 'BUSINESS',
    };

    // Fall back to metadata tier if price ID not in map (e.g. env vars not set)
    const tier = (priceId && priceToTier[priceId]) || stripeSub.metadata?.tier || instructor.subscriptionTier;

    if (!tier || !SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json({ synced: false, reason: `Could not determine tier from price ID: ${priceId}` });
    }

    const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];

    // Normalize Stripe status
    const normalizeStatus = (s: string): string => {
      const upper = s.toUpperCase();
      return upper === 'CANCELED' ? 'CANCELLED' : upper;
    };

    const stripeStatus = normalizeStatus(stripeSub.status);
    const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
    const currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
    const trialEnd = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null;
    const monthlyAmount = stripeSub.items.data[0].price.unit_amount! / 100;
    const billingCycle = stripeSub.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly';
    const cancelAtPeriodEnd = stripeSub.cancel_at_period_end ?? false;

    // Check if anything actually changed
    const tierChanged = instructor.subscriptionTier !== tier;
    const statusChanged = instructor.subscriptionStatus !== stripeStatus;

    await prisma.$transaction(async (tx) => {
      // Update instructor record
      await tx.instructor.update({
        where: { id: instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: stripeStatus as any,
          trialEndsAt: trialEnd,
          maxInstructors: plan.limits.instructors,
        } as any,
      });

      // Update subscription record
      await tx.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          tier: tier as any,
          status: stripeStatus as any,
          monthlyAmount,
          billingCycle,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
        },
      });
    });

    console.log(`✅ Subscription synced for instructor ${instructor.id}: tier=${tier}, status=${stripeStatus}${tierChanged ? ' (tier changed)' : ''}${statusChanged ? ' (status changed)' : ''}`);

    return NextResponse.json({
      synced: true,
      tier,
      status: stripeStatus,
      tierChanged,
      statusChanged,
      monthlyAmount,
      billingCycle,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd,
    });
  } catch (error: any) {
    console.error('Subscription sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
