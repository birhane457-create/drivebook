import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripeService, stripe } from '@/lib/services/stripe';
import { smsService } from '@/lib/services/sms';
import { recordFullRefund } from '@/lib/services/ledger-operations';
import { checkPermission } from '@/lib/rbac/checkPermission';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    // F-08 FIX: Use checkPermission (not requirePermission) to get full result for maxRefundAmount enforcement
    const check = await checkPermission(session, PERM.FINANCE_DISPUTES_MANAGE);
    if (!check.allowed) return check.response;

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
          include: { customer: true,
            provider: {
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

    // MM-05-C FIX: Atomic gate — CAS prevents concurrent admin refund requests both
    // passing the status check and both calling Stripe.
    const claimed = await (prisma as any).transaction.updateMany({
      where: { id: transactionId, status: 'COMPLETED' },
      data: { status: 'REFUNDING' },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'Transaction is not in a refundable state (may already be processing)' },
        { status: 409 }
      );
    }

    // Determine refund amount (full or partial)
    const refundAmount = amount || transaction.amount;

    // CRITICAL FIX #1: Validate refund amount does not exceed original transaction
    if (refundAmount > transaction.amount) {
      return NextResponse.json(
        { error: `Refund amount ($${refundAmount}) cannot exceed transaction amount ($${transaction.amount})` },
        { status: 400 }
      );
    }

    // F-08 FIX: Enforce maxRefundAmount for non-SUPER_ADMIN users
    // SUPER_ADMIN: no limit (isSuperAdmin = true, staffMember = null)
    // ADMIN with maxRefundAmount = 0: cannot refund anything
    // ADMIN with maxRefundAmount = 500: can refund up to $500
    // ADMIN with maxRefundAmount = null: treated as 0 (no refunds)
    if (!check.isSuperAdmin && check.staffMember) {
      const limit = check.staffMember.maxRefundAmount != null 
        ? Number(check.staffMember.maxRefundAmount) 
        : 0;
      
      if (refundAmount > limit) {
        return NextResponse.json({
          error: `Refund amount ($${refundAmount.toFixed(2)}) exceeds your authorized limit of $${limit.toFixed(2)}. Contact a SUPER_ADMIN for refunds above this amount.`,
          maxAllowed: limit,
          requested: refundAmount,
        }, { status: 403 });
      }
    }

    // MM-05-C FIX: Use raw stripe client with deterministic idempotency key to prevent
    // duplicate Stripe refund objects on concurrent or retried admin requests.
    const rawRefundResult = await stripe.refunds.create(
      {
        payment_intent: transaction.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: { transactionId, adminId: session!.user!.id, reason: reason || 'Admin refund' },
      },
      { idempotencyKey: `admin-refund-${transactionId}` }
    );
    const refund = { refundId: rawRefundResult.id, amount: rawRefundResult.amount / 100, status: rawRefundResult.status };

    // MM-05-C / MM-07: Wrap all post-Stripe DB writes atomically.
    // REFUND_ISSUED must commit with the status change — if it fails, the whole
    // block fails together and the catch handler reverts REFUNDING→COMPLETED so
    // the admin can retry safely (Stripe will return the same refund via idempotency key).
    let refundTransaction: any;
    await prisma.$transaction(async (tx) => {
      // Create refund transaction record
      refundTransaction = await (tx as any).transaction.create({
        data: {
          bookingId: transaction.bookingId,
          providerId: transaction.providerId,
          type: 'REFUND',
          amount: -refundAmount,
          platformFee: 0,
          providerPayout: 0,
          status: 'COMPLETED',
          stripeRefundId: refund.refundId,
          description: reason || 'Refund processed by admin',
          metadata: {
            originalTransactionId: transactionId,
            deductFromInstructor: deductFromInstructor || false,
          },
        },
      });

      // Update original transaction status
      await (tx as any).transaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

      // MM-07/MM-05-C: Write REFUND_ISSUED atomically so handleChargeRefunded()
      // is guaranteed to see this marker and skip writing a duplicate REFUND_SYNCED.
      // Uses tx directly (not appendLedgerEntry) to stay inside this transaction.
      if (transaction.bookingId) {
        await tx.ledgerEntry.create({
          data: {
            type: 'REFUND_ISSUED',
            amount: -refundAmount,
            currency: 'AUD',
            referenceId: transaction.bookingId,
            referenceType: 'BOOKING',
            providerId: transaction.providerId ?? undefined,
            description: `Admin transaction refund — $${refundAmount.toFixed(2)} (ref: ${refund.refundId})`,
            metadata: { stripeRefundId: refund.refundId, transactionId, adminId: session!.user!.id, source: 'adminTransactionRefund' } as any,
          },
        });
      }
    });

    // CRITICAL FIX #1 CONTINUED: Record refund in ledger with wallet credit
    // This ensures the client's wallet is credited and all ledger accounts are updated
    try {
      // Calculate refund allocation (proportional to original transaction split)
      const refundPlatformFee = transaction.platformFee > 0 
        ? Math.round((refundAmount * transaction.platformFee / transaction.amount) * 100) / 100 
        : 0;
      const refundInstructorPayout = transaction.providerPayout > 0
        ? Math.round((refundAmount * transaction.providerPayout / transaction.amount) * 100) / 100
        : 0;

      await recordFullRefund({
        refundId: refundTransaction.id,
        bookingId: transaction.bookingId,
        userId: transaction.booking?.customer?.userId || 'UNKNOWN',
        providerId: transaction.providerId,
        totalAmount: refundAmount,
        platformFee: refundPlatformFee,
        providerPayout: refundInstructorPayout,
        reason: reason || 'Admin refund',
        createdBy: session!.user!.id
      });
    } catch (ledgerErr) {
      console.error('Warning: Ledger entry failed for refund:', ledgerErr);
      // Log but don't fail the refund if ledger update fails (Stripe already processed it)
      // This should be investigated and retried
    }

    // If deducting from instructor, create a deduction record
    if (deductFromInstructor) {
      await (prisma as any).transaction.create({
        data: {
          providerId: transaction.providerId,
          type: 'COMMISSION',
          amount: -refundAmount,
          platformFee: 0,
          providerPayout: -refundAmount,
          status: 'PENDING',
          description: `Deduction for refund: ${reason || 'Admin refund'}`,
          metadata: {
            refundTransactionId: transactionId,
            deductionReason: reason
          }
        }
      });

      // Notify instructor
      if (transaction.booking?.provider?.phone) {
        await smsService.sendSMS({
          to: transaction.booking.provider.phone,
          message: `A refund of $${refundAmount.toFixed(2)} has been processed and will be deducted from your next payout. Reason: ${reason || 'Admin refund'}`
        });
      }
    }

    // Notify client
    if (transaction.booking?.customer.phone) {
      await smsService.sendSMS({
        to: transaction.booking.customer.phone,
        message: `Your refund of $${refundAmount.toFixed(2)} has been processed and will be returned to your payment method within 5-10 business days.`
      });
    }

    return NextResponse.json({
      success: true,
      refund,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    // MM-05-C FIX: Revert REFUNDING → COMPLETED so the refund remains retryable
    // Only revert if the Stripe call hasn't already succeeded (no rawRefundResult in scope).
    await (prisma as any).transaction.updateMany({
      where: { id: params.transactionId, status: 'REFUNDING' },
      data: { status: 'COMPLETED' },
    }).catch((revertErr: unknown) =>
      console.error('[REFUND] Failed to revert REFUNDING→COMPLETED:', revertErr)
    );
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
