/**
 * SUB-06-A: Provider/Subscription Lifecycle Identity Remediation
 * 
 * Implements Rev 7 design (commit 85f8571d) with:
 * - Universal locking order (Provider → Subscription)
 * - Provider↔Subscription ownership invariant enforcement
 * - Event watermark monotonicity
 * - INV-2 cancellation semantics with manual reactivation exception
 * 
 * CRITICAL ARCHITECTURE:
 * All Stripe API I/O MUST occur BEFORE entering database transaction.
 * Transaction flow: LOCK → RE-READ → DECIDE → MUTATE
 */

import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

// Type for Prisma transaction client
type PrismaTransaction = Prisma.TransactionClient;

// Subscription states
type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID';

/**
 * Result of processSubscriptionEvent
 */
export interface SubscriptionEventResult {
  allowed: boolean;
  reason: string;
  subscriptionId?: string;
}

/**
 * Lock Provider with FOR UPDATE (universal Writer-7 locking primitive)
 * 
 * All writers (registration, webhook, manual sync, etc.) MUST acquire
 * the Provider lock first to serialize access to the subscription lifecycle.
 * 
 * @param tx - Prisma transaction client
 * @param providerId - Provider ID to lock (when known)
 * @param stripeCustomerId - Stripe customer ID to lock (when Provider ID not yet known)
 * @returns Locked and re-read Provider
 */
export async function lockProvider(
  tx: PrismaTransaction,
  providerId?: string,
  stripeCustomerId?: string
): Promise<any> {
  if (!providerId && !stripeCustomerId) {
    throw new Error('Either providerId or stripeCustomerId must be provided');
  }

  let providers: any[];

  if (providerId) {
    // Lock by Provider ID (registration path)
    providers = await tx.$queryRaw<any[]>`
      SELECT * FROM "Provider"
      WHERE "id" = ${providerId}
      FOR UPDATE
    `;
  } else {
    // Lock by Stripe customer ID (webhook path)
    providers = await tx.$queryRaw<any[]>`
      SELECT * FROM "Provider"
      WHERE "stripeCustomerId" = ${stripeCustomerId}
      FOR UPDATE
    `;
  }

  if (providers.length === 0) {
    throw new Error(
      `Provider not found for ${providerId ? `id: ${providerId}` : `stripeCustomerId: ${stripeCustomerId}`}`
    );
  }

  const provider = providers[0];

  // Re-read locked Provider to get authoritative post-lock state
  const lockedProvider = await tx.provider.findUnique({
    where: { id: provider.id },
  });

  if (!lockedProvider) {
    throw new Error(`Provider disappeared after lock: ${provider.id}`);
  }

  return lockedProvider;
}

/**
 * Step 1: Lock Provider and Subscription in universal order
 * 
 * CRITICAL: Uses pre-resolved stripeCustomerId (no Stripe API inside transaction)
 * 
 * Locking order (universal across all writers):
 * 1. Provider (by stripeCustomerId) - SELECT ... FOR UPDATE
 * 2. Subscription (by stripeSubscriptionId) - SELECT ... FOR UPDATE
 * 
 * Returns locked rows for post-lock policy decisions.
 * 
 * Uses $queryRaw to execute explicit PostgreSQL FOR UPDATE row locks.
 */
