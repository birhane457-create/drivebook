import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructorId = session.user.instructorId;

    // FIXED: Use database aggregation instead of loading all data
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      completedStats,
      pendingStats,
      thisMonthStats,
      lastMonthStats,
      scheduledBookings,
      recentTransactions
    ] = await Promise.all([
      // Completed earnings
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED'
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // Pending payouts
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'PENDING'
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // This month earnings
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          createdAt: { gte: startOfThisMonth }
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // Last month earnings
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // Upcoming bookings (SCHEDULED - will earn when taught)
      prisma.booking.findMany({
        where: {
          instructorId,
          status: 'CONFIRMED',
          startTime: { gte: now }
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          duration: true,
          price: true,
          platformFee: true,
          instructorPayout: true,
          client: {
            select: {
              name: true
            }
          },
          isPackageBooking: true,
          parentBookingId: true
        },
        orderBy: {
          startTime: 'asc'
        },
        take: 20
      }),
      // Recent transactions (actual lessons only, not package purchases)
      (prisma as any).transaction.findMany({
        where: { 
          instructorId
        },
        include: {
          booking: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              isPackageBooking: true,
              packageHours: true,
              parentBookingId: true,
              client: {
                select: {
                  name: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    // Filter out package purchase transactions (parent bookings)
    const lessonTransactions = recentTransactions.filter((t: any) => {
      if (!t.booking) return true; // Keep non-booking transactions
      // Exclude parent package bookings (these are purchases, not lessons)
      if (t.booking.isPackageBooking && !t.booking.parentBookingId) {
        return false;
      }
      return true;
    });

    // Calculate scheduled bookings totals
    const scheduledTotal = scheduledBookings.reduce((sum, b) => sum + (b.instructorPayout || 0), 0);
    const scheduledCount = scheduledBookings.length;

    return NextResponse.json({
      // EARNED - Money from lessons already taught (excluding package purchases)
      totalEarnings: completedStats._sum.instructorPayout || 0,
      pendingPayouts: pendingStats._sum.instructorPayout || 0,
      completedPayouts: completedStats._sum.instructorPayout || 0,
      thisMonthEarnings: thisMonthStats._sum.instructorPayout || 0,
      lastMonthEarnings: lastMonthStats._sum.instructorPayout || 0,
      
      // Transactions with full details (filtered to exclude package purchases)
      transactions: lessonTransactions,
      
      // SCHEDULED - Lessons confirmed to teach (will earn when taught)
      scheduledBookings: scheduledBookings.map(booking => ({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration,
        clientName: booking.client.name,
        instructorPayout: booking.instructorPayout,
        price: booking.price,
        isFromPackage: booking.isPackageBooking && booking.parentBookingId !== null
      })),
      scheduledTotal,
      scheduledCount
    });
  } catch (error) {
    console.error('Earnings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}
