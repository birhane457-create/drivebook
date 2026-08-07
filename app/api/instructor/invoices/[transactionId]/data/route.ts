/**
 * GET /api/instructor/invoices/[transactionId]/data
 *
 * Returns structured JSON for the visual invoice page.
 * The existing /api/instructor/invoices/[transactionId] route
 * continues to serve the plain-text download for backwards compat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PLATFORM_INVOICE_BLOCK } from '@/lib/config/platform-identity';
import { prisma } from '@/lib/prisma';
import { resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transaction = await (prisma.transaction.findUnique as any)({
      where: { id: params.transactionId },
      include: {
        instructor: {
          select: {
            name: true,
            businessName: true,
            phone: true,
            timezone: true,
            state: true,
            brandLogo: true,
            brandColorPrimary: true,
            user: { select: { email: true } },
          },
        },
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            bookingType: true,
            isPackageBooking: true,
            parentBookingId: true,
            pickupAddress: true,
            client: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (transaction.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const ins = transaction.instructor;
    const bk = transaction.booking;

    // Resolve timezone from instructor record
    const invoiceTz = ins?.timezone
      ? resolveTimezone(ins.timezone)
      : timezoneFromState(ins?.state);

    // Build invoice number from transaction id (last 8 chars, uppercase)
    const invoiceNumber = `INV-${transaction.id.slice(-8).toUpperCase()}`;

    const issueDate = new Date(transaction.createdAt).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: invoiceTz,
    });

    const paidAt = transaction.processedAt
      ? new Date(transaction.processedAt).toLocaleString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
          timeZone: invoiceTz,
        })
      : null;

    const durationHours = bk
      ? (new Date(bk.endTime).getTime() - new Date(bk.startTime).getTime()) / 3_600_000
      : null;

    const lessonDate = bk
      ? new Date(bk.startTime).toLocaleDateString('en-AU', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          timeZone: invoiceTz,
        })
      : null;

    const lessonStart = bk
      ? new Date(bk.startTime).toLocaleTimeString('en-AU', {
          hour: '2-digit', minute: '2-digit', timeZone: invoiceTz,
        })
      : null;

    const lessonEnd = bk
      ? new Date(bk.endTime).toLocaleTimeString('en-AU', {
          hour: '2-digit', minute: '2-digit', timeZone: invoiceTz,
        })
      : null;

    return NextResponse.json({
      invoiceNumber,
      issueDate,
      dueDate: paidAt ?? 'Pending',
      status: transaction.status === 'COMPLETED' ? 'PAID' : transaction.status === 'FAILED' ? 'FAILED' : 'PENDING',

      instructor: {
        name: ins.name,
        businessName: ins.businessName ?? null,
        email: ins.user.email,
        phone: ins.phone ?? '',
        abn: null, // ABN field not yet in schema — shows "update in Profile" note
        brandColor: ins.brandColorPrimary ?? '#6366f1',
        logoUrl: ins.brandLogo ?? null,
      },

      platform: PLATFORM_INVOICE_BLOCK,

      client: bk?.client
        ? {
            name: bk.client.name,
            email: bk.client.email ?? '',
            phone: bk.client.phone ?? '',
          }
        : { name: 'N/A', email: '', phone: '' },

      lesson: bk
        ? {
            date: lessonDate,
            startTime: lessonStart,
            endTime: lessonEnd,
            durationHours,
            type: bk.isPackageBooking && bk.parentBookingId ? 'Package Lesson' : 'Standard Lesson',
            pickupAddress: bk.pickupAddress ?? '',
            bookingRef: `BK-${bk.id.slice(-8).toUpperCase()}`,
            isPackage: !!(bk.isPackageBooking && bk.parentBookingId),
          }
        : null,

      payment: {
        grossAmount: transaction.amount,
        platformFee: transaction.platformFee,
        commissionRate: transaction.commissionRate ?? 12,
        instructorPayout: transaction.instructorPayout,
        paymentMethod: transaction.paymentMethod ?? 'Card',
        stripePaymentId: transaction.stripePaymentIntentId ?? null,
        paidAt: paidAt ?? 'Pending',
      },
    });
  } catch (err) {
    console.error('Invoice data error:', err);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
