// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback } from '@/lib/extensions/driving/feedback-codes';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { mergeLessonOutcomes } from '@/lib/extensions/driving/lessonOutcome';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all client records for this user
    const clients = await prisma.customer.findMany({
      where: { userId: user.id },
    });

    if (clients.length === 0) {
      return NextResponse.json({
        success: true,
        totalLessons: 0,
        lessonsWithFeedback: 0,
        averagePerformance: null,
        recentFeedback: [],
        strengths: [],
        focusAreas: [],
        progressChart: [],
      });
    }

    const clientIds = clients.map((c: any) => c.id);

    // Get all completed bookings with feedback
    // FIX: feedbackGivenAt, instructorNotes, assessmentType, lessonTopics, passed
    // belong to the DrivingLessonOutcome model, not Booking.
    // Query Booking for core fields, then join DrivingLessonOutcome separately.
    const bookingsRaw = await prisma.booking.findMany({
      where: {
        customerId: { in: clientIds },
        status: 'COMPLETED',
      },
      select: {
        id: true,
        startTime: true,
        duration: true,
        provider: {
          select: { name: true, profileImage: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    // Fetch complete outcome rows. The previous partial merge omitted score and
    // feedback arrays, causing the dashboard's progress summary to throw.
    const bookingIds = bookingsRaw.map((b: any) => b.id);
    const outcomes = bookingIds.length > 0
      ? await (prisma as any).drivingLessonOutcome.findMany({
          where: { bookingId: { in: bookingIds }, feedbackGivenAt: { not: null } },
        })
      : [];
    const outcomeMap = new Map<string, any>(outcomes.map((outcome: any) => [outcome.bookingId, outcome]));
    const bookingsWithFeedback = bookingsRaw
      .filter((booking: any) => outcomeMap.has(booking.id))
      .map((booking: any) => {
        const outcome = outcomeMap.get(booking.id);
        return {
          ...booking,
          instructorNotes: outcome.instructorNotes ?? null,
          feedbackGivenAt: outcome.feedbackGivenAt ?? null,
          assessmentType: outcome.assessmentType ?? 'COACHING',
          lessonTopics: outcome.lessonTopics ?? null,
          passed: outcome.passed ?? null,
          performanceScore: outcome.performanceScore ?? null,
          lessonFeedback: Array.isArray(outcome.lessonFeedback) ? outcome.lessonFeedback : [],
          studentStrengths: Array.isArray(outcome.studentStrengths) ? outcome.studentStrengths : [],
          focusAreas: Array.isArray(outcome.focusAreas) ? outcome.focusAreas : [],
        };
      });

    // Get all completed bookings (count)
    const allBookings = await prisma.booking.findMany({
      where: {
        customerId: { in: clientIds },
        status: 'COMPLETED',
      },
      select: { id: true },
    });

    // Calculate statistics
    if (bookingsWithFeedback.length === 0) {
      return NextResponse.json({
        success: true,
        totalLessons: allBookings.length,
        lessonsWithFeedback: 0,
        averagePerformance: null,
        recentFeedback: [],
        strengths: [],
        focusAreas: [],
        progressChart: [],
      });
    }

    // Average performance — MOCK assessments only (coaching has no score)
    const performance = bookingsWithFeedback
      .filter((b: any) => b.assessmentType === 'MOCK')
      .map((b: any) => b.performanceScore)
      .filter((score: any): score is number => score !== null);
    const averagePerformance =
      performance.length > 0
        ? Math.round(performance.reduce((a: number, b: number) => a + b, 0) / performance.length)
        : null;

    // Recent feedback timeline — all entries, type-aware
    const recentFeedback = bookingsWithFeedback.map((booking: any) => ({
      id: booking.id,
      date: booking.startTime,
      instructor: booking.provider.name,
      performanceScore: booking.performanceScore,
      assessmentType: booking.assessmentType ?? 'COACHING',
      lessonTopics: booking.lessonTopics
        ? booking.lessonTopics.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [],
      passed: booking.passed ?? null,
      feedback: decodeFeedback(booking.lessonFeedback).slice(0, 3),
      strengths: decodeFeedback(booking.studentStrengths),
      notes: booking.instructorNotes,
    }));

    // Top strengths
    const strengthsCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking: any) => {
      booking.studentStrengths.forEach((code: any) => {
        strengthsCounts[code] = (strengthsCounts[code] || 0) + 1;
      });
    });

    const strengths = Object.entries(strengthsCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => decodeFeedback([Number(code)])[0]);

    // Areas to focus
    const focusAreasCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking: any) => {
      booking.focusAreas.forEach((code: any) => {
        focusAreasCounts[code] = (focusAreasCounts[code] || 0) + 1;
      });
    });

    const focusAreas = Object.entries(focusAreasCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => decodeFeedback([Number(code)])[0]);

    // Progress chart — only MOCK assessments plot on the score chart
    const scoredAssessments = bookingsWithFeedback
      .filter((b: any) => b.assessmentType === 'MOCK' && b.performanceScore !== null)
      .slice(0, 10)
      .reverse()
    const progressChart = scoredAssessments.map((booking: any, index: number) => ({
      lesson: index + 1,
      date: booking.startTime.toLocaleDateString('en-AU', { timeZone: DEFAULT_TIMEZONE }),
      score: booking.performanceScore,
      assessmentType: booking.assessmentType,
      passed: booking.passed ?? null,
    }));

    return NextResponse.json({
      success: true,
      totalLessons: allBookings.length,
      lessonsWithFeedback: bookingsWithFeedback.length,
      averagePerformance,
      recentFeedback,
      strengths,
      focusAreas,
      progressChart,
    });
  } catch (error) {
    console.error('Error fetching my performance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
