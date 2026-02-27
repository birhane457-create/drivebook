import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'month';

    // Calculate date range
    let startDate: Date | null = null;
    const endDate = endOfDay(new Date());

    switch (period) {
      case 'week':
        startDate = startOfWeek(new Date());
        break;
      case 'year':
        startDate = startOfYear(new Date());
        break;
      case 'all':
        startDate = null; // No filter - all time
        break;
      case 'month':
      default:
        startDate = startOfMonth(new Date());
    }

    // Get instructor's commission rate
    const instructor = await prisma.instructor.findUnique({
      where: { id: decoded.instructorId },
      select: { commissionRate: true }
    });

    const commissionRate = instructor?.commissionRate || 15;

    // Get bookings in period (for counts only)
    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: decoded.instructorId,
        ...(startDate && {
          startTime: {
            gte: startDate,
            lte: endDate,
          }
        })
      },
      select: {
        status: true
      }
    });

    // Calculate booking counts
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length;
    const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED').length;
    const pendingBookings = bookings.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED').length;

    // FIXED: Use Transaction table like earnings API does
    const completedTransactions = await (prisma as any).transaction.aggregate({
      where: {
        instructorId: decoded.instructorId,
        status: 'COMPLETED',
        ...(startDate && {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        })
      },
      _sum: { 
        amount: true,
        platformFee: true,
        instructorPayout: true
      }
    });

    // Use transaction data (same as earnings API)
    const grossRevenue = completedTransactions._sum.amount || 0;
    const commission = completedTransactions._sum.platformFee || 0;
    const netEarnings = completedTransactions._sum.instructorPayout || 0;

    // Count clients CREATED in period (not just clients with bookings)
    const newClients = await prisma.client.count({
      where: {
        instructorId: decoded.instructorId,
        ...(startDate && {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        })
      }
    });

    // Calculate completion rate
    const completionRate = totalBookings > 0 
      ? Math.round((completedBookings / totalBookings) * 1000) / 10 
      : 0;

    // Get average rating (placeholder - implement when Review model is added)
    const averageRating = 5.0;

    return NextResponse.json({
      period,
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      grossRevenue,
      commission,
      netEarnings,
      commissionRate,
      newClients,
      averageRating,
      completionRate,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
