import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        clients: {
          orderBy: { id: 'desc' }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the most recent client record (for display details)
    const clientRecord = user.clients[0];

    // Collect all client IDs linked to this user
    const clientIds = user.clients.map((c) => c.id);

    // Get user's bookings via clientId only
    const bookingsRaw = await prisma.booking.findMany({
      where: clientIds.length > 0
        ? { clientId: { in: clientIds } }
        : { clientId: null }, // Return empty if no client IDs
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            hourlyRate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // De-duplicate bookings in case a record matches both clientId and clientEmail
    const bookingMap = new Map<string, typeof bookingsRaw[number]>();
    for (const b of bookingsRaw) {
      bookingMap.set(b.id, b);
    }
    const bookings = Array.from(bookingMap.values());

    const now = new Date();
    const upcomingBookings = bookings.filter(b => {
      if (!b.startTime) return false;
      // Only count CONFIRMED bookings as upcoming
      return b.startTime > now && (b.status === 'CONFIRMED' || b.status === 'PENDING');
    });
    const pastBookings = bookings.filter(b => {
      if (!b.startTime) return false;
      return b.startTime <= now && b.status === 'COMPLETED';
    });

    const activeBookings = bookings.filter(b => 
      b.status !== 'CANCELLED' && b.status !== 'EXPIRED'
    );

    return NextResponse.json({
      user: {
        name: clientRecord?.name || user.name || user.email.split('@')[0],
        email: user.email,
        phone: clientRecord?.phone || '',
        address: clientRecord?.defaultPickupAddress || ''
      },
      bookings: activeBookings.map(b => {
        // Map database status to frontend status
        let displayStatus = 'upcoming';
        if (b.status === 'COMPLETED') {
          displayStatus = 'completed';
        } else if (b.status === 'PENDING_PAYMENT') {
          displayStatus = 'pending_payment';
        } else if (b.startTime && b.startTime <= now) {
          displayStatus = 'completed';
        }
        
        return {
          id: b.id,
          date: b.startTime ? b.startTime.toISOString().split('T')[0] : null,
          time: b.startTime ? b.startTime.toISOString().split('T')[1].substring(0, 5) : null,
          duration: b.duration || null,
          status: displayStatus,
          dbStatus: b.status, // Include raw status for debugging
          price: b.price,
          isPaid: b.isPaid,
          instructor: {
            id: b.instructor.id,
            name: b.instructor.name,
            hourlyRate: b.instructor.hourlyRate
          }
        };
      }),
      upcomingCount: upcomingBookings.length,
      pastCount: pastBookings.length
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, phone, address } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        clients: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update all client records for this user to keep consistency
    if (user.clients.length > 0) {
      await prisma.client.updateMany({
        where: { userId: user.id },
        data: {
            name,
            phone,
            defaultPickupAddress: address || null
          }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
          name,
          email: user.email,
          phone,
          address: address || ''
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
