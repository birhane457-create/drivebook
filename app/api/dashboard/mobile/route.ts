import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    console.log('[Dashboard Mobile API] Request received');
    
    // JWT authentication for mobile
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Dashboard Mobile API] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let instructorId: string;

    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
      
      console.log('[Dashboard Mobile API] Token decoded:', { userId: decoded.userId, role: decoded.role, instructorId: decoded.instructorId });
      
      if (!decoded.instructorId) {
        console.log('[Dashboard Mobile API] No instructorId in token');
        return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
      }
      
      instructorId = decoded.instructorId;
    } catch (error) {
      console.log('[Dashboard Mobile API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get instructor with stats
    const [instructor, upcomingBookings, totalClients, monthlyRevenue, recentClients] = await Promise.all([
      prisma.instructor.findUnique({
        where: { id: instructorId },
        select: {
          hourlyRate: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          instructorId,
          status: 'CONFIRMED',
          startTime: {
            gte: now,
          },
        },
        take: 5,
        orderBy: {
          startTime: 'asc',
        },
        include: {
          client: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.client.count({
        where: { instructorId },
      }),
      prisma.booking.aggregate({
        where: {
          instructorId,
          status: 'COMPLETED',
          startTime: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          price: true,
        },
      }),
      prisma.client.findMany({
        where: { instructorId },
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      }),
    ]);

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Count all upcoming lessons (not just the 5 we're showing)
    const upcomingCount = await prisma.booking.count({
      where: {
        instructorId,
        status: 'CONFIRMED',
        startTime: {
          gte: now,
        },
      },
    });

    // Format upcoming bookings
    const formattedBookings = upcomingBookings.map((booking) => {
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      
      return {
        id: booking.id,
        clientName: booking.client.name,
        date: startDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        time: startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }) + ' - ' + endDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        location: booking.pickupAddress || '',
      };
    });

    return NextResponse.json({
      upcomingLessons: upcomingCount,
      totalClients,
      monthlyRevenue: Math.round(monthlyRevenue._sum?.price || 0),
      hourlyRate: instructor.hourlyRate,
      upcomingBookings: formattedBookings,
      recentClients: recentClients.map(client => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
      })),
    });
  } catch (error) {
    console.error('[Dashboard Mobile API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
