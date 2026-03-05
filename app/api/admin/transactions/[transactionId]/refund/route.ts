import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services/stripe';
import { smsService } from '@/lib/services/sms';


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let amount, reason, deductFromInstructor;
    
    // Handle empty request body
    try {
      const body = await req.json();
      amount = body.amount;
      reason = body.reason;
      deductFromInstructor = body.deductFromInstructor;
    } catch (e) {
      // Empty body is okay, we'll use defaults
      amount = null;
      reason = null;
      deductFromInstructor = false;
    }
    
    const transactionId = params.transactionId;

    // Get transaction details
    const transaction = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          include: {
            client: true,
            instructor: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only refund completed transactions' }, { status: 400 });
    }

    if (!transaction.stripePaymentIntentId) {
      return NextResponse.json({ error: 'No payment intent found' }, { status: 400 });
    }

    // Determine refund amount (full or partial)
    const refundAmount = amount || transaction.amount;

    // Process refund through Stripe
    const refund = await stripeService.createRefund(
      transaction.stripePaymentIntentId,
      refundAmount
    );

    // Create refund transaction record
    await (prisma as any).transaction.create({
      data: {
        bookingId: transaction.bookingId,
        instructorId: transaction.instructorId,
        type: 'REFUND',
        amount: -refundAmount,
        platformFee: 0,
        instructorPayout: 0,
        status: 'COMPLETED',
        stripeRefundId: refund.refundId,
        description: reason || 'Refund processed by admin',
        metadata: {
          originalTransactionId: transactionId,
          deductFromInstructor: deductFromInstructor || false
        }
      }
    });

    // Update original transaction status
    await (prisma as any).transaction.update({
      where: { id: transactionId },
      data: { status: 'REFUNDED' }
    });

    // If deducting from instructor, create a deduction record
    if (deductFromInstructor) {
      await (prisma as any).transaction.create({
        data: {
          instructorId: transaction.instructorId,
          type: 'COMMISSION',
          amount: -refundAmount,
          platformFee: 0,
          instructorPayout: -refundAmount,
          status: 'PENDING',
          description: `Deduction for refund: ${reason || 'Admin refund'}`,
          metadata: {
            refundTransactionId: transactionId,
            deductionReason: reason
          }
        }
      });

      // Notify instructor
      if (transaction.booking?.instructor?.phone) {
        await smsService.sendSMS({
          to: transaction.booking.instructor.phone,
          message: `A refund of $${refundAmount.toFixed(2)} has been processed and will be deducted from your next payout. Reason: ${reason || 'Admin refund'}`
        });
      }
    }

    // Notify client
    if (transaction.booking?.client.phone) {
      await smsService.sendSMS({
        to: transaction.booking.client.phone,
        message: `Your refund of $${refundAmount.toFixed(2)} has been processed and will be returned to your payment method within 5-10 business days.`
      });
    }

    return NextResponse.json({
      success: true,
      refund,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
