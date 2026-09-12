import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback, getAllCategories } from '@/lib/extensions/driving/feedback-codes';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.providerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Instructor access required' },
        { status: 401 }
      );
    }

    // Get URL params
    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId parameter required' },
        { status: 400 }
      );
    }

    // Verify instructor has this client
    const client = await prisma.customer.findFirst({
      where: {
        id: customerId,
        bookings: { some: { providerId: session!.user!.providerId } },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 }
      );
    }

    // Get all bookings with feedback for this client (completed/has feedback)
    const bookings = await (prisma as any).booking.findMany({
      where: {
        customerId: customerId,
        bookings: { some: { providerId: session!.user!.providerId } },
        feedbackGivenAt: { not: null }, // Only bookings with feedback
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        duration: true,
        status: true,
        instructorNotes: true,
        feedbackGivenAt: true,
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    }) as any;

    // Transform feedback into readable format
    const lessonsWithFeedback = bookings.map((booking: any) => ({
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
      notes: booking.providerNotes,
      performanceScore: booking.performanceScore,
      feedbackGivenAt: booking.feedbackGivenAt,
    }));

    return NextResponse.json({
      success: true,
      customerId,
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
