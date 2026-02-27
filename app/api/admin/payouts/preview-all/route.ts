import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
/**
 * Preview bulk payout operation
 * Shows what will happen before actually processing
 * CRITICAL: Always call this before process-all
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all pending transactions grouped by instructor
    const pendingTransactions = await (prisma as any).transaction.findMany({
      where: { status: 'PENDING' },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    if (pendingTransactions.length === 0) {
      return NextResponse.json({
        totalInstructors: 0,
        totalAmount: 0,
        totalTransactions: 0,
        instructors: [],
        message: 'No pending transactions to process'
      });
    }

    // Group by instructor
    const instructorMap = new Map<string, {
      id: string;
      name: string;
      phone: string;
      email: string;
      amount: number;
      transactionCount: number;
      transactionIds: string[];
    }>();

    pendingTransactions.forEach((transaction: any) => {
      const instructorId = transaction.instructorId;
      
      if (!instructorMap.has(instructorId)) {
        instructorMap.set(instructorId, {
          id: instructorId,
          name: transaction.instructor.name,
          phone: transaction.instructor.phone,
          email: transaction.instructor.user.email,
          amount: 0,
          transactionCount: 0,
          transactionIds: []
        });
      }
      
      const instructor = instructorMap.get(instructorId)!;
      instructor.amount += transaction.instructorPayout;
      instructor.transactionCount += 1;
      instructor.transactionIds.push(transaction.id);
    });

    const instructors = Array.from(instructorMap.values())
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    const totalAmount = instructors.reduce((sum, i) => sum + i.amount, 0);

    // Generate confirmation code (used to verify preview matches execution)
    const confirmationCode = `PROCESS-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return NextResponse.json({
      totalInstructors: instructors.length,
      totalAmount,
      totalTransactions: pendingTransactions.length,
      instructors,
      confirmationCode,
      generatedAt: new Date().toISOString(),
      warning: 'This is a preview. Use the confirmation code to execute.',
      message: `Ready to process ${instructors.length} payouts totaling $${totalAmount.toFixed(2)}`
    });
  } catch (error) {
    console.error('Payout preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
