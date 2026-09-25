/**
 * Authoritative Subscription Cancellation Service
 *
 * SUB-10-A FIX: Replaces three inconsistent cancellation implementations:
 *   - instructor web DELETE (DB-only — wrong)
 *   - instructor mobile DELETE (DB-only — wrong)
 *   - admin cancel POST (Stripe + DB — correct, used as reference)
 *
 * ALL cancellation paths now delegate here.
 *
 * Invariants enforced:
 *   1. Stripe is always cancelled before the local DB is updated.
 *   2. If Stripe fails, the local row is NOT marked cancelled (no split-brain).
 *   3. If the subscription has no Stripe ID (pure local trial), DB-only is correct
 *      and explicitly documented as such.
 *   4. cancelledAt means "cancellation requested at", not "ended at" (SUB-25 clarification).
 *   5. Both cancelAtPeriodEnd and immediate cancellation are supported.
 *
 * Audit trail: SUB-09-A / SUB-10-A
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { writeAuditLogSafe } from '@/lib/services/audit';
import Stripe from 'stripe';

// Lazy-initialised so tests can import this module without STRIPE_SECRET_KEY set.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return _stripe;
}

export interface CancelSubscriptionParams {
  /** DB Provider.id */
  providerId: string;
  /**
   * 'period_end' — cancel at the end of the current billing period (graceful).
   * 'immediate'  — cancel now in Stripe (access ends today).
   */
  mode: 'period_end' | 'immediate';
  /** Human-readable reason stored in Stripe metadata and audit log. */
  reason?: string;
  /** Actor performing the cancellation — used in audit log. */
  actorEmail: string;
}

export interface CancelSubscriptionResult {
  success: true;
  stripeAction: 'cancelled_in_stripe' | 'local_only_no_stripe_id' | 'already_cancelled';
  endsAt: Date | null;
  message: string;
}

/**
 * Cancel a subscription.
 *
 * Stripe-first: Stripe is cancelled before the local row is updated.
 * If Stripe throws, this function throws and the local row is left unchanged —
 * the caller receives an error and can surface it to the user.
 *
 * Trial-only subscriptions (stripeSubscriptionId = null) are cancelled in the
 * local DB only. That is correct behaviour — there is nothing to cancel in Stripe.
 */
export async function cancelSubscription(
  params: CancelSubscriptionParams,
): Promise<CancelSubscriptionResult> {
  const { providerId, mode, reason, actorEmail } = params;

  // --- 1. Find the active local subscription row --------------------------------
  const subscription = await prisma.subscription.findFirst({
    where: {
      providerId,
      status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    // Nothing to cancel — return gracefully so callers can surface appropriate UX.
    return {
      success: true,
      stripeAction: 'already_cancelled',
      endsAt: null,
      message: 'No active subscription found',
    };
  }

  if (subscription.cancelAtPeriodEnd && mode === 'period_end') {
    // Idempotent: already scheduled to cancel.
    return {
      success: true,
      stripeAction: 'already_cancelled',
      endsAt: subscription.currentPeriodEnd ?? null,
      message: 'Subscription is already scheduled to cancel at period end',
    };
  }

  const now = new Date();
  const stripeSubId = (subscription as any).stripeSubscriptionId as string | null;

  // --- 2. Stripe cancellation (Stripe-first invariant) --------------------------
  let stripeAction: CancelSubscriptionResult['stripeAction'];

  if (stripeSubId) {
    // This can throw — that is intentional.
    // If Stripe rejects the cancellation we must NOT update the local row.
    const stripe = getStripe();

    if (mode === 'period_end') {
      await stripe.subscriptions.update(stripeSubId, {
        cancel_at_period_end: true,
        metadata: {
          cancelledBy: actorEmail,
          cancelReason: reason ?? 'User cancellation',
          cancelledAt: now.toISOString(),
        },
      });
    } else {
      // immediate
      await stripe.subscriptions.cancel(stripeSubId);
    }

    stripeAction = 'cancelled_in_stripe';
    logger.info(
      `[subscription-cancel] Stripe ${mode} cancel for ${stripeSubId} (provider=${providerId})`,
    );
  } else {
    // No Stripe subscription ID — pure trial or pre-Stripe subscription.
    // DB-only is correct here. Log explicitly so this path is auditable.
    stripeAction = 'local_only_no_stripe_id';
    logger.info(
      `[subscription-cancel] No stripeSubscriptionId — local-only cancel for provider=${providerId}`,
    );
  }

  // --- 3. Update local DB (after Stripe succeeds) --------------------------------
  const newStatus = mode === 'immediate' ? 'CANCELLED' : undefined; // period_end keeps current status

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        // cancelledAt = "cancellation requested at" (SUB-25: field semantic clarification)
        cancelAtPeriodEnd: mode === 'period_end' ? true : (subscription as any).cancelAtPeriodEnd,
        cancelledAt: now,
        ...(newStatus ? { status: newStatus } : {}),
      },
    });

    if (mode === 'immediate') {
      await tx.provider.update({
        where: { id: providerId },
        data: { subscriptionStatus: 'CANCELLED' as any },
      });
    }
  });

  // AUDIT-01/02 fix (Tier 4): cancellation service — Stripe + DB already committed.
  // writeAuditLogSafe documents that this specific audit failure is non-critical
  // and that the cancellation itself is unaffected.
  await writeAuditLogSafe({
    action:     AuditAction.SUBSCRIPTION_CANCELLED,
    actorId:    providerId,
    actorRole:  'SYSTEM',
    targetType: 'TRANSACTION',
    targetId:   stripeSubId ?? subscription.id,
    metadata:   {
      mode,
      stripeAction,
      actorEmail,
      reason:      reason ?? null,
      cancelledAt: now.toISOString(),
    },
  });

  const endsAt = mode === 'period_end'
    ? (subscription.currentPeriodEnd ?? null)
    : null;

  return {
    success: true,
    stripeAction,
    endsAt,
    message:
      mode === 'period_end'
        ? `Subscription will cancel at period end${endsAt ? ` (${endsAt.toISOString()})` : ''}`
        : 'Subscription cancelled immediately',
  };
}
