import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// The Transaction model is accessed via (prisma as any).transaction because it may not
// be present in older generated Prisma client types. Once types are regenerated after
// the next migration, replace (prisma as any).transaction with prisma.transaction.

/** Aggregate result shape returned by Prisma for transaction queries */
interface TxAggregate {
  _sum: { instructorPayout: number | null; amount?: number | null; platformFee?: number | null };
  _count: number;
}

/** Shape of a scheduled platform booking selected from the DB */
interface ScheduledBooking {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  price: number;
  platformFee: number | null;
  instructorPayout: number | null;
  client: { name: string | null } | null;
  isPackageBooking: boolean;
  parentBookingId: string | null;
}

/** Shape of a scheduled offline booking selected from the DB */
interface ScheduledOfflineBooking {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  offlineAmountPaid: number | null;
  clientName: string | null;
  offlinePaymentMethod: string | null;
}

/** Shape of a transaction row returned by findMany */
interface TxRow {
  id: string;
  amount: number;
  platformFee: number;
  instructorPayout: number;
  status: string;
  description?: string;
  createdAt: Date;
  booking: {
    id: string;
    startTime: Date;
    endTime: Date | null;
    isPackageBooking: boolean;
    packageHours: number | null;
    parentBookingId: string | null;
    source: string | null;
    client: { name: string | null } | null;
  } | null;
}


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
      completedPlatformStats,
      completedOfflineStats,
      pendingStats,
      thisMonthStats,
      thisMonthPlatformStats,
      thisMonthOfflineStats,
      lastMonthStats,
      scheduledBookings,
      scheduledOfflineBookings,
      recentTransactions
    ] = (await Promise.all([      // Completed earnings (all)
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED'
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // Completed earnings (platform only)
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          booking: {
            source: { not: 'offline' }
          }
        },
        _sum: { instructorPayout: true, amount: true, platformFee: true },
        _count: true
      }),
      // Completed earnings (offline only)
      prisma.booking.aggregate({
        where: {
          instructorId,
          source: 'offline',
          status: 'COMPLETED'
        },
        _sum: { offlineAmountPaid: true },
        _count: true
      }),
      // Pending payouts
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'PENDING',
          booking: {
            source: { not: 'offline' }
          }
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // This month earnings (all)
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          createdAt: { gte: startOfThisMonth }
        },
        _sum: { instructorPayout: true },
        _count: true
      }),
      // This month earnings (platform only)
      (prisma as any).transaction.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          createdAt: { gte: startOfThisMonth },
          booking: {
            source: { not: 'offline' }
          }
        },
        _sum: { instructorPayout: true, amount: true, platformFee: true },
        _count: true
      }),
      // This month earnings (offline only)
      prisma.booking.aggregate({
        where: {
          instructorId,
          source: 'offline',
          status: 'COMPLETED',
          createdAt: { gte: startOfThisMonth }
        },
        _sum: { offlineAmountPaid: true },
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
      // Upcoming platform bookings (SCHEDULED - will earn when taught)
      prisma.booking.findMany({
        where: {
          instructorId,
          source: { not: 'offline' },
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
        } as any,
        orderBy: {
          startTime: 'asc'
        },
        take: 20
      }),
      // Upcoming offline bookings
      prisma.booking.findMany({
        where: {
          instructorId,
          source: 'offline',
          status: 'CONFIRMED',
          startTime: { gte: now }
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          duration: true,
          offlineAmountPaid: true,
          clientName: true,
          offlinePaymentMethod: true
        } as any,
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
              source: true,
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
    ])) as unknown as [
      TxAggregate, TxAggregate, // completedStats, completedPlatformStats
      { _sum: { offlineAmountPaid: number | null }; _count: number }, // completedOfflineStats
      TxAggregate, TxAggregate, TxAggregate, // pendingStats, thisMonthStats, thisMonthPlatformStats
      { _sum: { offlineAmountPaid: number | null }; _count: number }, // thisMonthOfflineStats
      TxAggregate, // lastMonthStats
      ScheduledBooking[],
      ScheduledOfflineBooking[],
      TxRow[]
    ];

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

    // Calculate platform scheduled bookings totals
    const platformScheduledTotal = scheduledBookings.reduce((sum, b) => {
      let payout = b.instructorPayout;
      if (!payout || payout === 0) {
        if (b.price > 0) {
          payout = b.price * 0.9;
        } else if (b.startTime && b.endTime) {
          const hours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 3600000;
          payout = hours * hourlyRate * 0.9;
        }
      }
      return sum + (payout || 0);
    }, 0);
    const platformScheduledCount = scheduledBookings.length;

    // Calculate offline scheduled bookings totals
    const offlineScheduledTotal = scheduledOfflineBookings.reduce((sum, b) => {
      return sum + (b.offlineAmountPaid || 0);
    }, 0);
    const offlineScheduledCount = scheduledOfflineBookings.length;

    return NextResponse.json({
      // ── PLATFORM EARNINGS (DriveBook-processed payments) ──
      platform: {
        totalEarnings: completedPlatformStats._sum.instructorPayout || 0,
        totalGross: completedPlatformStats._sum.amount || 0,
        totalFees: completedPlatformStats._sum.platformFee || 0,
        completedCount: completedPlatformStats._count || 0,
        thisMonthEarnings: thisMonthPlatformStats._sum.instructorPayout || 0,
        thisMonthGross: thisMonthPlatformStats._sum.amount || 0,
        thisMonthFees: thisMonthPlatformStats._sum.platformFee || 0,
        thisMonthCount: thisMonthPlatformStats._count || 0,
        pendingPayouts: pendingStats._sum.instructorPayout || 0,
        pendingCount: pendingStats._count || 0,
        scheduledTotal: platformScheduledTotal,
        scheduledCount: platformScheduledCount,
      },
      
      // ── OFFLINE EARNINGS (Self-reported, instructor-handled) ──
      offline: {
        totalLogged: completedOfflineStats._sum.offlineAmountPaid || 0,
        completedCount: completedOfflineStats._count || 0,
        thisMonthLogged: thisMonthOfflineStats._sum.offlineAmountPaid || 0,
        thisMonthCount: thisMonthOfflineStats._count || 0,
        scheduledTotal: offlineScheduledTotal,
        scheduledCount: offlineScheduledCount,
      },

      // ── COMBINED (for compatibility) ──
      totalEarnings: (completedPlatformStats._sum.instructorPayout || 0) + (completedOfflineStats._sum.offlineAmountPaid || 0),
      thisMonthEarnings: (thisMonthPlatformStats._sum.instructorPayout || 0) + (thisMonthOfflineStats._sum.offlineAmountPaid || 0),
      lastMonthEarnings: lastMonthStats._sum.instructorPayout || 0,
      
      // Transactions with full details (filtered to exclude package purchases, platform only)
      transactions: lessonTransactions,
      
      // SCHEDULED - Platform lessons confirmed to teach (will earn when taught)
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
          clientName: booking.client?.name ?? 'Guest',
          instructorPayout: payout || 0,
          price: booking.price,
          isFromPackage: booking.isPackageBooking && booking.parentBookingId !== null
        };
      }),
      scheduledTotal: platformScheduledTotal,
      scheduledCount: platformScheduledCount,

      // SCHEDULED OFFLINE - Offline lessons logged for future
      scheduledOffline: scheduledOfflineBookings.map(booking => ({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration,
        clientName: booking.clientName || 'Unknown',
        offlineAmountPaid: booking.offlineAmountPaid || 0,
        offlinePaymentMethod: booking.offlinePaymentMethod || 'unknown'
      }))
    });
  } catch (error) {
    console.error('Earnings fetch error:', error);
    console.error('Earnings error stack:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch earnings', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
