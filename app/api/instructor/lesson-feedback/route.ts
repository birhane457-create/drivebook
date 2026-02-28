import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFeedbackDescription, FEEDBACK_CODES } from '@/lib/config/feedback-codes';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.instructorId) {
      return NextResponse.json(
        { error: 'Unauthorized - Instructor access required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      bookingId,
      feedback,
      instructorNotes,
      strengths,
      focusAreas,
      performanceScore,
    } = body;

    if (!bookingId || !Array.isArray(feedback)) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, feedback' },
        { status: 400 }
      );
    }

    // Validate feedback codes are numeric
    if (!feedback.every((code: any) => typeof code === 'number')) {
      return NextResponse.json(
        { error: 'Feedback codes must be numeric' },
        { status: 400 }
      );
    }

    // Verify booking exists and belongs to this instructor
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        instructorId: session.user.instructorId,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found or access denied' },
        { status: 404 }
      );
    }

    // Validate feedback scores are valid
    const allCodes = new Set();
    Object.values(FEEDBACK_CODES).forEach((category) => {
      Object.keys(category.codes).forEach((code) => {
        allCodes.add(Number(code));
      });
    });

    for (const code of feedback) {
      if (!allCodes.has(code)) {
        return NextResponse.json(
          { error: `Invalid feedback code: ${code}` },
          { status: 400 }
        );
      }
    }

    // Update booking with feedback
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        lessonFeedback: feedback,
        instructorNotes: instructorNotes || null,
        feedbackGivenAt: new Date(),
        studentStrengths: strengths || [],
        focusAreas: focusAreas || [],
        performanceScore: performanceScore || null,
      },
      include: {
        client: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      booking: {
        id: updatedBooking.id,
        clientName: updatedBooking.client.name,
        feedbackCount: updatedBooking.lessonFeedback.length,
        feedbackGivenAt: updatedBooking.feedbackGivenAt,
      },
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
