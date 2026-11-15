// @ts-nocheck
/**
 * Stripe Billing Portal â€” for active subscribers to manage their plan
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
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/utils/appUrl';
import { getStripePriceId } from '@/lib/config/subscriptions';

// Module-level Stripe instance — not re-instantiated per request
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' as any })
  : null;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { return_url, targetTier } = await req.json().catch(() => ({}));

    // Validate return_url if supplied — must be same origin to prevent open redirect.
    // If absent or invalid, fall back to the canonical app URL.
    const appUrl = getAppUrl();
    let validatedReturnUrl: string;
    if (return_url && typeof return_url === 'string') {
      try {
        const supplied = new URL(return_url);
        const canonical = new URL(appUrl);
        // Accept only same origin (scheme + host + port must match)
        validatedReturnUrl = supplied.origin === canonical.origin
          ? return_url
          : `${appUrl}/dashboard/subscription`;
      } catch {
        validatedReturnUrl = `${appUrl}/dashboard/subscription`;
      }
    } else {
      validatedReturnUrl = `${appUrl}/dashboard/subscription`;
    }

    // Append portal_return=true so the subscription page knows to sync from Stripe
    const returnUrl = validatedReturnUrl.includes('?')
      ? `${validatedReturnUrl}&portal_return=true`
      : `${validatedReturnUrl}?portal_return=true`;

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: {
        provider: {
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

    if (!user?.provider) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
    }

    const activeSubscription = user.provider?.subscriptions[0];

    // Case 1: Has an active Stripe subscription â€” open the Billing Portal
    if (activeSubscription?.stripeSubscriptionId) {
      // Get or create Stripe customer
      let customerId = user.provider?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.provider?.name,
          metadata: { providerId: user.provider?.id },
        });
        customerId = customer.id;
        await prisma.provider.update({
          where: { id: user.provider?.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return NextResponse.json({ url: portalSession.url });
    }

    // Case 2: On trial with no Stripe subscription â€” create Checkout to add payment
    // Uses targetTier if provided (upgrade flow), otherwise current tier
    const tier = (targetTier && ['BASIC','PRO','STUDIO','PREMIUM'].includes(targetTier))
      ? targetTier
      : (user.provider?.subscriptionTier || 'BASIC');
    const priceId = getStripePriceId(tier, 'monthly');

    // Get or create Stripe customer
    let customerId = user.provider?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.provider?.name,
        metadata: { providerId: user.provider?.id },
      });
      customerId = customer.id;
      await prisma.provider.update({
        where: { id: user.provider?.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Calculate remaining trial days to pass to Stripe
    const trialEndsAt = user.provider?.trialEndsAt;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${getAppUrl()}/dashboard/subscription?success=true&payment_added=true`,
      cancel_url: returnUrl,
      metadata: {
        providerId: user.provider?.id,
        tier,
        billingCycle: 'monthly',
      },
      subscription_data: {
        // Preserve remaining trial days â€” don't charge until trial ends
        ...(trialDaysLeft > 0 && { trial_period_days: trialDaysLeft }),
        metadata: { providerId: user.provider?.id, tier },
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
