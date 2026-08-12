/**
 * GET /api/admin/subscriptions
 *
 * Returns all instructors with their subscription details for the admin
 * subscriptions overview page. Includes the most recent active subscription
 * row for period/amount data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.USERS_SUBSCRIPTIONS_VIEW);
    if (deny) return deny;

    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        trialEndsAt: true,
        user: { select: { email: true } },
        _count: { select: { bookings: true } },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            monthlyAmount: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      } as any,
      orderBy: [
        { subscriptionStatus: 'asc' },
        { name: 'asc' },
      ],
    }) as any[];

    const rows = instructors.map(i => ({
      id: i.id,
      name: i.name,
      email: i.user?.email ?? '',
      subscriptionTier: i.subscriptionTier ?? 'BASIC',
      subscriptionStatus: i.subscriptionStatus ?? 'TRIAL',
      stripeCustomerId: i.stripeCustomerId,
      stripeSubscriptionId: (i as any).stripeSubscriptionId ?? null,
      trialEndsAt: i.trialEndsAt?.toISOString() ?? null,
      bookingCount: i._count.bookings,
      monthlyAmount: i.subscriptions[0]?.monthlyAmount ?? null,
      currentPeriodEnd: i.subscriptions[0]?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: i.subscriptions[0]?.cancelAtPeriodEnd ?? false,
    }));

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Admin subscriptions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
