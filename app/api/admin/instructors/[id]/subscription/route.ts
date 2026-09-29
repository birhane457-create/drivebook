/**
 * Admin Subscription Management API
 * GET  /api/admin/instructors/[id]/subscription — full subscription details + Stripe live data
 * POST /api/admin/instructors/[id]/subscription — admin override (tier change, force-sync, cancel, refund)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { writeAuditLog, writeAuditLogSafe } from '@/lib/services/audit';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.USERS_SUBSCRIPTIONS_VIEW);
    if (deny) return deny;

    const instructor = await prisma.provider.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        trialEndsAt: true,
        user: { select: { email: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            tier: true,
            status: true,
            monthlyAmount: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            cancelAtPeriodEnd: true,
            cancelledAt: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            createdAt: true,
          },
        },
      }  as any,
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Fetch live Stripe data if subscription ID exists
    let stripeData: any = null;
    let stripeError: string | null = null;
    if (instructor.stripeSubscriptionId) {
      try {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        const stripeSub = await stripe.subscriptions.retrieve(instructor.stripeSubscriptionId, {
          expand: ['items.data.price', 'latest_invoice'],
        });
        stripeData = {
          id: stripeSub.id,
          status: stripeSub.status,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
          priceId: stripeSub.items?.data?.[0]?.price?.id,
          amount: (stripeSub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
          interval: stripeSub.items?.data?.[0]?.price?.recurring?.interval,
          metadata: stripeSub.metadata,
          latestInvoice: stripeSub.latest_invoice
            ? {
                id: (stripeSub.latest_invoice as any).id,
                status: (stripeSub.latest_invoice as any).status,
                amountPaid: ((stripeSub.latest_invoice as any).amount_paid ?? 0) / 100,
                created: new Date((stripeSub.latest_invoice as any).created * 1000).toISOString(),
                hostedUrl: (stripeSub.latest_invoice as any).hosted_invoice_url,
              }
            : null,
        };
      } catch (err: any) {
        stripeError = err.message ?? 'Failed to fetch Stripe data';
        logger.error(`Admin sub GET: Stripe fetch failed for ${instructor.stripeSubscriptionId}`, { error: err.message });
      }
    }

    // DB/Stripe drift check
    const drift: string[] = [];
    if (stripeData) {
      const stripeStatus = stripeData.status.toUpperCase().replace('CANCELED', 'CANCELLED');
      if (instructor.subscriptionStatus !== stripeStatus) {
        drift.push(`Status: DB=${instructor.subscriptionStatus} Stripe=${stripeStatus}`);
      }
    }

    return NextResponse.json({
      provider: {
        id: instructor.id,
        name: instructor.name,
        email: instructor.user?.email,
        subscriptionTier: instructor.subscriptionTier,
        subscriptionStatus: instructor.subscriptionStatus,
        stripeCustomerId: instructor.stripeCustomerId,
        stripeSubscriptionId: instructor.stripeSubscriptionId,
        trialEndsAt: instructor.trialEndsAt,
      },
      subscriptions: instructor.subscriptions,
      stripeData,
      stripeError,
      drift,
    });
  } catch (error: any) {
    logger.error('Admin sub GET error', { error: error.message });
    return NextResponse.json({ error: 'Failed to fetch subscription data' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.USERS_PROVIDERS_MANAGE_SUBSCRIPTION);
    if (deny) return deny;

    const body = await req.json();
    const { action, reason } = body;
    const adminEmail = session!.user.email || 'admin';

    switch (action) {
      // ── Force-sync: pull live Stripe state into DB ─────────────────────
      case 'sync': {
        const instructor = await prisma.provider.findUnique({
          where: { id: params.id },
          select: { 
            id: true,
            stripeSubscriptionId: true,
            subscriptions: { 
              where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } }, 
              orderBy: { createdAt: 'desc' }, 
              take: 1 
            } 
          },
        }  as any) as any;

        if (!instructor?.stripeSubscriptionId) {
          return NextResponse.json({ error: 'No Stripe subscription ID on record — cannot sync' }, { status: 400 });
        }

        // Step 1: Fetch live Stripe state (outside transaction - immutable Stripe identity)
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        const stripeSub = await stripe.subscriptions.retrieve(instructor.stripeSubscriptionId, {
          expand: ['items.data.price'],
        });

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
        const priceId = stripeSub.items?.data?.[0]?.price?.id;
        const tier = priceToTier[priceId] || stripeSub.metadata?.tier;
        const normalStatus = (stripeSub.status as string).toUpperCase().replace('CANCELED', 'CANCELLED');
        const plan = tier ? SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS] : null;

        // Step 2: Apply SUB-06-A Rev7 Provider-first locking with full current-sub inventory
        // Admin sync can race with concurrent webhook handlers processing the same Stripe events.
        // Pattern: Provider FOR UPDATE → ALL current subs FOR UPDATE → post-lock re-read →
        //          0/1/>1 invariant → ownership → mutate
        const { lockProvider } = await import('@/lib/services/subscription-lifecycle');

        await prisma.$transaction(async (tx) => {
          // Step 2a: Lock Provider FOR UPDATE (actual PostgreSQL row lock via $queryRaw)
          const lockedProvider = await lockProvider(tx, params.id);

          if (!lockedProvider) {
            throw new Error('Provider not found or deleted during sync');
          }

          // Step 2b: Lock ALL current/eligible subscriptions FOR UPDATE (Rev7: full inventory)
          // CRITICAL: Pre-transaction instructor.subscriptions snapshot is stale by the time
          // we enter the transaction — a concurrent webhook may have mutated it during
          // the Stripe API call above. Lock the complete current set instead.
          const currentSubscriptionsRaw = await tx.$queryRaw<any[]>`
            SELECT * FROM "Subscription"
            WHERE "providerId" = ${lockedProvider.id}
              AND "status" != 'CANCELLED'
            FOR UPDATE
          `;

          // Step 2c: Post-lock re-read to get authoritative state after lock acquired
          const currentSubscriptions = (await Promise.all(
            currentSubscriptionsRaw.map(s => tx.subscription.findUnique({ where: { id: s.id } }))
          )).filter((s): s is NonNullable<typeof s> => s !== null);

          // Step 2d: 0/1/>1 invariant — fail closed on multiple current subscriptions
          if (currentSubscriptions.length > 1) {
            throw new Error(
              `INVARIANT VIOLATION: Provider ${lockedProvider.id} has ${currentSubscriptions.length} current subscriptions — failing closed`
            );
          }

          // Step 2e: Exact Stripe subscription identity match (TOCTOU guard)
          // CRITICAL: The Stripe state fetched above belongs to instructor.stripeSubscriptionId.
          // A concurrent lifecycle operation may have changed the Provider's current subscription
          // from A → B between the pre-transaction Stripe fetch and this lock acquisition.
          // Applying A's Stripe state to B would corrupt B's lifecycle identity.
          // If A is absent from the post-lock set, do NOT fall back to B.
          const lockedSubscription = currentSubscriptions.find(
            s => (s as any).stripeSubscriptionId === instructor.stripeSubscriptionId
          ) ?? null;

          if (!lockedSubscription && currentSubscriptions.length > 0) {
            // The subscription this Stripe fetch was for is no longer the current subscription.
            // A concurrent operation replaced it. Do not mutate. Throw so the caller sees a
            // clear reconciliation failure rather than silently writing stale state.
            throw new Error(
              `TOCTOU: Stripe subscription ${instructor.stripeSubscriptionId} is no longer the current subscription for provider ${lockedProvider.id} — a concurrent operation replaced it. Admin should re-sync after the concurrent operation settles.`
            );
          }

          // Ownership validation for matched subscription
          if (lockedSubscription && lockedSubscription.providerId !== lockedProvider.id) {
            throw new Error('Ownership violation: subscription does not belong to provider');
          }

          // Step 3: Mutate Provider (locked)
          await tx.provider.update({
            where: { id: params.id },
            data: {
              subscriptionTier: tier as any,
              subscriptionStatus: normalStatus as any,
              trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
              stripeCustomerId: stripeSub.customer as string,
              ...(plan && { maxProviders: (plan.limits as any).providers ?? (plan.limits as any).providers }),
            } as any,
          });

          // Step 4: Mutate Subscription (locked, from post-lock set)
          if (lockedSubscription) {
            await tx.subscription.update({
              where: { id: lockedSubscription.id },
              data: {
                tier: tier as any,
                status: normalStatus as any,
                stripeSubscriptionId: instructor.stripeSubscriptionId,
                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              },
            });
          }

          // AUDIT-01/02 fix (Tier 2): atomic with state change
          await writeAuditLog(tx, {
            action:     'SUBSCRIPTION_UPDATED',
            actorId:    session!.user.id!,
            actorRole:  'ADMIN',
            targetType: 'TRANSACTION',
            targetId:   instructor.stripeSubscriptionId ?? params.id,
            metadata:   { adminAction: 'force_sync', adminEmail, tier, status: normalStatus, reason },
          });
        });

        return NextResponse.json({ success: true, message: `Synced: tier=${tier}, status=${normalStatus}`, tier, status: normalStatus });
      }

      // ── Override tier: admin manually sets tier + status ───────────────
      case 'override_tier': {
        const { tier, status } = body;
        if (!tier || !['BASIC', 'PRO', 'STUDIO', 'PREMIUM'].includes(tier)) {
          return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }
        const validStatuses = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED'];
        if (status && !validStatuses.includes(status)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
        const newStatus = status || 'ACTIVE';

        // SUB-06-A Rev7: Provider-first locking with full current-sub inventory + 0/1/>1 invariant
        // Pattern: Provider FOR UPDATE → ALL current subs FOR UPDATE → post-lock re-read →
        //          0/1/>1 invariant (fail closed) → ownership → mutate
        const { lockProvider: lockProviderForOverride } = await import('@/lib/services/subscription-lifecycle');

        await prisma.$transaction(async (tx) => {
          // Step 1: Lock Provider FOR UPDATE (actual PostgreSQL row lock via $queryRaw)
          const lockedProvider = await lockProviderForOverride(tx, params.id);

          if (!lockedProvider) {
            throw new Error('Provider not found or deleted during override');
          }

          // Step 2: Lock ALL current/eligible subscriptions FOR UPDATE (Rev7: full inventory)
          const targetSubscriptionsRaw = await tx.$queryRaw<any[]>`
            SELECT * FROM "Subscription"
            WHERE "providerId" = ${params.id}
              AND "status" IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
            FOR UPDATE
          `;

          // Step 3: Post-lock re-read to get authoritative state after lock acquired
          const targetSubscriptions = (await Promise.all(
            targetSubscriptionsRaw.map(s => tx.subscription.findUnique({ where: { id: s.id } }))
          )).filter((s): s is NonNullable<typeof s> => s !== null);

          // Step 4: 0/1/>1 invariant — fail closed on multiple current subscriptions
          // An override on a Provider with >1 current subscriptions indicates a pre-existing
          // invariant violation that must not be masked by blindly updating all rows.
          if (targetSubscriptions.length > 1) {
            throw new Error(
              `INVARIANT VIOLATION: Provider ${lockedProvider.id} has ${targetSubscriptions.length} current subscriptions — failing closed`
            );
          }

          // Step 5: Ownership validation (all target subscriptions belong to locked Provider)
          for (const sub of targetSubscriptions) {
            if (sub.providerId !== lockedProvider.id) {
              throw new Error('Ownership violation: subscription does not belong to provider');
            }
          }

          // Step 6: Mutate Provider (locked)
          await tx.provider.update({
            where: { id: params.id },
            data: {
              subscriptionTier: tier as any,
              subscriptionStatus: newStatus as any,
              maxProviders: (plan.limits as any).providers ?? (plan.limits as any).providers,
            } as any,
          });

          // Step 7: Mutate each target subscription (locked, from post-lock re-read set)
          for (const sub of targetSubscriptions) {
            await tx.subscription.update({
              where: { id: sub.id },
              data: { tier: tier as any, status: newStatus as any },
            });
          }

          // AUDIT-01/02 fix (Tier 2): atomic with tier override — security-sensitive
          await writeAuditLog(tx, {
            action:     'SUBSCRIPTION_UPDATED',
            actorId:    session!.user.id!,
            actorRole:  'ADMIN',
            targetType: 'TRANSACTION',
            targetId:   `admin-override-${params.id}`,
            metadata:   { adminAction: 'override_tier', adminEmail, tier, status: newStatus, reason },
          });
        });

        return NextResponse.json({ success: true, message: `Override applied: tier=${tier}, status=${newStatus}` });
      }

      // ── Cancel: cancel at period end via Stripe ───────────────────────
      case 'cancel': {
        const instructorForCancel = await prisma.provider.findUnique({
          where: { id: params.id },
          select: { id: true, stripeSubscriptionId: true },
        }  as any) as any;

        if (!instructorForCancel?.stripeSubscriptionId) {
          // No Stripe sub — delegate to cancelSubscription service (handles local-only path)
          const { cancelSubscription } = await import('@/lib/services/subscription-cancel');
          await cancelSubscription({
            providerId: params.id,
            mode: 'period_end',
            reason: reason || 'Admin cancellation (no Stripe sub)',
            actorEmail: adminEmail,
          });
          return NextResponse.json({ success: true, message: 'Subscription cancelled (no Stripe sub found)' });
        }

        // Stripe cancel at period end — delegate to authoritative cancelSubscription service
        // which enforces Rev7 Provider-first locking with full current-sub inventory
        const { cancelSubscription } = await import('@/lib/services/subscription-cancel');
        await cancelSubscription({
          providerId: params.id,
          mode: 'period_end',
          reason: reason || 'Admin cancellation',
          actorEmail: adminEmail,
        });

        await writeAuditLogSafe({
          action:     'SUBSCRIPTION_CANCELLED',
          actorId:    session!.user.id!,
          actorRole:  'ADMIN',
          targetType: 'TRANSACTION',
          targetId:   instructorForCancel.stripeSubscriptionId ?? params.id,
          metadata:   { adminAction: 'cancel_at_period_end', adminEmail, reason },
        });

        return NextResponse.json({ success: true, message: 'Subscription set to cancel at period end' });
      }

      // ── Immediate cancel: cancel now in Stripe ────────────────────────
      case 'cancel_immediately': {
        const instructorForImmediateCancel = await prisma.provider.findUnique({
          where: { id: params.id },
          select: { id: true, stripeSubscriptionId: true },
        }  as any) as any;

        if (!instructorForImmediateCancel?.stripeSubscriptionId) {
          return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 400 });
        }

        // Delegate to authoritative cancelSubscription service — enforces Rev7
        // Provider-first locking with full current-sub inventory lock
        const { cancelSubscription } = await import('@/lib/services/subscription-cancel');
        await cancelSubscription({
          providerId: params.id,
          mode: 'immediate',
          reason: reason || 'Admin immediate cancellation',
          actorEmail: adminEmail,
        });

        // Audit log written inside cancelSubscription via writeAuditLogSafe.
        // Add admin-specific audit entry here for admin action traceability.
        await writeAuditLogSafe({
          action:     'SUBSCRIPTION_CANCELLED',
          actorId:    session!.user.id!,
          actorRole:  'ADMIN',
          targetType: 'TRANSACTION',
          targetId:   instructorForImmediateCancel.stripeSubscriptionId ?? params.id,
          metadata:   { adminAction: 'cancel_immediately', adminEmail, reason },
        });

        return NextResponse.json({ success: true, message: 'Subscription cancelled immediately' });
      }

      // ── Delete duplicate subscription rows ────────────────────────────
      case 'delete_subscription_row': {
        const { subscriptionRowId } = body;
        if (!subscriptionRowId) return NextResponse.json({ error: 'subscriptionRowId required' }, { status: 400 });

        const row = await prisma.subscription.findUnique({ where: { id: subscriptionRowId } });
        if (!row || row.providerId !== params.id) {
          return NextResponse.json({ error: 'Row not found or belongs to different instructor' }, { status: 404 });
        }

        await prisma.subscription.delete({ where: { id: subscriptionRowId } });

        logger.info(`Admin deleted duplicate subscription row ${subscriptionRowId} for instructor ${params.id} (by ${adminEmail})`);

        return NextResponse.json({ success: true, message: `Deleted subscription row ${subscriptionRowId}` });
      }

      // ── Link Stripe subscription ID manually ──────────────────────────
      case 'link_stripe_sub': {
        const { stripeSubscriptionId: newSubId, subscriptionRowId } = body;
        if (!newSubId) return NextResponse.json({ error: 'stripeSubscriptionId required' }, { status: 400 });

        // Step 1: Verify Stripe subscription exists (outside transaction - immutable Stripe identity)
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        let stripeSub: any;
        try {
          stripeSub = await stripe.subscriptions.retrieve(newSubId);
        } catch {
          return NextResponse.json({ error: `Stripe subscription ${newSubId} not found` }, { status: 400 });
        }

        // Step 2: Apply SUB-06-A Rev7 Provider-first locking with full current-sub inventory
        // Linking a stripeSubscriptionId changes lifecycle identity — particularly sensitive.
        // A concurrent webhook could be attaching the same Stripe ID to a different row.
        // Pattern: Provider FOR UPDATE → ALL current subs FOR UPDATE → post-lock re-read →
        //          0/1/>1 invariant → identify target from post-lock set → ownership → mutate
        const { lockProvider: lockProviderForLink } = await import('@/lib/services/subscription-lifecycle');

        await prisma.$transaction(async (tx) => {
          // Step 2a: Lock Provider FOR UPDATE (actual PostgreSQL row lock via $queryRaw)
          const lockedProvider = await lockProviderForLink(tx, params.id);

          if (!lockedProvider) {
            throw new Error('Provider not found or deleted during link operation');
          }

          // Step 2b: Lock ALL current/eligible subscriptions FOR UPDATE (Rev7: full inventory)
          // CRITICAL: Must establish the complete current-sub boundary before deciding which
          // row receives the incoming Stripe ID. A concurrent webhook could be attaching
          // the same stripeSubscriptionId to a different subscription row.
          const currentSubscriptionsRaw = await tx.$queryRaw<any[]>`
            SELECT * FROM "Subscription"
            WHERE "providerId" = ${lockedProvider.id}
              AND "status" != 'CANCELLED'
            FOR UPDATE
          `;

          // Step 2c: Post-lock re-read to get authoritative state after lock acquired
          const currentSubscriptions = (await Promise.all(
            currentSubscriptionsRaw.map(s => tx.subscription.findUnique({ where: { id: s.id } }))
          )).filter((s): s is NonNullable<typeof s> => s !== null);

          // Step 2d: 0/1/>1 invariant — fail closed on multiple current subscriptions
          if (currentSubscriptions.length > 1) {
            throw new Error(
              `INVARIANT VIOLATION: Provider ${lockedProvider.id} has ${currentSubscriptions.length} current subscriptions — failing closed`
            );
          }

          // Step 2e: Identify target subscription from the post-lock set
          // If a specific subscriptionRowId was requested, verify it is in the locked set.
          // Otherwise, find the most recent current sub without a Stripe ID.
          let lockedSubscription: any = null;
          if (subscriptionRowId) {
            lockedSubscription = currentSubscriptions.find(s => s.id === subscriptionRowId) ?? null;

            if (!lockedSubscription) {
              // Also check if it exists but is CANCELLED (not in current set)
              const cancelledRows = await tx.$queryRaw<any[]>`
                SELECT * FROM "Subscription"
                WHERE "id" = ${subscriptionRowId}
                  AND "providerId" = ${lockedProvider.id}
                FOR UPDATE
              `;
              if (cancelledRows.length === 0) {
                throw new Error('Subscription row not found or deleted during link operation');
              }
              // Re-read post-lock
              lockedSubscription = await tx.subscription.findUnique({ where: { id: subscriptionRowId } });
              if (!lockedSubscription) {
                throw new Error('Subscription row not found after lock');
              }
            }
          } else {
            // Find the most recent current sub without a Stripe ID from the post-lock set
            lockedSubscription = currentSubscriptions
              .filter(s => !(s as any).stripeSubscriptionId)
              .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())[0]
              ?? null;
          }

          // Step 2f: Ownership validation
          if (lockedSubscription && lockedSubscription.providerId !== lockedProvider.id) {
            throw new Error('Ownership violation: subscription does not belong to provider');
          }

          // Step 3: Mutate Provider (locked)
          await tx.provider.update({
            where: { id: params.id },
            data: { stripeSubscriptionId: newSubId, stripeCustomerId: stripeSub.customer as string } as any,
          });

          // Step 4: Mutate target Subscription (locked, from post-lock set)
          if (lockedSubscription) {
            await tx.subscription.update({
              where: { id: lockedSubscription.id },
              data: { stripeSubscriptionId: newSubId, stripeCustomerId: stripeSub.customer as string },
            });
          }

          // AUDIT-01/02 fix (Tier 2): atomic with Stripe link — security-sensitive
          await writeAuditLog(tx, {
            action:     'SUBSCRIPTION_UPDATED',
            actorId:    session!.user.id!,
            actorRole:  'ADMIN',
            targetType: 'TRANSACTION',
            targetId:   newSubId,
            metadata:   { adminAction: 'link_stripe_sub', adminEmail, stripeSubscriptionId: newSubId, reason },
          });
        });

        return NextResponse.json({ success: true, message: `Linked Stripe subscription ${newSubId}` });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    logger.error('Admin sub POST error', { error: error.message, providerId: params.id });
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}
