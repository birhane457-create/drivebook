import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFeedbackByCode, getCategoryDisplayName } from '@/lib/constants/pda-feedback-codes';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructorId = session.user.instructorId;

    // Get all bookings with feedback for this instructor
    const bookingsWithFeedback = await prisma.booking.findMany({
      where: {
        instructorId,
        feedbackGivenAt: { not: null },
      },
      select: {
        id: true,
        startTime: true,
        lessonFeedback: true,
        performanceScore: true,
        instructorNotes: true,
        feedbackGivenAt: true,
        client: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Total lessons (completed or confirmed past)
    const totalLessons = await prisma.booking.count({
      where: {
        instructorId,
        status: { in: ['COMPLETED', 'CONFIRMED'] },
        startTime: { lt: new Date() },
      },
    });

    const totalLessonsWithFeedback = bookingsWithFeedback.length;

    // Average performance score
    const scoresWithValue = bookingsWithFeedback.filter(b => b.performanceScore !== null);
    const averageScore =
      scoresWithValue.length > 0
        ? Math.round(
            scoresWithValue.reduce((sum, b) => sum + (b.performanceScore ?? 0), 0) /
              scoresWithValue.length
          )
        : null;

    // Aggregate all feedback codes to find top focus areas and strengths
    const allCodes: number[] = [];
    bookingsWithFeedback.forEach(b => {
      if (Array.isArray(b.lessonFeedback)) {
        allCodes.push(...(b.lessonFeedback as number[]));
      }
    });

    // Count code frequency
    const codeFrequency: Record<number, number> = {};
    allCodes.forEach(code => {
      codeFrequency[code] = (codeFrequency[code] || 0) + 1;
    });

    // Top focus areas (most frequent codes)
    const topFocusAreas = Object.entries(codeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => {
        const fb = getFeedbackByCode(Number(code));
        return fb ? `${getCategoryDisplayName(fb.category)}: ${fb.shortText}` : null;
      })
      .filter(Boolean) as string[];

    // Top strengths — bookings with high scores (>=85) — extract their category names
    const highScoreBookings = bookingsWithFeedback.filter(
      b => (b.performanceScore ?? 0) >= 85
    );
    const strengthCategories: Record<string, number> = {};
    highScoreBookings.forEach(b => {
      if (Array.isArray(b.lessonFeedback) && (b.lessonFeedback as number[]).length === 0) {
        // No issues = all categories are strengths
        strengthCategories['Overall Control'] = (strengthCategories['Overall Control'] || 0) + 1;
        strengthCategories['Observation'] = (strengthCategories['Observation'] || 0) + 1;
      }
    });
    const topStrengths = Object.entries(strengthCategories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);

    // Recent feedback (last 20)
    const recentFeedback = bookingsWithFeedback.slice(0, 20).map(b => ({
      id: b.id,
      bookingId: b.id,
      clientName: b.client?.name ?? 'Unknown',
      date: b.startTime?.toISOString() ?? b.feedbackGivenAt?.toISOString() ?? '',
      performanceScore: b.performanceScore,
      feedbackCodes: Array.isArray(b.lessonFeedback) ? (b.lessonFeedback as number[]) : [],
      strengthCodes: [],
      notes: b.instructorNotes,
    }));

    return NextResponse.json({
      totalLessonsWithFeedback,
      totalLessons,
      averageScore,
      recentFeedback,
      topFocusAreas,
      topStrengths,
    });
  } catch (error) {
    console.error('Lesson feedback summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
