// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getTrialEndDate } from '@/lib/config/subscriptions';
import { cancelSubscription } from '@/lib/services/subscription-cancel';
import { createOrReuseTrialSubscription } from '@/lib/services/subscription-lifecycle';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// Helper: extract instructor from JWT
async function getInstructorFromToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as { sub?: string; email?: string };
    const identifier = decoded.sub || decoded.email;
    if (!identifier) return null;

    const user = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { email: identifier }] },
      include: { provider: true },
    });
    if (!user?.provider) return null;
    // Attach the actor email so downstream callers can use it for audit logs
    // without a second DB query.
    return { ...user.provider, _actorEmail: user.email } as typeof user.provider & { _actorEmail: string };
  } catch {
    return null;
  }
}

// GET - current subscription
export async function GET(req: NextRequest) {
  const instructor = await getInstructorFromToken(req);
  if (!instructor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const plan = SUBSCRIPTION_PLANS[instructor.subscriptionTier as keyof typeof SUBSCRIPTION_PLANS];

  const subscription = await prisma.subscription.findFirst({
    where: { providerId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    subscriptionTier: instructor.subscriptionTier,
    subscriptionStatus: instructor.subscriptionStatus,
    trialEndsAt: instructor.trialEndsAt,
    monthlyAmount: plan.monthlyPrice,
    commissionRate: plan.commissionRate,
    newStudentBonus: plan.newStudentBonus,
    subscription: subscription
      ? {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  });
}

// POST - create/update trial subscription
export async function POST(req: NextRequest) {
  const instructor = await getInstructorFromToken(req);
  if (!instructor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tier, billingCycle = 'monthly' } = body;

  if (!tier || !['BASIC', 'PRO', 'STUDIO', 'PREMIUM'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  const amount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const existing = await prisma.subscription.findFirst({
    where: { providerId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
  });

  let subscription;
  if (existing) {
    // Tier change mid-trial — preserve original trial end, never reset it.
    // SUB-02-A FIX: Both writes inside $transaction.
    subscription = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id: existing.id },
        data: { tier: tier as any, monthlyAmount: amount, billingCycle, currentPeriodEnd: periodEnd },
      });

      await tx.provider.update({
        where: { id: instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: updatedSub.status as any,
          maxProviders: plan.limits.providers,
          // trialEndsAt intentionally NOT updated
        },
      });

      return updatedSub;
    });
  } else {
    // SUB-06-A Writer #4: First subscription — use lifecycle helper
    // This implements Provider-first locking (Provider FOR UPDATE → subscription FOR UPDATE)
    subscription = await prisma.$transaction(async (tx) => {
      const sub = await createOrReuseTrialSubscription(tx, instructor.id);
      
      // Sync Provider state with subscription (helper locks but doesn't update Provider)
      await tx.provider.update({
        where: { id: instructor.id },
        data: {
          subscriptionTier: sub.tier,
          subscriptionStatus: sub.status,
          trialEndsAt: sub.trialEndsAt,
        },
      });
      
      return sub;
    }, { isolationLevel: 'Serializable' });
  }

  return NextResponse.json({ success: true, subscription });
}

// DELETE - cancel subscription
export async function DELETE(req: NextRequest) {
  const instructor = await getInstructorFromToken(req);
  if (!instructor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SUB-09-A / SUB-10-A FIX: Delegate to authoritative cancellation service.
  // Stripe is cancelled before the local row is updated. If Stripe fails, the
  // local row is left unchanged and a 502 is returned — same contract as the web route.
  try {
    // Resolve actor email for audit log (best-effort — may be absent on JWT-only sessions).
    const actorEmail = (instructor as any)._actorEmail ?? `provider:${instructor.id}`;

    const result = await cancelSubscription({
      providerId: instructor.id,
      mode: 'period_end',
      actorEmail,
      reason: 'Instructor-initiated cancellation via mobile app',
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      endsAt: result.endsAt,
    });
  } catch (error: any) {
    console.error('Mobile subscription cancellation error:', error);
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
