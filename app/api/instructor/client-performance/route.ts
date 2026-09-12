import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback, FEEDBACK_CODES } from '@/lib/extensions/driving/feedback-codes';
import { mergeLessonOutcomes } from '@/lib/extensions/driving/lessonOutcome';


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

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId parameter required' },
        { status: 400 }
      );
    }

    // Verify instructor has this client
    const client = await (prisma.customer.findFirst({
      where: {
        id: customerId,
        bookings: { some: { providerId: session!.user!.providerId } },
      },
      select: { name: true, email: true },
    }) as any);

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 }
      );
    }

    // Get all bookings for this client (with and without feedback)
    const allBookingsRaw = await (prisma as any).booking.findMany({
      where: {
        customerId: customerId,
        providerId: session!.user!.providerId,
        status: { in: ['COMPLETED'] },
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
    }) as any;

    // Merge outcome fields from extension table
    const allBookings = await mergeLessonOutcomes(allBookingsRaw as any);

    // Get bookings with feedback only
    const bookingsWithFeedback = allBookings.filter((b: any) => b.feedbackGivenAt);
    const bookingsWithoutFeedback = allBookings.filter((b: any) => !b.feedbackGivenAt);

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
      .map((b: any) => b.performanceScore)
      .filter((score): score is number => score !== null);
    const averagePerformance =
      performance.length > 0
        ? Math.round(
            performance.reduce((a: any, b: any) => a + b, 0) / performance.length
          )
        : null;

    // Count feedback codes to find common issues
    const feedbackCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking: any) => {
      booking.lessonFeedback.forEach((code: any) => {
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
    bookingsWithFeedback.forEach((booking: any) => {
      booking.studentStrengths.forEach((code: any) => {
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
    const recentLessons: any[] = bookingsWithFeedback.slice(0, 3);
    const recentProgress =
      recentLessons.length > 0
        ? {
            lessonCount: recentLessons.length,
            averageScore:
              recentLessons.filter((l) => l.performanceScore)
                .reduce((sum: any, l: any) => sum + (l.performanceScore || 0), 0) /
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
    bookingsWithFeedback.forEach((booking: any) => {
      booking.focusAreas.forEach((code: any) => {
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
    const feedbackHistory = bookingsWithFeedback.map((booking: any) => ({
      id: booking.id,
      date: booking.startTime,
      duration: booking.duration,
      feedbackCount: booking.lessonFeedback.length,
      performanceScore: booking.performanceScore,
      topIssues: booking.lessonFeedback
        .slice(0, 3)
        .map((code: any) => decodeFeedback([code])[0]),
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
