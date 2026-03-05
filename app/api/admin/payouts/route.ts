import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Only get transactions for COMPLETED bookings that have ended
    const now = new Date();
    
    const pendingTransactions = await (prisma as any).transaction.findMany({
      where: { 
        status: 'PENDING',
        // Only include transactions for completed bookings
        booking: {
          status: 'COMPLETED',
          endTime: { lte: now } // Lesson must have ended
        }
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            instructor: {
              select: {
                id: true,
                name: true,
              }
            },
            client: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by instructor
    const payoutsByInstructor = new Map<string, any>();
    
    pendingTransactions.forEach((transaction: any) => {
      const instructorId = transaction.instructorId;
      const instructorName = transaction.booking.instructor.name;
      
      if (!payoutsByInstructor.has(instructorId)) {
        payoutsByInstructor.set(instructorId, {
          instructorId,
          instructorName,
          totalAmount: 0,
          transactionCount: 0,
          transactions: [],
        });
      }
      
      const payout = payoutsByInstructor.get(instructorId);
      payout.totalAmount += transaction.instructorPayout;
      payout.transactionCount += 1;
      payout.transactions.push({
        id: transaction.id,
        bookingId: transaction.bookingId,
        amount: transaction.amount,
        instructorPayout: transaction.instructorPayout,
        createdAt: transaction.createdAt,
        bookingDate: transaction.booking.startTime,
        bookingEndDate: transaction.booking.endTime,
        clientName: transaction.booking.client?.name || 'Unknown',
        bookingStatus: transaction.booking.status,
      });
    });

    const pendingPayouts = Array.from(payoutsByInstructor.values());
    const totalPending = pendingPayouts.reduce((sum, p) => sum + p.totalAmount, 0);

    // Calculate completed payouts this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const completedThisMonth = await (prisma as any).transaction.aggregate({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startOfMonth } // Use updatedAt since processedAt doesn't exist
      },
      _sum: {
        instructorPayout: true
      }
    });

    // Get count of future/pending bookings (not eligible for payout)
    const futureBookingsCount = await prisma.booking.count({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          { endTime: { gt: now } }, // Future bookings
          { status: { not: 'COMPLETED' } } // Not completed
        ]
      }
    });

    return NextResponse.json({
      pendingPayouts,
      totalPending,
      completedThisMonth: completedThisMonth._sum.instructorPayout || 0,
      futureBookingsCount,
      eligibilityCriteria: {
        bookingStatus: 'COMPLETED',
        bookingEndTime: 'Must be in the past',
        transactionStatus: 'PENDING'
      }
    });
  } catch (error) {
    console.error('Payouts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}
