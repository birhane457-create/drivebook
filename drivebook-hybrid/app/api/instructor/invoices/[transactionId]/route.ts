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
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = params.transactionId;

    // Get transaction with related data
    const transaction = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: {
        instructor: {
          select: {
            name: true,
            phone: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            bookingType: true,
            client: {
              select: {
                name: true,
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify instructor owns this transaction
    if (transaction.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Generate simple text invoice
    const invoice = generateTextInvoice(transaction);

    // Return as plain text
    return new NextResponse(invoice, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="invoice-${transactionId}.txt"`,
      },
    });
  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}

function generateTextInvoice(transaction: any): string {
  const date = new Date(transaction.createdAt).toLocaleDateString();
  const processedDate = transaction.processedAt 
    ? new Date(transaction.processedAt).toLocaleDateString()
    : 'Pending';

  let invoice = `
================================================================================
                            DRIVEBOOK INVOICE
================================================================================

Invoice ID:        ${transaction.id}
Date Issued:       ${date}
Status:            ${transaction.status}
${transaction.processedAt ? `Processed Date:    ${processedDate}` : ''}

--------------------------------------------------------------------------------
                          INSTRUCTOR INFORMATION
--------------------------------------------------------------------------------

Name:              ${transaction.instructor.name}
Email:             ${transaction.instructor.user.email}
Phone:             ${transaction.instructor.phone}

--------------------------------------------------------------------------------
                          TRANSACTION DETAILS
--------------------------------------------------------------------------------

Transaction Type:  ${transaction.type}
Description:       ${transaction.description || 'Booking payment'}

`;

  if (transaction.booking) {
    invoice += `
Booking ID:        ${transaction.booking.id}
Client:            ${transaction.booking.client.name}
Booking Type:      ${transaction.booking.bookingType}
Date:              ${new Date(transaction.booking.startTime).toLocaleDateString()}
Time:              ${new Date(transaction.booking.startTime).toLocaleTimeString()} - ${new Date(transaction.booking.endTime).toLocaleTimeString()}

`;
  }

  invoice += `
--------------------------------------------------------------------------------
                          PAYMENT BREAKDOWN
--------------------------------------------------------------------------------

Total Booking Amount:              $${transaction.amount.toFixed(2)}
Platform Commission (${transaction.commissionRate?.toFixed(1)}%):      -$${transaction.platformFee.toFixed(2)}
                                   ─────────────
YOUR PAYOUT:                       $${transaction.instructorPayout.toFixed(2)}
                                   ═════════════

--------------------------------------------------------------------------------
                          PAYMENT INFORMATION
--------------------------------------------------------------------------------

Payment Method:    ${transaction.paymentMethod || 'Stripe'}
${transaction.stripePaymentIntentId ? `Stripe Payment ID: ${transaction.stripePaymentIntentId}` : ''}
${transaction.stripeTransferId ? `Stripe Transfer ID: ${transaction.stripeTransferId}` : ''}

--------------------------------------------------------------------------------
                          NOTES
--------------------------------------------------------------------------------

• This invoice is for your records
• Platform commission varies by subscription tier
• First bookings with new clients may have bonus commission
• Payouts are processed weekly
• Contact support@drivebook.com for questions

================================================================================
                    Thank you for using DriveBook!
================================================================================

Generated: ${new Date().toLocaleString()}
`;

  return invoice;
}
