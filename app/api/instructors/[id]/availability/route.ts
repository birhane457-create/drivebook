import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter required' },
        { status: 400 }
      );
    }

    if (!params.id) {
      return NextResponse.json(
        { error: 'Instructor ID required' },
        { status: 400 }
      );
    }

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      include: {
        user: true
      }
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Get bookings for this date to exclude booked times
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await prisma.booking.findMany({
      where: {
        instructorId: params.id,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        startTime: true,
        endTime: true,
        duration: true,
      },
    });

    // Get working hours for this day
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const workingHours = (instructor.workingHours as any) || {};
    const daySlots = workingHours[dayName] || [];

    if (daySlots.length === 0) {
      return NextResponse.json({
        date,
        slots: [],
        message: 'Instructor not available on this day',
      });
    }

    // Generate slots based on working hours (hourly intervals)
    const allSlots: string[] = [];
    for (const slot of daySlots) {
      const [startHour] = slot.start.split(':').map(Number);
      const [endHour] = slot.end.split(':').map(Number);
      
      for (let hour = startHour; hour < endHour; hour++) {
        allSlots.push(`${String(hour).padStart(2, '0')}:00`);
      }
    }

    // Filter out booked slots - extract time from startTime
    const bookedTimes = existingBookings.map(b => {
      const hours = String(b.startTime.getHours()).padStart(2, '0');
      const minutes = String(b.startTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    });
    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    return NextResponse.json({
      date,
      slots: availableSlots,
      booked: bookedTimes,
    });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