export async function lockProviderAndSubscription(
  tx: PrismaTransaction,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<{
  provider: any;
  subscription: any | null;
}> {
  // Lock Provider first with lockProvider helper
  const provider = await lockProvider(tx, undefined, stripeCustomerId);

  // Lock Subscription second with FOR UPDATE (if exists)
  // Universal locking order prevents deadlocks
  const subscriptions = await tx.$queryRaw<any[]>`
    SELECT * FROM "Subscription"
    WHERE "stripeSubscriptionId" = ${stripeSubscriptionId}
    FOR UPDATE
  `;

  const subscription = subscriptions.length > 0 ? subscriptions[0] : null;

  // Re-read locked Subscription to get authoritative post-lock state
  const lockedSubscription = subscription
    ? await tx.subscription.findUnique({
        where: { id: subscription.id },
      })
    : null;

  return { provider, subscription: lockedSubscription };
}

/**
 * Step 2: Validate Subscription Identity (INV-6)
 * 
 * After locking, verify exact identity match between locked row and incoming event.
 */
export function validateSubscriptionIdentity(
  lockedSubscription: any | null,
  incomingStripeSubscriptionId: string
): { valid: boolean; reason?: string } {
  if (!lockedSubscription) {
    // New subscription (no existing row), identity implicitly valid
    return { valid: true };
  }

  // Verify exact match
  if (lockedSubscription.stripeSubscriptionId !== incomingStripeSubscriptionId) {
    return {
      valid: false,
      reason: 'subscription-id-mismatch',
    };
  }

  return { valid: true };
}

/**
 * Step 2.5: Validate Provider↔Subscription Ownership Invariant (CRITICAL)
 * 
 * For existing subscriptions: lockedSubscription.providerId === lockedProvider.id
 * For new subscriptions: ownership established at creation time
 * 
 * FAIL CLOSED on mismatch - indicates database inconsistency.
 */
export function validateProviderSubscriptionOwnership(
  lockedProvider: any,
  lockedSubscription: any | null
): { valid: boolean; reason?: string } {
  if (!lockedSubscription) {
    // New subscription (will be created), ownership established in creation path
    return { valid: true };
  }

  // CRITICAL: Verify Provider owns Subscription
  if (lockedSubscription.providerId !== lockedProvider.id) {
    return {
      valid: false,
      reason: 'provider-subscription-ownership-mismatch',
    };
  }

  return { valid: true };
}

/**
 * Step 3: Policy Decision - Can Transition Subscription State?
 * 
 * Implements:
 * - INV-2: Webhook cancellation semantics (reject non-CANCELLED events after CANCELLED)
 * - INV-3: Watermark monotonicity (reject events older than current watermark)
 * - INV-5: Equal-timestamp ambiguity handling
 * 
 * Uses POST-LOCK state for all decisions.
 */
export async function canTransitionSubscriptionState(
  event: Stripe.Event,
  stripeSub: Stripe.Subscription,
  lockedSubscription: any | null
): Promise<{ allowed: boolean; reason: string }> {
  const incomingStatus = normalizeStripeStatus(stripeSub.status);
  const incomingTimestamp = event.created;

  // New subscription - always allowed
  if (!lockedSubscription) {
    return { allowed: true, reason: 'new-subscription' };
  }

  // INV-2: Webhook cancellation semantics
  // Once CANCELLED by webhook, reject all subsequent non-CANCELLED events
  // (Manual reconciliation is handled separately and exempt from this rule)
  if (lockedSubscription.status === 'CANCELLED' && incomingStatus !== 'CANCELLED') {
    return {
      allowed: false,
      reason: 'inv-2-cancelled-lifecycle-cannot-reactivate-via-webhook',
    };
  }

  // INV-3: Watermark monotonicity - reject events older than current watermark
  const currentWatermark = lockedSubscription.lastWebhookEventTimestamp;
  
  if (currentWatermark !== null && currentWatermark !== undefined) {
    if (incomingTimestamp < currentWatermark) {
      return {
        allowed: false,
        reason: 'inv-3-event-older-than-watermark',
      };
    }

    // INV-5: Equal-timestamp ambiguity
    // Events with same timestamp are ambiguous - preserve in event history but don't mutate
    if (incomingTimestamp === currentWatermark) {
      logger.warn('Equal-timestamp webhook event - preserving in history but not mutating state', {
        stripeSubscriptionId: stripeSub.id,
        eventId: event.id,
        timestamp: incomingTimestamp,
        currentEventId: lockedSubscription.lastWebhookEventId,
      });

      return {
        allowed: false,
        reason: 'inv-5-equal-timestamp-ambiguous',
      };
    }
  }

  // Event is newer - allowed
  return { allowed: true, reason: 'event-newer-than-watermark' };
}

/**
 * Main webhook event processor
 * 
 * Call pattern (per Rev 7):
 *   const stripeCustomerId = await resolveStripeCustomerId(stripeSubscriptionId);
 *   await prisma.$transaction(async (tx) => {
 *     return processSubscriptionEvent(tx, event, stripeCustomerId);
 *   }, { isolationLevel: 'Serializable' });
 */
export async function processSubscriptionEvent(
  tx: PrismaTransaction,
  event: Stripe.Event,
  stripeCustomerId: string
): Promise<SubscriptionEventResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = subscription.id;

  // Step 1: Lock Provider and Subscription (universal order)
  // Uses pre-resolved stripeCustomerId (no Stripe API I/O inside transaction)
  const { provider, subscription: lockedSubscription } = await lockProviderAndSubscription(
    tx,
    stripeCustomerId,
    stripeSubscriptionId
  );

  // Step 2: Validate identity (using post-lock authoritative state)
  const identityCheck = validateSubscriptionIdentity(lockedSubscription, stripeSubscriptionId);

  if (!identityCheck.valid) {
    logger.error('Subscription identity mismatch', {
      lockedId: lockedSubscription?.stripeSubscriptionId,
      incomingId: stripeSubscriptionId,
      reason: identityCheck.reason,
    });

    return {
      allowed: false,
      reason: identityCheck.reason!,
    };
  }

  // Step 2.5: Validate Provider↔Subscription ownership (CRITICAL INVARIANT)
  const ownershipCheck = validateProviderSubscriptionOwnership(provider, lockedSubscription);

  if (!ownershipCheck.valid) {
    // FAIL CLOSED: Subscription is associated with different Provider
    // This indicates database inconsistency or corruption
    logger.error('Provider-Subscription ownership mismatch (CRITICAL)', {
      lockedProviderId: provider.id,
      subscriptionProviderId: lockedSubscription?.providerId,
      stripeSubscriptionId,
      stripeCustomerId,
    });

    return {
      allowed: false,
      reason: ownershipCheck.reason!,
    };
  }

  // Step 3: Policy decision (using post-lock state: lockedSubscription)
  const policyResult = await canTransitionSubscriptionState(event, subscription, lockedSubscription);

  if (!policyResult.allowed) {
    logger.info('Event rejected by policy', {
      stripeSubscriptionId,
      reason: policyResult.reason,
    });

    return policyResult;
  }

  // Step 4: Conditional mutation
  const newStatus = normalizeStripeStatus(subscription.status);
  const priceItem = subscription.items.data[0];

  if (lockedSubscription) {
    // Update existing subscription
    await tx.subscription.update({
      where: { id: lockedSubscription.id },
      data: {
        status: newStatus,
        lastWebhookEventId: event.id,
        lastWebhookEventTimestamp: event.created,
        monthlyAmount: priceItem.price.unit_amount ? priceItem.price.unit_amount / 100 : lockedSubscription.monthlyAmount,
        billingCycle: priceItem.price.recurring?.interval === 'year' ? 'annual' : 'monthly',
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelledAt: newStatus === 'CANCELLED' ? new Date() : lockedSubscription.cancelledAt,
      },
    });

    logger.info('Subscription updated', {
      subscriptionId: lockedSubscription.id,
      stripeSubscriptionId,
      status: newStatus,
      eventId: event.id,
    });

    return {
      allowed: true,
      reason: 'updated',
      subscriptionId: lockedSubscription.id,
    };
  } else {
    // Create new subscription
    // CRITICAL: Ownership invariant established at creation time
    // providerId MUST use locked Provider's ID (Stripe customer→Provider validated)
    const current_period_start = (subscription as any).current_period_start;
    const current_period_end = (subscription as any).current_period_end;

    // Derive tier from metadata or price ID
    const tier = await deriveTierFromSubscription(subscription);

    const newSubscription = await tx.subscription.create({
      data: {
        providerId: provider.id, // ← Explicit: uses locked Provider's ID
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        tier,
        status: newStatus,
        monthlyAmount: priceItem.price.unit_amount ? priceItem.price.unit_amount / 100 : 0,
        billingCycle: priceItem.price.recurring?.interval === 'year' ? 'annual' : 'monthly',
        currentPeriodStart: new Date(current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000),
        lastWebhookEventId: event.id,
        lastWebhookEventTimestamp: event.created,
        cancelledAt: newStatus === 'CANCELLED' ? new Date() : null,
      },
    });

    logger.info('Subscription created', {
      subscriptionId: newSubscription.id,
      stripeSubscriptionId,
      providerId: provider.id,
      status: newStatus,
      eventId: event.id,
    });

    return {
      allowed: true,
      reason: 'created',
      subscriptionId: newSubscription.id,
    };
  }
}

