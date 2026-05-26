/**
 * Stripe Billing Portal — for active subscribers to manage their plan
 * 
 * For active subscribers: opens Stripe's hosted billing portal where they can:
 * - Upgrade/downgrade plan (Stripe handles proration automatically)
 * - Update payment method
 * - View invoice history
 * - Cancel subscription
 * 
 * For trial subscribers with no Stripe subscription yet: creates a Checkout
 * session to add a payment method and activate the subscription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { return_url } = await req.json().catch(() => ({}));
    // Append portal_return=true so the subscription page knows to sync from Stripe
    const baseReturnUrl = return_url || `${process.env.NEXTAUTH_URL}/dashboard/subscription`;
    const returnUrl = baseReturnUrl.includes('?')
      ? `${baseReturnUrl}&portal_return=true`
      : `${baseReturnUrl}?portal_return=true`;

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

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });

    const activeSubscription = user.instructor.subscriptions[0];

    // Case 1: Has an active Stripe subscription — open the Billing Portal
    if (activeSubscription?.stripeSubscriptionId) {
      // Get or create Stripe customer
      let customerId = user.instructor.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.instructor.name,
          metadata: { instructorId: user.instructor.id },
        });
        customerId = customer.id;
        await prisma.instructor.update({
          where: { id: user.instructor.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return NextResponse.json({ url: portalSession.url });
    }

    // Case 2: On trial with no Stripe subscription — create Checkout to add payment
    // This activates the subscription at the current tier
    const tier = user.instructor.subscriptionTier || 'BASIC';
    const { getStripePriceId } = require('@/lib/config/subscriptions');
    const priceId = getStripePriceId(tier, 'monthly');

    // Get or create Stripe customer
    let customerId = user.instructor.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.instructor.name,
        metadata: { instructorId: user.instructor.id },
      });
      customerId = customer.id;
      await prisma.instructor.update({
        where: { id: user.instructor.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Calculate remaining trial days to pass to Stripe
    const trialEndsAt = user.instructor.trialEndsAt;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true&payment_added=true`,
      cancel_url: returnUrl,
      metadata: {
        instructorId: user.instructor.id,
        tier,
        billingCycle: 'monthly',
      },
      subscription_data: {
        // Preserve remaining trial days — don't charge until trial ends
        ...(trialDaysLeft > 0 && { trial_period_days: trialDaysLeft }),
        metadata: { instructorId: user.instructor.id, tier },
      },
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error: any) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
