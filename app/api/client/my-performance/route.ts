import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decodeFeedback } from '@/lib/config/feedback-codes';

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
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all client records for this user
    const clients = await prisma.client.findMany({
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

    const clientIds = clients.map((c) => c.id);

    // Get all completed bookings with feedback
    const bookingsWithFeedback = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        feedbackGivenAt: { not: null },
        status: 'COMPLETED',
      },
      select: {
        id: true,
        startTime: true,
        duration: true,
        lessonFeedback: true,
        instructorNotes: true,
        feedbackGivenAt: true,
        studentStrengths: true,
        focusAreas: true,
        performanceScore: true,
        instructor: {
          select: { name: true, profileImage: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    // Get all completed bookings (count)
    const allBookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
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

    // Average performance
    const performance = bookingsWithFeedback
      .map((b) => b.performanceScore)
      .filter((score): score is number => score !== null);
    const averagePerformance =
      performance.length > 0
        ? Math.round(
            performance.reduce((a, b) => a + b, 0) / performance.length
          )
        : null;

    // Recent feedback (last 5 lessons)
    const recentFeedback = bookingsWithFeedback.slice(0, 5).map((booking) => ({
      id: booking.id,
      date: booking.startTime,
      instructor: booking.instructor.name,
      performanceScore: booking.performanceScore,
      feedback: decodeFeedback(booking.lessonFeedback).slice(0, 3),
      strengths: decodeFeedback(booking.studentStrengths),
      notes: booking.instructorNotes,
    }));

    // Top strengths
    const strengthsCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking) => {
      booking.studentStrengths.forEach((code) => {
        strengthsCounts[code] = (strengthsCounts[code] || 0) + 1;
      });
    });

    const strengths = Object.entries(strengthsCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => decodeFeedback([Number(code)])[0]);

    // Areas to focus
    const focusAreasCounts: Record<number, number> = {};
    bookingsWithFeedback.forEach((booking) => {
      booking.focusAreas.forEach((code) => {
        focusAreasCounts[code] = (focusAreasCounts[code] || 0) + 1;
      });
    });

    const focusAreas = Object.entries(focusAreasCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => decodeFeedback([Number(code)])[0]);

    // Progress chart (performance over last 10 lessons)
    const progressChart = bookingsWithFeedback
      .slice(0, 10)
      .reverse()
      .map((booking, index) => ({
        lesson: index + 1,
        date: booking.startTime.toLocaleDateString(),
        score: booking.performanceScore,
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
