// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getTrialEndDate } from '@/lib/config/subscriptions';
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
      include: { instructor: true },
    });
    return user?.instructor ?? null;
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
    where: { instructorId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
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

  if (!tier || !['BASIC', 'PRO', 'STUDIO', 'BUSINESS'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  const amount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const existing = await prisma.subscription.findFirst({
    where: { instructorId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
  });

  let subscription;
  if (existing) {
    // Tier change mid-trial — preserve original trial end, never reset it
    subscription = await prisma.subscription.update({
      where: { id: existing.id },
      data: { tier: tier as any, monthlyAmount: amount, billingCycle, currentPeriodEnd: periodEnd },
    });

    await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: subscription.status as any,
        maxInstructors: plan.limits.instructors,
        // trialEndsAt intentionally NOT updated
      },
    });
  } else {
    // First subscription — start fresh trial
    const trialEnd = getTrialEndDate(tier as any);
    subscription = await prisma.subscription.create({
      data: {
        instructorId: instructor.id,
        tier,
        status: 'TRIAL',
        monthlyAmount: amount,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: trialEnd,
      },
    });

    await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: trialEnd,
        maxInstructors: plan.limits.instructors,
      },
    });
  }

  return NextResponse.json({ success: true, subscription });
}

// DELETE - cancel subscription
export async function DELETE(req: NextRequest) {
  const instructor = await getInstructorFromToken(req);
  if (!instructor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { instructorId: instructor.id, status: { in: ['TRIAL', 'ACTIVE'] } },
  });

  if (!subscription) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    message: 'Subscription will cancel at period end',
    endsAt: subscription.currentPeriodEnd,
  });
}
