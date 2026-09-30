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
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const instructor = (user as any).provider;
    const activeSubscription = instructor.subscriptions[0];

    // Nothing to sync if no Stripe subscription exists
    if (!activeSubscription?.stripeSubscriptionId) {
      return NextResponse.json({ synced: false, reason: 'No Stripe subscription to sync' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover' as any,
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
      [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '']: 'PREMIUM',
      [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID || '']: 'PREMIUM',
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

    /**
     * SUB-06-A Rev7: Provider-first FOR UPDATE locking with full current-subscription inventory
     *
     * Race condition: This sync runs concurrently with webhook handlers processing
     * subscription.updated / subscription.deleted events from Stripe.
     *
     * Locking order (Rev7):
     * 1. Provider SELECT ... FOR UPDATE (lockProvider — $queryRaw)
     * 2. ALL current/eligible subscriptions FOR UPDATE (WHERE status != 'CANCELLED')
     * 3. Post-lock re-read of each locked subscription (authoritative state)
     * 4. 0/1/>1 invariant check — fail closed if >1 current subscription
     * 5. Identify target subscription from post-lock set (not pre-tx snapshot)
     * 6. Ownership validation
     * 7. Mutations (Provider + Subscription)
     *
     * Why full inventory lock matters:
     * The pre-transaction activeSubscription snapshot was read before the Stripe
     * API call. A concurrent webhook could have mutated it during that window.
     * Locking the full current set under the Provider lock ensures the lifecycle
     * decision is made against authoritative state.
     *
     * Stripe API call intentionally OUTSIDE transaction (no long-held locks during
     * external HTTP calls).
     */
    const { lockProvider } = await import('@/lib/services/subscription-lifecycle');

    // SUB-06-A Rev7: Provider-first locking with full current-subscription inventory
    const txResult = await prisma.$transaction(async (tx) => {
      // Step 1: Lock Provider FOR UPDATE (actual PostgreSQL row lock via $queryRaw)
      const lockedProvider = await lockProvider(tx, instructor.id);

      if (!lockedProvider) {
        throw new Error('Provider not found during sync');
      }

      // Step 2: Lock ALL current/eligible subscriptions FOR UPDATE (Rev7: full inventory)
      // CRITICAL: Must lock the complete set, not just the pre-transaction snapshot.
      // The pre-transaction activeSubscription read can become stale while Stripe is queried.
      const currentSubscriptionsRaw = await tx.$queryRaw<any[]>`
        SELECT * FROM "Subscription"
        WHERE "providerId" = ${lockedProvider.id}
          AND "status" != 'CANCELLED'
        FOR UPDATE
      `;

      // Post-lock re-read to get authoritative state after lock acquired
      const currentSubscriptions = (await Promise.all(
        currentSubscriptionsRaw.map(s => tx.subscription.findUnique({ where: { id: s.id } }))
      )).filter((s): s is NonNullable<typeof s> => s !== null);

      // Step 3: 0/1/>1 invariant (fail-closed on multiple current subscriptions)
      if (currentSubscriptions.length > 1) {
        throw new Error(
          `INVARIANT VIOLATION: Provider ${lockedProvider.id} has ${currentSubscriptions.length} current subscriptions — failing closed`
        );
      }

      // Step 4: Exact Stripe subscription identity match (TOCTOU guard)
      // CRITICAL: The Stripe state fetched above belongs to activeSubscription.stripeSubscriptionId.
      // A concurrent lifecycle operation (webhook, cancellation, migration) may have changed the
      // Provider's current subscription from A → B between the Stripe fetch and this lock.
      // Applying A's Stripe state to B is incorrect — B has a different identity.
      // If A is absent from the post-lock set, do NOT fall back to B. Return a reconciliation
      // result so the caller can re-sync after the concurrent operation settles.
      const lockedSubscription = currentSubscriptions.find(
        s => (s as any).stripeSubscriptionId === activeSubscription.stripeSubscriptionId
      ) ?? null;

      if (!lockedSubscription) {
        // The subscription this Stripe fetch was for is no longer the current subscription
        // under lock. Do not mutate. Surface a reconciliation result.
        return NextResponse.json({
          synced: false,
          reason: 'subscription_replaced_during_sync',
          detail: `Stripe subscription ${activeSubscription.stripeSubscriptionId} is no longer the current subscription for this provider — a concurrent operation changed it. Retry to sync the new current subscription.`,
        });
      }

      // Step 5: Ownership validation
      if (lockedSubscription.providerId !== lockedProvider.id) {
        throw new Error('Subscription ownership mismatch during sync');
      }

      // Step 6: Mutate Provider (already locked)
      await tx.provider.update({
        where: { id: instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: stripeStatus as any,
          trialEndsAt: trialEnd,
          maxProviders: plan.limits.providers,
        } as any,
      });

      // Step 7: Mutate Subscription (already locked)
      await tx.subscription.update({
        where: { id: lockedSubscription.id },
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

      // Return null to signal normal completion (no early reconciliation exit)
      return null;
    });

    // If the transaction returned a NextResponse (TOCTOU reconciliation path), surface it
    if (txResult !== null && txResult !== undefined) {
      return txResult as NextResponse;
    }

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
