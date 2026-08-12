import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.USERS_INSTRUCTORS_VIEW);
    if (deny) return deny;

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, createdAt: true, termsAcceptedAt: true } },
        _count: {
          select: {
            bookings: true,
            clients: true,
            subscriptions: true,
          },
        },
        bookings: {
          orderBy: { startTime: 'desc' },
          take: 10,
          include: {
            client: {
              select: {
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        },
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Derive Stripe Connect status from stored fields
    const stripeConnectStatus = instructor.stripeAccountId
      ? 'connected'
      : 'not_connected';

    return NextResponse.json({
      ...instructor,
      stripeConnectStatus,
    });
  } catch (error) {
    console.error('Admin instructor fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instructor' },
      { status: 500 }
    );
  }
}
