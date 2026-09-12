// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { availabilityService } from '@/lib/services/availability';
import { googleCalendarService } from '@/lib/services/googleCalendar';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log('[Mobile API] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('[Mobile API] Token:', token.substring(0, 20) + '...');
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      providerId: string;
    };
    
    console.log('[Mobile API] Decoded token:', decoded);

    if (!decoded.providerId) {
      console.log('[Mobile API] No providerId in token');
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    console.log('[Mobile API] Fetching bookings for instructor:', decoded.providerId);

    // Fetch bookings for this instructor
    const bookings = await (prisma as any).booking.findMany({
      where: {
        providerId: decoded.providerId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] } // ✅ Exclude PENDING (failed/incomplete payments)
      },
      include: { customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    console.log('[Mobile API] Found bookings:', bookings.length);

    // Format bookings for mobile app
    const formattedBookings = bookings.map((booking: any) => ({
      id: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.status,
      bookingType: booking.bookingType || 'STANDARD_LESSON',
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      price: booking.price,
      notes: booking.notes,
      customer: {
        name: booking.customer.name,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      checkInTime: booking.checkInTime?.toISOString(),
      checkOutTime: booking.checkOutTime?.toISOString(),
    }));

    console.log('[Mobile API] Returning formatted bookings');
    return NextResponse.json(formattedBookings);
  } catch (error: any) {
    console.error('[Mobile API] Error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
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
      providerId: string;
    };

    if (!decoded.providerId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerId,
      bookingType,
      startTime,
      endTime,
      pickupAddress,
      dropoffAddress,
      notes,
      testCenterName,
      testCenterAddress,
    } = body;

    // Validation
    if (!customerId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Check for double booking
    const hasConflict = await availabilityService.checkDoubleBooking(
      decoded.providerId,
      start,
      end
    );

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Time slot already booked' },
        { status: 409 }
      );
    }

    // Get instructor to calculate price
    const instructor = await prisma.provider.findUnique({
      where: { id: decoded.providerId },
      include: { user: true }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Calculate price
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const price = instructor.hourlyRate * (durationMinutes / 60);

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        providerId: decoded.providerId,
        customerId,
        bookingType: bookingType || 'LESSON',
        startTime: start,
        endTime: end,
        pickupAddress: bookingType === 'PDA_TEST' ? testCenterAddress : pickupAddress,
        dropoffAddress: bookingType === 'PDA_TEST' ? testCenterAddress : (dropoffAddress || pickupAddress),
        price,
        notes,
        status: 'CONFIRMED',
        createdBy: 'provider',
      },
      include: { customer: true,
      },
    });

    // If booking type is PDA_TEST, create a PDA test entry
    if (bookingType === 'PDA_TEST' && testCenterName && testCenterAddress) {
      try {
        await prisma.pDATest.create({
          data: {
            providerId: decoded.providerId,
            customerId,
            testCenterName,
            testCenterAddress,
            testCenterLatitude: 0,
            testCenterLongitude: 0,
            testDate: start,
            testTime: start.toISOString().slice(11, 16),
            result: 'PENDING',
            notes,
          },
        });
      } catch (pdaError) {
        console.error('Failed to create PDA test entry:', pdaError);
        // Don't fail the booking if PDA test creation fails
      }
    }

    // Create Google Calendar event if instructor has calendar connected
    if (instructor.syncGoogleCalendar) {
      try {
        const result = await googleCalendarService.createCalendarEvent(
          decoded.providerId,
          {
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            customerName: booking.customer.name,
            customerPhone: booking.customer.phone,
            pickupAddress: booking.pickupAddress || undefined,
            notes: booking.notes || undefined,
          }
        );

        // Update booking with calendar event ID
        if (result.success && result.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: result.eventId },
          });
        }
      } catch (calendarError) {
        console.error('Failed to create calendar event:', calendarError);
        // Don't fail the booking if calendar creation fails
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        bookingType: booking.bookingType,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        price: booking.price,
        notes: booking.notes,
        customer: {
          name: booking.customer.name,
          phone: booking.customer.phone,
          email: booking.customer.email,
        },
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Create booking error:', error);

    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
