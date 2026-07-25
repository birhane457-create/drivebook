import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/disputes
 *
 * Returns all StripeDispute records, enriched with booking + instructor data.
 * Used by the admin disputes page to surface chargebacks that need action.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // open | won | lost | all

    const where: Record<string, unknown> = {};
    if (statusFilter === 'open') {
      where.status = {
        notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'],
      };
    } else if (statusFilter === 'won') {
      where.status = 'won';
    } else if (statusFilter === 'lost') {
      where.status = 'lost';
    }
    // 'all' or unset — no filter

    const disputes = await prisma.stripeDispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with booking + instructor data
    const enriched = await Promise.all(
      disputes.map(async (d: any) => {
        let booking = null;
        let instructor = null;

        if (d.bookingId) {
          booking = await prisma.booking.findUnique({
            where: { id: d.bookingId },
            select: {
              id: true,
              status: true,
              startTime: true,
              price: true,
              clientName: true,
              clientPhone: true,
            },
          });
        }

        if (d.instructorId) {
          instructor = await prisma.instructor.findUnique({
            where: { id: d.instructorId },
            select: { id: true, name: true, phone: true, payoutHold: true },
          });
        }

        return { ...d, booking, instructor };
      })
    );

    const openCount = enriched.filter(
      (d: any) => !['won', 'lost', 'charge_refunded', 'warning_closed'].includes(d.status)
    ).length;

    return NextResponse.json({ disputes: enriched, openCount });
  } catch (error) {
    console.error('Disputes fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

/**
 * POST /api/admin/disputes/:id/release-hold
 * Handled via PATCH below — releases the payout hold after a won dispute.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { stripeDisputeId, action } = body;

    if (!stripeDisputeId || !action) {
      return NextResponse.json({ error: 'stripeDisputeId and action required' }, { status: 400 });
    }

    const dispute = await prisma.stripeDispute.findUnique({
      where: { stripeDisputeId },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (action === 'release-hold') {
      // Release the instructor's payout hold
      if (dispute.instructorId) {
        await prisma.instructor.update({
          where: { id: dispute.instructorId },
          data: { payoutHold: false, payoutHoldReason: null } as any,
        });
      }

      await prisma.stripeDispute.update({
        where: { stripeDisputeId },
        data: { payoutFrozen: false },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'DISPUTE_HOLD_RELEASED',
          actorId: session.user.id,
          actorRole: 'ADMIN',
          targetType: 'DISPUTE',
          targetId: stripeDisputeId,
          success: true,
          metadata: {
            instructorId: dispute.instructorId,
            releasedBy: session.user.id,
            stripeDisputeId,
          },
        },
      });

      return NextResponse.json({ success: true, message: 'Payout hold released' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Dispute action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
