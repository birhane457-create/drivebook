import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Generate invoice text
    const invoice = `
================================================================================
                              DRIVEBOOK INVOICE
================================================================================

Invoice ID: ${transaction.id}
Date: ${new Date(transaction.createdAt).toLocaleDateString('en-AU')}
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
Date: ${new Date(transaction.booking.startTime).toLocaleDateString('en-AU')}
Time: ${new Date(transaction.booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} - ${new Date(transaction.booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
Pickup: ${transaction.booking.pickupAddress || 'N/A'}
` : 'No booking details available'}

--------------------------------------------------------------------------------
PAYMENT INFORMATION
--------------------------------------------------------------------------------

Payment Method: Credit/Debit Card
Payment Status: ${transaction.status}
Processed: ${new Date(transaction.createdAt).toLocaleString('en-AU')}
${transaction.processedAt ? `Completed: ${new Date(transaction.processedAt).toLocaleString('en-AU')}` : ''}

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
