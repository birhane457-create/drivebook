import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Get user's bookings - check both userId and clientId
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: user.id },
          { clientId: { in: user.clients.map(c => c.id) } }
        ]
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            hourlyRate: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    const now = new Date();
    const upcomingBookings = bookings.filter(b => 
      new Date(b.startTime) > now && b.status !== 'CANCELLED'
    );
    const pastBookings = bookings.filter(b => 
      new Date(b.startTime) <= now && b.status !== 'CANCELLED'
    );

    // Filter out cancelled bookings from the response
    const activeBookings = bookings.filter(b => b.status !== 'CANCELLED');

    return NextResponse.json({
      user: {
        name: clientRecord?.name || user.email.split('@')[0],
        email: user.email,
        phone: clientRecord?.phone || '',
        pickupLocation: clientRecord?.addressText || ''
      },
      bookings: activeBookings.map(b => ({
        id: b.id,
        date: b.startTime.toISOString(),
        time: new Date(b.startTime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        duration: (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60),
        price: b.price,
        status: new Date(b.startTime) > now ? 'upcoming' : 'completed',
        instructor: {
          id: b.instructor.id,
          name: b.instructor.name,
          avatar: b.instructor.profileImage,
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
    // This ensures the same name/phone appears across all instructors
    if (user.clients.length > 0) {
      await prisma.client.updateMany({
        where: { userId: user.id },
        data: {
            name,
            phone,
            email: user.email, // Also update email to keep it in sync
            addressText: pickupLocation || undefined
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
