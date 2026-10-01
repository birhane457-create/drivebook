// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getTrialEndDate, getStripePriceId } from '@/lib/config/subscriptions';
import { cancelSubscription } from '@/lib/services/subscription-cancel';
import { createOrReuseTrialSubscription } from '@/lib/services/subscription-lifecycle';


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

    // Derive commission/bonus from config â€” not stored in DB
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
        status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
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
      const priceId = getStripePriceId(tier as any, billingCycle);

      // Get or create Stripe customer â€” use existing customer ID to prevent duplicates on retry
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
        customer: customerId,          // â† use customer ID, NOT customer_email
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

    if (existingSubscription) {
      // C-1 FIX: Block tier changes for non-TRIAL subscriptions.
      //
      // TRIAL tier changes are intentionally free â€” the instructor explores tiers
      // within their single trial window without resetting the trial end date.
      // (See: platform-model.md, code comment below.)
      //
      // ACTIVE and PAST_DUE subscriptions already have a Stripe billing relationship.
      // Changing tier locally without a corresponding Stripe operation would:
      //   - reduce the commission rate immediately (e.g. 15% â†’ 10%)
      //   - grant higher-tier features
      //   - without the platform receiving the higher subscription fee
      //
      // All non-TRIAL tier changes must go through the Stripe Billing Portal so
      // the subscription price change is recorded in Stripe before taking effect locally.
      if (existingSubscription.status !== 'TRIAL' && existingSubscription.tier !== tier) {
        return NextResponse.json(
          {
            error: 'To change your subscription plan, please use the billing portal.',
            code:  'USE_BILLING_PORTAL',
            redirect: '/dashboard/subscription',
          },
          { status: 403 },
        );
      }

      // Changing tier mid-trial â€” keep the ORIGINAL trial end date, never reset it.
      // The instructor gets one trial across all tiers, not a fresh trial per tier change.
      //
      // SUB-06-A Writer #3 FIX: Provider-first locking architecture (Rev7).
      // Apply the same locking order used by webhook handlers to prevent race conditions
      // where concurrent webhooks or API operations could create inconsistent state.
      //
      // CRITICAL: Uses actual PostgreSQL SELECT...FOR UPDATE row locks via $queryRaw.
      //
      // Locking order:
      // 1. Provider FOR UPDATE (establishes ownership lock) - ACTUAL ROW LOCK
      // 2. Current/eligible subscriptions FOR UPDATE - ACTUAL ROW LOCK
      // 3. Re-read after locks to get fresh state
      // 4. Ownership validation (subscription belongs to this provider)
      // 5. 0/1/>1 invariant check (exactly one TRIAL/ACTIVE subscription)
      // 6. Mutation (update both subscription and provider)
      const subscription = await prisma.$transaction(async (tx) => {
        // Step 1: Lock Provider FOR UPDATE using actual PostgreSQL row lock
        const providersRaw = await tx.$queryRaw<any[]>`
          SELECT * FROM "Provider"
          WHERE "id" = ${user.provider!.id}
          FOR UPDATE
        `;

        if (providersRaw.length === 0) {
          throw new Error('Provider not found');
        }

        // Re-read locked Provider to get authoritative post-lock state
        const lockedProvider = await tx.provider.findUnique({
          where: { id: providersRaw[0].id },
        });

        if (!lockedProvider) {
          throw new Error('Provider disappeared after lock');
        }

        // Step 2: Lock ALL current/eligible subscriptions FOR UPDATE using actual PostgreSQL row lock
        // CRITICAL: This establishes the Provider's subscription ownership boundary
        const currentSubscriptionsRaw = await tx.$queryRaw<any[]>`
          SELECT * FROM "Subscription"
          WHERE "providerId" = ${lockedProvider.id}
            AND "status" != 'CANCELLED'
          FOR UPDATE
        `;

        // Re-read locked subscriptions to get authoritative post-lock state
        const currentSubscriptions = await Promise.all(
          currentSubscriptionsRaw.map(sub =>
            tx.subscription.findUnique({ where: { id: sub.id } })
          )
        );

        const validCurrentSubscriptions = currentSubscriptions.filter((sub): sub is NonNullable<typeof sub> => sub !== null);

        // Step 3: 0/1/>1 invariant check (CRITICAL)
        if (validCurrentSubscriptions.length === 0) {
          throw new Error('No current/eligible subscription found after lock');
        }
        if (validCurrentSubscriptions.length > 1) {
          throw new Error(`INVARIANT VIOLATION: Provider has ${validCurrentSubscriptions.length} current subscriptions (expected 1)`);
        }

        const lockedSubscription = validCurrentSubscriptions[0];

        // Step 4: Ownership validation (defensive check)
        if (lockedSubscription.providerId !== lockedProvider.id) {
          throw new Error('Subscription ownership mismatch');
        }

        // Step 5: Verify this is the subscription we expected to modify
        if (lockedSubscription.id !== existingSubscription.id) {
          throw new Error('Subscription identity mismatch - concurrent change detected');
        }

        // Step 6: Mutation - Update subscription then provider
        const updatedSub = await tx.subscription.update({
          where: { id: lockedSubscription.id },
          data: {
            tier: tier as any,
            monthlyAmount: amount,
            billingCycle,
            currentPeriodEnd: periodEnd,
            // trialEndsAt intentionally NOT updated â€” preserve original trial window
          },
        });

        // Update provider to match subscription state
        await tx.provider.update({
          where: { id: lockedProvider.id },
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
          ? `Switched to ${plan.name} plan â€” ${daysLeft} trial day${daysLeft !== 1 ? 's' : ''} remaining`
          : `Switched to ${plan.name} plan`,
      });
    } else {
      // SUB-06-A Writer #4: First-ever subscription â€” use lifecycle helper
      // This implements Provider-first locking (Provider FOR UPDATE â†’ subscription FOR UPDATE)
      const subscription = await prisma.$transaction(async (tx) => {
        const sub = await createOrReuseTrialSubscription(tx, user.provider!.id);
        
        // Sync Provider state with subscription (helper locks but doesn't update Provider)
        await tx.provider.update({
          where: { id: user.provider!.id },
          data: {
            subscriptionTier: sub.tier,
            subscriptionStatus: sub.status,
            trialEndsAt: sub.trialEndsAt,
          },
        });
        
        return sub;
      }, {
        isolationLevel: 'Serializable',
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
      where: { email: session!.user!.email },
      include: { provider: true },
    });

    if (!user?.provider) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // SUB-09-A FIX: Delegate to the authoritative cancellation service.
    // The service calls Stripe first (when a Stripe subscription ID exists) and only
    // updates the local DB after Stripe confirms cancellation. If Stripe fails, this
    // throws and the local row is left unchanged â€” the caller receives a 502 so the
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
    // Stripe failure â€” surface as 502 so the client knows Stripe was not cancelled.
    // Do NOT return 200 or silently swallow this: the instructor would believe they
    // cancelled while Stripe continues billing (the original SUB-09-A defect).
    console.error('Subscription cancellation error:', error);
    const isStripeError = error?.type?.startsWith('Stripe') || error?.raw?.type;
    return NextResponse.json(
      {
        error: isStripeError
          ? 'Could not cancel with Stripe. Your subscription has not been cancelled â€” please try again or contact support.'
          : 'Failed to cancel subscription',
      },
      { status: isStripeError ? 502 : 500 },
    );
  }
}
