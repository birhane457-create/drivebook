import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve instructorId — prefer JWT value, fall back to userId lookup
    let instructorId = session.user.instructorId;
    if (!instructorId) {
      const found = await prisma.instructor.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!found) {
        return NextResponse.json({ error: 'Instructor not found' }, { status: 401 });
      }
      instructorId = found.id;
    }

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
          clientName: true,
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

    // Get instructor hourly rate for fallback calculation
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { hourlyRate: true }
    });
    const hourlyRate = instructor?.hourlyRate || 0;

    // Calculate scheduled bookings totals
    const scheduledTotal = scheduledBookings.reduce((sum, b) => {
      let payout = b.instructorPayout;
      if (!payout || payout === 0) {
        // Fallback 1: derive from price
        if (b.price > 0) {
          payout = b.price * 0.9;
        } else if (b.startTime && b.endTime) {
          // Fallback 2: derive from duration × hourlyRate
          const hours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 3600000;
          payout = hours * hourlyRate * 0.9;
        }
      }
      return sum + (payout || 0);
    }, 0);
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
      scheduledBookings: scheduledBookings.map(booking => {
        let payout = booking.instructorPayout;
        if (!payout || payout === 0) {
          if (booking.price > 0) {
            payout = booking.price * 0.9;
          } else if (booking.startTime && booking.endTime) {
            const hours = (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 3600000;
            payout = hours * hourlyRate * 0.9;
          }
        }
        return {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          clientName: booking.client?.name ?? (booking as any).clientName ?? 'Guest',
          instructorPayout: payout || 0,
          price: booking.price,
          isFromPackage: booking.isPackageBooking && booking.parentBookingId !== null
        };
      }),
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
