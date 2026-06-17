import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * SEED ENDPOINT - For development/testing only
 * Creates test feedback data for the first available student
 * 
 * Usage: GET /api/seed/test-feedback
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Seed endpoint disabled in production' },
        { status: 403 }
      );
    }

    console.log('🌱 Finding student to seed test feedback...');

    // Find any existing client (student)
    const client = await prisma.client.findFirst({
      include: {
        user: true,
        instructor: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { 
          error: 'No student account found',
          message: 'Please create a student account first'
        },
        { status: 404 }
      );
    }

    console.log(`✅ Found student: ${client.user?.email}`);

    // Test bookings data
    const testBookings = [
      {
        date: new Date('2024-06-01T10:00:00'),
        duration: 1,
        feedback: [70, 71],
        strengths: [70, 75],
        focusAreas: [12, 20],
        performanceScore: 85,
        notes: 'Great session! Your steering control has improved significantly. Keep working on mirror checks.',
      },
      {
        date: new Date('2024-05-25T14:30:00'),
        duration: 1.5,
        feedback: [73, 74],
        strengths: [73, 74],
        focusAreas: [33, 40],
        performanceScore: 78,
        notes: 'Good progress overall. Work on signaling earlier and adjusting speed for hazards.',
      },
      {
        date: new Date('2024-05-18T11:00:00'),
        duration: 1,
        feedback: [72, 76],
        strengths: [72, 76],
        focusAreas: [10, 14],
        performanceScore: 82,
        notes: 'Excellent attitude and response to feedback! Keep practicing lane positioning on roundabouts.',
      },
      {
        date: new Date('2024-05-11T15:00:00'),
        duration: 1,
        feedback: [71, 75],
        strengths: [71, 75],
        focusAreas: [3, 23],
        performanceScore: 75,
        notes: 'Nice observation work! Your vehicle control is becoming smoother. Continue practicing smooth steering.',
      },
      {
        date: new Date('2024-05-04T09:30:00'),
        duration: 1,
        feedback: [70, 2, 1],
        strengths: [70],
        focusAreas: [1, 2, 4],
        performanceScore: 72,
        notes: 'Good fundamentals on control. Work on smooth transitions between acceleration and braking.',
      },
    ];

    const createdBookings = [];

    // Create test bookings
    for (const testBooking of testBookings) {
      const booking = await prisma.booking.create({
        data: {
          instructorId: client.instructorId,
          clientId: client.id,
          status: 'COMPLETED',
          startTime: testBooking.date,
          endTime: new Date(testBooking.date.getTime() + testBooking.duration * 60 * 60000),
          duration: testBooking.duration,
          price: testBooking.duration * (client.instructor.hourlyRate || 50),
          isPaid: true,
          paymentCaptured: true,
          paidAt: testBooking.date,
          lessonFeedback: testBooking.feedback,
          studentStrengths: testBooking.strengths,
          focusAreas: testBooking.focusAreas,
          performanceScore: testBooking.performanceScore,
          instructorNotes: testBooking.notes,
          feedbackGivenAt: new Date(testBooking.date.getTime() + 24 * 60 * 60000),
        },
      });
      createdBookings.push(booking);
    }

    console.log(`✅ Successfully created ${createdBookings.length} test bookings`);

    return NextResponse.json({
      success: true,
      message: `Seeded ${createdBookings.length} test bookings`,
      student: {
        email: client.user?.email,
        name: client.name,
        instructor: client.instructor.name,
      },
      bookings: createdBookings.map(b => ({
        id: b.id,
        date: b.startTime,
        score: b.performanceScore,
      })),
    });

  } catch (error) {
    console.error('❌ Seed error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to seed test data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
