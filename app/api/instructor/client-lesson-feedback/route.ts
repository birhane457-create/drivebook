import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback, getAllCategories } from '@/lib/config/feedback-codes';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.instructorId) {
      return NextResponse.json(
        { error: 'Unauthorized - Instructor access required' },
        { status: 401 }
      );
    }

    // Get URL params
    const searchParams = req.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId parameter required' },
        { status: 400 }
      );
    }

    // Verify instructor has this client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        instructorId: session.user.instructorId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 }
      );
    }

    // Get all bookings with feedback for this client (completed/has feedback)
    const bookings = await prisma.booking.findMany({
      where: {
        clientId: clientId,
        instructorId: session.user.instructorId,
        feedbackGivenAt: { not: null }, // Only bookings with feedback
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        duration: true,
        status: true,
        lessonFeedback: true,
        instructorNotes: true,
        feedbackGivenAt: true,
        studentStrengths: true,
        focusAreas: true,
        performanceScore: true,
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    // Transform feedback into readable format
    const lessonsWithFeedback = bookings.map((booking) => ({
      id: booking.id,
      date: booking.startTime,
      duration: booking.duration,
      status: booking.status,
      feedback: {
        codes: booking.lessonFeedback,
        descriptions: decodeFeedback(booking.lessonFeedback),
        strengths: decodeFeedback(booking.studentStrengths),
        focusAreas: decodeFeedback(booking.focusAreas),
      },
      notes: booking.instructorNotes,
      performanceScore: booking.performanceScore,
      feedbackGivenAt: booking.feedbackGivenAt,
    }));

    return NextResponse.json({
      success: true,
      clientId,
      totalLessonsWithFeedback: lessonsWithFeedback.length,
      lessons: lessonsWithFeedback,
    });
  } catch (error) {
    console.error('Error fetching lesson feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
