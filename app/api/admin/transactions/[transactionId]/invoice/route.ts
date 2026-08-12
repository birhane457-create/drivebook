import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_REVENUE_VIEW);
    if (deny) return deny;

    const transactionId = params.transactionId;

    // Get transaction details
    const transaction = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          include: {
            client: true,
            instructor: true
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Resolve timezone for this invoice: use instructor's TZ if available, else state fallback
    const invoiceTz = transaction.booking?.instructor
      ? transaction.booking.instructor.timezone
        ? resolveTimezone(transaction.booking.instructor.timezone)
        : timezoneFromState(transaction.booking.instructor.state)
      : DEFAULT_TIMEZONE;

    // Generate invoice text
    const invoice = `
================================================================================
                              DRIVEBOOK INVOICE
================================================================================

Invoice ID: ${transaction.id}
Date: ${new Date(transaction.createdAt).toLocaleDateString('en-AU', { timeZone: invoiceTz })}
Status: ${transaction.status}

--------------------------------------------------------------------------------
TRANSACTION DETAILS
--------------------------------------------------------------------------------

Transaction Type: ${transaction.type}
Booking ID: ${transaction.bookingId || 'N/A'}
Payment Intent: ${transaction.stripePaymentIntentId || 'N/A'}

--------------------------------------------------------------------------------
PARTIES
--------------------------------------------------------------------------------

Instructor: ${transaction.booking?.instructor?.name || 'N/A'}
Instructor ID: ${transaction.instructorId}

${transaction.booking ? `Client: ${transaction.booking.client?.name || 'N/A'}
Client Email: ${transaction.booking.client?.email || 'N/A'}
Client Phone: ${transaction.booking.client?.phone || 'N/A'}` : ''}

--------------------------------------------------------------------------------
FINANCIAL BREAKDOWN
--------------------------------------------------------------------------------

Total Amount:           $${transaction.amount.toFixed(2)} AUD
Platform Fee (12%):     $${transaction.platformFee.toFixed(2)} AUD
Instructor Payout:      $${transaction.instructorPayout.toFixed(2)} AUD

${transaction.booking?.isFirstBooking ? `
Note: First booking bonus applied (20% commission)
` : ''}

--------------------------------------------------------------------------------
BOOKING DETAILS
--------------------------------------------------------------------------------

${transaction.booking ? `
Date: ${new Date(transaction.booking.startTime).toLocaleDateString('en-AU', { timeZone: invoiceTz })}
Time: ${new Date(transaction.booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: invoiceTz })} - ${new Date(transaction.booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: invoiceTz })}
Pickup: ${transaction.booking.pickupAddress || 'N/A'}
` : 'No booking details available'}

--------------------------------------------------------------------------------
PAYMENT INFORMATION
--------------------------------------------------------------------------------

Payment Method: Credit/Debit Card
Payment Status: ${transaction.status}
Processed: ${new Date(transaction.createdAt).toLocaleString('en-AU', { timeZone: invoiceTz })}
${transaction.processedAt ? `Completed: ${new Date(transaction.processedAt).toLocaleString('en-AU', { timeZone: invoiceTz })}` : ''}

================================================================================
                        Thank you for using DriveBook
                      For support: support@drivebook.com.au
================================================================================

This is a computer-generated invoice and does not require a signature.
`;

    // Return as downloadable text file
    return new NextResponse(invoice, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="invoice-${transactionId}.txt"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
