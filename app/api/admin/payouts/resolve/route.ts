import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payouts/resolve
 * Resolves a withheld or disputed transaction.
 *
 * body: {
 *   transactionId: string   — the booking Transaction id
 *   action: 'refund_client' | 'pay_instructor' | 'charge_instructor' | 'void'
 *   reason?: string
 * }
 *
 * Actions:
 *  refund_client    — credit client wallet back, mark transaction REFUNDED
 *  pay_instructor   — release payout to instructor despite cancellation/dispute
 *  charge_instructor — deduct penalty from instructor's next payout (creates negative adjustment)
 *  void             — cancel both sides, no money moves, mark CANCELLED
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transactionId, action, reason } = await req.json();
    if (!transactionId || !action) {
      return NextResponse.json({ error: 'transactionId and action required' }, { status: 400 });
    }

    const validActions = ['refund_client', 'pay_instructor', 'charge_instructor', 'void'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    // Load the transaction with booking + client wallet info
    const txn = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          select: {
            id: true, status: true, clientId: true, clientName: true, clientPhone: true,
            instructorId: true, price: true, startTime: true,
            instructor: { select: { id: true, name: true, phone: true } },
            client: { select: { id: true, userId: true, name: true } },
          },
        },
      },
    });

    if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const adminNote = `[Admin: ${session.user.email || session.user.id}] ${reason || action}`;
    const ref = `RESOLVE-${Date.now()}`;

    switch (action) {
      case 'refund_client': {
        // Credit client wallet back
        const userId = txn.booking?.client?.userId;
        if (!userId) return NextResponse.json({ error: 'Client has no user account — cannot refund wallet' }, { status: 422 });

        await prisma.$transaction(async (tx: any) => {
          // Find or create wallet
          let wallet = await tx.clientWallet.findUnique({ where: { userId } });
          if (!wallet) {
            wallet = await tx.clientWallet.create({ data: { userId, balance: 0 } });
          }

          // Credit wallet
          await tx.clientWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: txn.amount } },
          });

          // Wallet transaction record
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: txn.amount,
              description: `Refund — booking ${txn.bookingId?.slice(-6)} (${ref}). ${adminNote}`,
              status: 'CONFIRMED',
            },
          });

          // Mark booking transaction as REFUNDED
          await tx.transaction.update({
            where: { id: transactionId },
            data: { status: 'REFUNDED', description: `Refunded to client. ${adminNote}` },
          });
        });

        // SMS client if phone available
        if (txn.booking?.clientPhone) {
          try {
            await smsService.sendSMS({
              to: txn.booking.clientPhone,
              message: `DriveBook: A refund of $${txn.amount.toFixed(2)} has been added to your wallet for booking on ${new Date(txn.booking.startTime).toLocaleDateString('en-AU')}.`,
            });
          } catch (e) { console.error('SMS failed:', e); }
        }

        return NextResponse.json({ success: true, action, ref, message: `$${txn.amount.toFixed(2)} refunded to client wallet` });
      }

      case 'pay_instructor': {
        const payoutRef = `PAYOUT-MANUAL-${ref}`;
        await (prisma as any).transaction.update({
          where: { id: transactionId },
          data: {
            status: 'COMPLETED',
            description: `Manual payout approved. ${adminNote}. Ref: ${payoutRef}`,
          },
        });

        // SMS instructor
        if (txn.booking?.instructor?.phone) {
          try {
            await smsService.sendSMS({
              to: txn.booking.instructor.phone,
              message: `DriveBook: Payout of $${txn.instructorPayout.toFixed(2)} approved for booking on ${new Date(txn.booking.startTime).toLocaleDateString('en-AU')}. Ref: ${payoutRef}`,
            });
          } catch (e) { console.error('SMS failed:', e); }
        }

        return NextResponse.json({ success: true, action, ref: payoutRef, message: `$${txn.instructorPayout.toFixed(2)} payout released to instructor` });
      }

      case 'charge_instructor': {
        // Create a negative adjustment transaction against the instructor
        // This will appear as a deduction from their next payout
        const penaltyAmount = txn.instructorPayout;
        const chargeRef = `CHARGE-${ref}`;

        await (prisma as any).transaction.create({
          data: {
            bookingId: txn.bookingId,
            instructorId: txn.instructorId,
            type: 'INSTRUCTOR_PENALTY',
            status: 'PENDING',
            amount: -penaltyAmount,
            platformFee: 0,
            instructorPayout: -penaltyAmount,
            commissionRate: 0,
            description: `Instructor penalty — no-show/cancellation charge. ${adminNote}. Ref: ${chargeRef}`,
          } as any,
        });

        // Mark original transaction as CANCELLED (withheld, no payout)
        await (prisma as any).transaction.update({
          where: { id: transactionId },
          data: {
            status: 'CANCELLED',
            description: `Withheld — instructor charged penalty ${chargeRef}. ${adminNote}`,
          },
        });

        // SMS instructor
        if (txn.booking?.instructor?.phone) {
          try {
            await smsService.sendSMS({
              to: txn.booking.instructor.phone,
              message: `DriveBook: A penalty of $${penaltyAmount.toFixed(2)} has been applied to your account for a no-show/cancellation on ${new Date(txn.booking.startTime).toLocaleDateString('en-AU')}. Ref: ${chargeRef}`,
            });
          } catch (e) { console.error('SMS failed:', e); }
        }

        return NextResponse.json({ success: true, action, ref: chargeRef, message: `$${penaltyAmount.toFixed(2)} penalty charged to instructor` });
      }

      case 'void': {
        await (prisma as any).transaction.update({
          where: { id: transactionId },
          data: {
            status: 'CANCELLED',
            description: `Voided — no funds moved. ${adminNote}`,
          },
        });

        return NextResponse.json({ success: true, action, ref, message: 'Transaction voided — no funds moved' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Resolve error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
