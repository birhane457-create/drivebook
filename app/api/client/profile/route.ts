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
          orderBy: { id: 'desc' },
          take: 1 // Get most recent client record
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the most recent client record
    const clientRecord = user.clients[0];

    // Get user's bookings by matching email
    const bookings = await prisma.booking.findMany({
      where: {
        clientEmail: user.email
      },
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

    const now = new Date();
    const upcomingBookings = bookings.filter(b => {
      if (!b.startTime) return false;
      return b.startTime > now;
    });
    const pastBookings = bookings.filter(b => {
      if (!b.startTime) return false;
      return b.startTime <= now;
    });

    const activeBookings = bookings.filter(b => b.status !== 'CANCELLED');

    return NextResponse.json({
      user: {
        name: clientRecord?.name || user.name || user.email.split('@')[0],
        email: user.email,
        phone: clientRecord?.phone || ''
      },
      bookings: activeBookings.map(b => ({
        id: b.id,
        date: b.startTime ? b.startTime.toISOString().split('T')[0] : null,
        time: b.startTime ? b.startTime.toISOString().split('T')[1].substring(0, 5) : null,
        duration: b.duration || null,
        status: b.status,
        price: b.price,
        isPaid: b.isPaid,
        instructor: {
          id: b.instructor.id,
          name: b.instructor.name,
          hourlyRate: b.instructor.hourlyRate
        }
      })),
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
    const { name, phone, pickupLocation } = body;

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
            phone
          }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
          name,
          email: user.email,
          phone,
          pickupLocation: pickupLocation || ''
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
