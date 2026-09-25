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
          select: { subscriptions: { where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
        }  as any) as any;

        if (!instructor?.stripeSubscriptionId) {
          return NextResponse.json({ error: 'No Stripe subscription ID on record — cannot sync' }, { status: 400 });
        }

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

        await prisma.$transaction(async (tx) => {
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
          const subRow = instructor.subscriptions[0];
          if (subRow) {
            await tx.subscription.update({
              where: { id: subRow.id },
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

        await prisma.$transaction(async (tx) => {
          await tx.provider.update({
            where: { id: params.id },
            data: {
              subscriptionTier: tier as any,
              subscriptionStatus: newStatus as any,
              maxProviders: (plan.limits as any).providers ?? (plan.limits as any).providers,
            } as any,
          });
          await tx.subscription.updateMany({
            where: { providerId: params.id, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
            data: { tier: tier as any, status: newStatus as any },
          });
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
        const instructor = await prisma.provider.findUnique({
          where: { id: params.id },
          select: { id: true },
        }  as any) as any;
        if (!instructor?.stripeSubscriptionId) {
          // No Stripe sub — just mark cancelled in DB
          await prisma.provider.update({
            where: { id: params.id },
            data: { subscriptionStatus: 'CANCELLED'  as any },
          });
          await prisma.subscription.updateMany({
            where: { providerId: params.id, status: { in: ['TRIAL', 'ACTIVE'] } },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          return NextResponse.json({ success: true, message: 'Subscription cancelled (no Stripe sub found)' });
        }

        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        await stripe.subscriptions.update(instructor.stripeSubscriptionId, {
          cancel_at_period_end: true,
          metadata: { cancelledByAdmin: adminEmail, cancelReason: reason || 'Admin cancellation' },
        });

        await prisma.subscription.updateMany({
          where: { providerId: params.id, stripeSubscriptionId: instructor.stripeSubscriptionId },
          data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
        });

        // AUDIT-01/02: cancel case has no $transaction (Stripe call already committed).
        // Use writeAuditLogSafe — Tier 4 treatment, failure does not affect outcome.
        await writeAuditLogSafe({
          action:     'SUBSCRIPTION_CANCELLED',
          actorId:    session!.user.id!,
          actorRole:  'ADMIN',
          targetType: 'TRANSACTION',
          targetId:   instructor.stripeSubscriptionId ?? params.id,
          metadata:   { adminAction: 'cancel_at_period_end', adminEmail, reason },
        });

        return NextResponse.json({ success: true, message: 'Subscription set to cancel at period end' });
      }

      // ── Immediate cancel: cancel now in Stripe ────────────────────────
      case 'cancel_immediately': {
        const instructor = await prisma.provider.findUnique({
          where: { id: params.id },
          select: { id: true },
        }  as any) as any;
        if (!instructor?.stripeSubscriptionId) {
          return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 400 });
        }

        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        await stripe.subscriptions.cancel(instructor.stripeSubscriptionId);

        await prisma.$transaction(async (tx) => {
          await tx.provider.update({
            where: { id: params.id },
            data: { subscriptionStatus: 'CANCELLED' as any },
          });
          await tx.subscription.updateMany({
            where: { providerId: params.id, stripeSubscriptionId: instructor.stripeSubscriptionId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          // AUDIT-01/02 fix (Tier 2): immediate cancellation is access-termination — must be atomic
          await writeAuditLog(tx, {
            action:     'SUBSCRIPTION_CANCELLED',
            actorId:    session!.user.id!,
            actorRole:  'ADMIN',
            targetType: 'TRANSACTION',
            targetId:   instructor.stripeSubscriptionId ?? params.id,
            metadata:   { adminAction: 'cancel_immediately', adminEmail, reason },
          });
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

        // Verify it exists in Stripe first
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        let stripeSub: any;
        try {
          stripeSub = await stripe.subscriptions.retrieve(newSubId);
        } catch {
          return NextResponse.json({ error: `Stripe subscription ${newSubId} not found` }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          // Update instructor
          await tx.provider.update({
            where: { id: params.id },
            data: { stripeSubscriptionId: newSubId, stripeCustomerId: stripeSub.customer as string } as any,
          });
          // Update specific row or the most recent active row
          if (subscriptionRowId) {
            await tx.subscription.update({
              where: { id: subscriptionRowId },
              data: { stripeSubscriptionId: newSubId, stripeCustomerId: stripeSub.customer as string },
            });
          } else {
            const activeRow = await tx.subscription.findFirst({
              where: { providerId: params.id, stripeSubscriptionId: null },
              orderBy: { createdAt: 'desc' },
            });
            if (activeRow) {
              await tx.subscription.update({
                where: { id: activeRow.id },
                data: { stripeSubscriptionId: newSubId, stripeCustomerId: stripeSub.customer as string },
              });
            }
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
