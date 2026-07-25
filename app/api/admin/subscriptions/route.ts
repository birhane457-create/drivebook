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

export const dynamic = 'force-dynamic';

function requireAdmin(session: any) {
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const authError = requireAdmin(session);
    if (authError) return authError;

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