/**
 * Normalize Stripe status to database enum
 * Stripe uses "canceled" (US spelling), DB uses "CANCELLED" (double-L)
 */
function normalizeStripeStatus(status: string): SubscriptionStatus {
  const upper = status.toUpperCase();
  
  // Map Stripe statuses to DB enum
  switch (upper) {
    case 'TRIALING':
      return 'TRIAL';
    case 'CANCELED':
      return 'CANCELLED';
    case 'ACTIVE':
      return 'ACTIVE';
    case 'PAST_DUE':
      return 'PAST_DUE';
    case 'INCOMPLETE':
      return 'INCOMPLETE';
    case 'INCOMPLETE_EXPIRED':
      return 'INCOMPLETE_EXPIRED';
    case 'UNPAID':
      return 'UNPAID';
    default:
      logger.warn(`Unknown Stripe status: ${status}, defaulting to ACTIVE`);
      return 'ACTIVE';
  }
}

/**
 * Derive subscription tier from Stripe subscription metadata or price ID
 */
async function deriveTierFromSubscription(subscription: Stripe.Subscription): Promise<string> {
  // Try metadata first
  if (subscription.metadata?.tier) {
    return subscription.metadata.tier;
  }

  // Fall back to price ID mapping
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    logger.warn('No price ID found in subscription, defaulting to BASIC');
    return 'BASIC';
  }

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

  const tier = priceToTier[priceId];
  if (tier) {
    return tier;
  }

  logger.warn(`Unknown price ID: ${priceId}, defaulting to BASIC`);
  return 'BASIC';
}

/**
 * Resolve Stripe customer ID from subscription
 * 
 * MUST be called BEFORE transaction to avoid Stripe API I/O inside transaction.
 */
export async function resolveStripeCustomerId(
  stripe: Stripe,
  stripeSubscriptionId: string
): Promise<string> {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}
