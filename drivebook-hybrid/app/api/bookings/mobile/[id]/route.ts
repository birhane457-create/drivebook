import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      instructorId: string;
    };

    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    // Fetch booking
    const booking = await (prisma as any).booking.findFirst({
      where: {
        id: params.id,
        instructorId: decoded.instructorId, // Ensure instructor owns this booking
      },
      include: {
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Format booking for mobile app
    const formattedBooking = {
      id: booking.id,
      date: booking.startTime.toISOString().split('T')[0],
      startTime: booking.startTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      endTime: booking.endTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      duration: (booking.endTime - booking.startTime) / (1000 * 60 * 60), // hours
      status: booking.status,
      client: {
        name: booking.client.name,
        phone: booking.client.phone,
        email: booking.client.email,
      },
      pickupLocation: booking.pickupAddress || 'Not specified',
      dropoffLocation: booking.dropoffAddress || 'Not specified',
      checkInTime: booking.checkInTime,
      checkInLocation: booking.checkInLocation,
      checkOutTime: booking.checkOutTime,
      checkOutLocation: booking.checkOutLocation,
      actualDuration: booking.actualDuration,
    };

    return NextResponse.json(formattedBooking);
  } catch (error: any) {
    console.error('Mobile booking fetch error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
}
