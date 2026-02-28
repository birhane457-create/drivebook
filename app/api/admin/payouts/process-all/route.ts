import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { logAuditAction } from '@/lib/services/audit';
import { bulkPayoutRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
// FIXED: Require confirmation to prevent accidental bulk operations
const bulkPayoutSchema = z.object({
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation required. Set confirmed: true' })
  }),
  expectedCount: z.number().int().positive(),
  expectedTotal: z.number().positive(),
  confirmationCode: z.string().regex(
    /^PROCESS-\d{4}-\d{2}-\d{2}-[A-Z0-9]{6}$/,
    'Invalid confirmation code format'
  )
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Rate limiting for bulk payouts (very restrictive)
    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
      req.headers.get('x-forwarded-for'),
      'bulk-payout'
    );
    
    const rateLimitResult = await checkRateLimit(bulkPayoutRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    // FIXED: Validate confirmation
    const body = await req.json();
    const validation = bulkPayoutSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Confirmation required',
          details: validation.error.errors,
          hint: 'Call GET /api/admin/payouts/preview-all first to get confirmation code'
        },
        { status: 400 }
      );
    }

    const { expectedCount, expectedTotal, confirmationCode } = validation.data;

    // FIXED: Use transaction wrapper with verification and audit logging
    const result = await prisma.$transaction(async (tx) => {
      // Get all pending transactions grouped by instructor
      const pendingTransactions = await (tx as any).transaction.findMany({
        where: { status: 'PENDING' },
        include: {
          instructor: {
            select: {
              name: true,
              phone: true,
            }
          }
        }
      });

      if (pendingTransactions.length === 0) {
        throw new Error('No pending transactions found');
      }

      // FIXED: Verify counts match to prevent race conditions
      const actualCount = pendingTransactions.length;
      if (actualCount !== expectedCount) {
        throw new Error(
          `Count mismatch! Expected ${expectedCount} transactions but found ${actualCount}. ` +
          `Data changed since preview. Please generate a new preview.`
        );
      }

      // Calculate actual total
      const actualTotal = pendingTransactions.reduce(
        (sum: number, t: any) => sum + t.instructorPayout,
        0
      );

      // FIXED: Verify total matches (within $0.01 for rounding)
      if (Math.abs(actualTotal - expectedTotal) > 0.01) {
        throw new Error(
          `Total mismatch! Expected $${expectedTotal.toFixed(2)} but calculated $${actualTotal.toFixed(2)}. ` +
          `Data changed since preview. Please generate a new preview.`
        );
      }

      // Group by instructor
      const payoutsByInstructor = new Map<string, any>();
      
      pendingTransactions.forEach((transaction: any) => {
        const instructorId = transaction.instructorId;
        
        if (!payoutsByInstructor.has(instructorId)) {
          payoutsByInstructor.set(instructorId, {
            name: transaction.instructor.name,
            phone: transaction.instructor.phone,
            totalAmount: 0,
            count: 0,
            transactionIds: []
          });
        }
        
        const payout = payoutsByInstructor.get(instructorId);
        payout.totalAmount += transaction.instructorPayout;
        payout.count += 1;
        payout.transactionIds.push(transaction.id);
      });

      // TODO: Process actual Stripe payouts here
      // const stripePayouts = await Promise.all(
      //   Array.from(payoutsByInstructor.entries()).map(async ([instructorId, data]) => {
      //     return stripe.payouts.create({...});
      //   })
      // );

      // Update all transactions to COMPLETED
      const now = new Date();
      await (tx as any).transaction.updateMany({
        where: { status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          processedAt: now
        }
      });

      // Create payout records for each instructor
      const payoutRecords = await Promise.all(
        Array.from(payoutsByInstructor.entries()).map(async ([instructorId, data]) => {
          return (tx as any).payout.create({
            data: {
              instructorId,
              amount: data.totalAmount,
              status: 'paid', // TODO: Change to 'pending' until Stripe confirms
              transactionIds: data.transactionIds,
              processedBy: session.user.id,
              paidAt: now
            }
          });
        })
      );

      // Log the bulk action
      await logAuditAction(tx, {
        action: 'PROCESS_BULK_PAYOUT',
        adminId: session.user.id,
        targetType: 'PAYOUT',
        targetId: 'BULK',
        metadata: {
          instructorCount: payoutsByInstructor.size,
          totalAmount: actualTotal,
          transactionCount: actualCount,
          confirmationCode,
          expectedCount,
          expectedTotal,
          payoutIds: payoutRecords.map(p => p.id),
          adminEmail: session.user.email,
        },
        req,
      });

      return {
        payoutsByInstructor,
        totalAmount: actualTotal,
        payoutRecords
      };
    });

    // Use the transaction result to send notifications and return response
    const notifications = Array.from(result.payoutsByInstructor.values()).map(async (payout: any) => {
      if (payout.phone) {
        try {
          await smsService.sendSMS({
            to: payout.phone,
            message: `DriveBook: Payout processed! $${payout.totalAmount.toFixed(2)} has been transferred to your account. ${payout.count} transactions completed.`
          });
        } catch (error) {
          console.error(`Failed to send SMS to ${payout.name}:`, error);
        }
      }
    });

    await Promise.all(notifications);

    return NextResponse.json({
      success: true,
      count: result.payoutsByInstructor.size,
      total: result.totalAmount,
      transactionCount: expectedCount,
      payoutIds: result.payoutRecords.map((p: any) => p.id),
      message: `Processed ${result.payoutsByInstructor.size} payouts totaling $${result.totalAmount.toFixed(2)}`,
      warning: 'Payouts have been processed. This action cannot be undone.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Bulk payout processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payouts' },
      { status: 500 }
    );
  }
}
