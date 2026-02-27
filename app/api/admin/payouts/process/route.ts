import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { logAuditAction } from '@/lib/services/audit';
import { payoutRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { recordPayout } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccountName, AccountType } from '@/lib/services/ledger';
import { z } from 'zod';

// Input validation
const payoutSchema = z.object({
  instructorId: z.string().min(1, 'Instructor ID is required'),
  transactionIds: z.array(z.string()).optional(), // Optional: specific transactions to pay
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Rate limiting for payout operations
    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
      req.headers.get('x-forwarded-for'),
      'payout'
    );
    
    const rateLimitResult = await checkRateLimit(payoutRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    // FIXED: Input validation
    const body = await req.json();
    const { instructorId, transactionIds } = payoutSchema.parse(body);

    // Get instructor details
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { name: true, phone: true }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // FIXED: Use transaction wrapper with ledger integration
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      
      // FIXED: Only get pending transactions for COMPLETED bookings that have ended
      const where: any = {
        instructorId,
        status: 'PENDING',
        booking: {
          status: 'COMPLETED',
          endTime: { lte: now } // Lesson must have ended
        }
      };
      
      // If specific transactions selected, filter by IDs
      if (transactionIds && transactionIds.length > 0) {
        where.id = { in: transactionIds };
      }
      
      const pendingTransactions = await (tx as any).transaction.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              endTime: true
            }
          }
        }
      });

      if (pendingTransactions.length === 0) {
        throw new Error('No eligible transactions for payout');
      }

      // Verify all bookings are completed and in the past
      const ineligible = pendingTransactions.filter((t: any) => 
        t.booking.status !== 'COMPLETED' || t.booking.endTime > now
      );
      
      if (ineligible.length > 0) {
        throw new Error(`${ineligible.length} transactions are not eligible (booking not completed or in future)`);
      }

      // Calculate total payout
      const totalPayout = pendingTransactions.reduce(
        (sum: number, t: any) => sum + t.instructorPayout,
        0
      );

      // TODO: Integrate with Stripe Connect for real payout
      // const stripePayout = await stripe.payouts.create({
      //   amount: Math.round(totalPayout * 100),
      //   currency: 'usd',
      //   destination: instructor.stripeAccountId,
      //   metadata: {
      //     instructorId,
      //     transactionCount: pendingTransactions.length
      //   }
      // });
      const stripePayoutId = `po_simulated_${Date.now()}`; // TODO: Replace with real Stripe payout ID

      // Create payout record FIRST
      const payout = await (tx as any).payout.create({
        data: {
          instructorId,
          amount: totalPayout,
          stripePayoutId,
          status: 'paid', // TODO: Change to 'pending' until Stripe confirms
          transactionIds: pendingTransactions.map((t: any) => t.id),
          processedBy: session.user.id,
          paidAt: now
        }
      });

      // NEW: Record payout in ledger (2 entries)
      try {
        await recordPayout(tx, {
          payoutId: payout.id,
          instructorId,
          amount: totalPayout,
          stripePayoutId,
          transactionIds: pendingTransactions.map((t: any) => t.id),
          createdBy: session.user.id
        });
      } catch (ledgerError) {
        console.error('[Ledger] Failed to record payout:', ledgerError);
        // Continue with old system, but log error
      }

      // Update all transactions to COMPLETED
      await (tx as any).transaction.updateMany({
        where: {
          id: { in: pendingTransactions.map((t: any) => t.id) }
        },
        data: {
          status: 'COMPLETED',
          processedAt: now
        }
      });

      // Log the action
      await logAuditAction(tx, {
        action: 'PROCESS_PAYOUT',
        adminId: session.user.id,
        targetType: 'PAYOUT',
        targetId: payout.id,
        metadata: {
          instructorId,
          instructorName: instructor.name,
          amount: totalPayout,
          transactionCount: pendingTransactions.length,
          transactionIds: pendingTransactions.map((t: any) => t.id),
          stripePayoutId,
          adminEmail: session.user.email,
          selectedTransactions: transactionIds ? true : false
        },
        req,
      });

      return { payout, totalPayout, transactionCount: pendingTransactions.length };
    }, {
      maxWait: 5000,
      timeout: 15000,
    });

    // Verify ledger balance after payout
    try {
      const payableBalance = await getAccountBalance(
        buildAccountName(AccountType.INSTRUCTOR_PAYABLE, instructorId)
      );
      
      const paidBalance = await getAccountBalance(
        buildAccountName(AccountType.INSTRUCTOR_PAID, instructorId)
      );
      
      console.log('[Ledger] Payout verification', {
        instructorId,
        payableBalance,
        paidBalance,
        justPaid: result.totalPayout
      });
    } catch (verifyError) {
      console.error('[Ledger] Balance verification failed:', verifyError);
    }

    // Send SMS notification to instructor
    if (instructor.phone) {
      try {
        await smsService.sendSMS({
          to: instructor.phone,
          message: `DriveBook: Payout processed! $${result.totalPayout.toFixed(2)} has been transferred to your account. ${result.transactionCount} transactions completed.`
        });
      } catch (err) {
        console.error('Failed to send SMS to instructor:', err);
      }
    }

    return NextResponse.json({
      success: true,
      instructorName: instructor.name,
      transactionCount: result.transactionCount,
      totalPayout: result.totalPayout,
      payoutId: result.payout.id,
      message: `Payout of $${result.totalPayout.toFixed(2)} processed for ${instructor.name}`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Payout processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payout' },
      { status: 500 }
    );
  }
}
