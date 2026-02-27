import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback, FEEDBACK_CODES } from '@/lib/config/feedback-codes';


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
      select: { name: true, email: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 }
      );
    }

    // Get all bookings for this client (with and without feedback)
    const allBookings = await prisma.booking.findMany({
      where: {
        clientId: clientId,
        instructorId: session.user.instructorId,
        status: { in: ['COMPLETED'] },
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
    });

    // Get bookings with feedback only
    const bookingsWithFeedback = allBookings.filter((b) => b.feedbackGivenAt);
    const bookingsWithoutFeedback = allBookings.filter((b) => !b.feedbackGivenAt);

    // Calculate statistics
    if (bookingsWithFeedback.length === 0) {
      return NextResponse.json({
        success: true,
        client,
        totalLessons: allBookings.length,
        lessonsWithFeedback: 0,
        lessonsWithoutFeedback: bookingsWithoutFeedback.length,
        averagePerformance: null,
        commonIssues: [],
        strengths: [],
        focusAreas: [],
        recentProgress: null,
        feedbackHistory: [],
      });
    }

    // Calculate average performance score
    const performance = bookingsWithFeedback
      .map((b) => b.performanceScore)
      .filter((score): score is number => score !== null);
    const averagePerformance =
      performance.length > 0
        ? Math.round(
            performance.reduce((a, b) => a + b, 0) / performance.length
          )
        : null;

    // Count feedback codes to find common issues
    const feedbackCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking) => {
      booking.lessonFeedback.forEach((code) => {
        feedbackCounts[code] = (feedbackCounts[code] || 0) + 1;
      });
    });

    const commonIssues = Object.entries(feedbackCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5 issues
      .map(([code, count]) => ({
        code: Number(code),
        description: decodeFeedback([Number(code)])[0],
        occurrences: count,
      }));

    // Get strengths data
    const strengthsCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking) => {
      booking.studentStrengths.forEach((code) => {
        strengthsCounts[code] = (strengthsCounts[code] || 0) + 1;
      });
    });

    const topStrengths = Object.entries(strengthsCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([code, count]) => ({
        code: Number(code),
        description: decodeFeedback([Number(code)])[0],
        occurrences: count,
      }));

    // Calculate recent progress (last 3 lessons)
    const recentLessons = bookingsWithFeedback.slice(0, 3);
    const recentProgress =
      recentLessons.length > 0
        ? {
            lessonCount: recentLessons.length,
            averageScore:
              recentLessons.filter((l) => l.performanceScore)
                .reduce((sum, l) => sum + (l.performanceScore || 0), 0) /
              recentLessons.filter((l) => l.performanceScore).length,
            trend:
              recentLessons.length >= 2 &&
              recentLessons[0].performanceScore !== null &&
              recentLessons[recentLessons.length - 1].performanceScore !== null
                ? (recentLessons[0].performanceScore as number) >
                  (recentLessons[recentLessons.length - 1].performanceScore as number)
                  ? 'improving'
                  : 'needs_attention'
                : 'stable',
          }
        : null;

    // Get focus areas
    const focusAreasCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking) => {
      booking.focusAreas.forEach((code) => {
        focusAreasCounts[code] = (focusAreasCounts[code] || 0) + 1;
      });
    });

    const topFocusAreas = Object.entries(focusAreasCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([code, count]) => ({
        code: Number(code),
        description: decodeFeedback([Number(code)])[0],
        occurrences: count,
      }));

    // Get feedback history
    const feedbackHistory = bookingsWithFeedback.map((booking) => ({
      id: booking.id,
      date: booking.startTime,
      duration: booking.duration,
      feedbackCount: booking.lessonFeedback.length,
      performanceScore: booking.performanceScore,
      topIssues: booking.lessonFeedback
        .slice(0, 3)
        .map((code) => decodeFeedback([code])[0]),
    }));

    return NextResponse.json({
      success: true,
      client,
      totalLessons: allBookings.length,
      lessonsWithFeedback: bookingsWithFeedback.length,
      lessonsWithoutFeedback: bookingsWithoutFeedback.length,
      averagePerformance,
      commonIssues,
      strengths: topStrengths,
      focusAreas: topFocusAreas,
      recentProgress,
      feedbackHistory,
    });
  } catch (error) {
    console.error('Error fetching performance report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
