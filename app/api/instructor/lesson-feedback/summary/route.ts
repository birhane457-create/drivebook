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
    const { searchParams } = new URL(req.url);
    // Optional: filter to a specific client's progress
    const clientId = searchParams.get('clientId') ?? undefined;

    // Get all bookings with feedback for this instructor
    const bookingsWithFeedback: any[] = await prisma.booking.findMany({
      where: {
        instructorId,
        feedbackGivenAt: { not: null },
        // Only COMPLETED lessons — avoids inflating stats with cancelled/pending
        status: 'COMPLETED',
        ...(clientId ? { clientId } : {}),
      },
      select: {
        id: true,
        startTime: true,
        lessonFeedback: true,
        studentStrengths: true,
        performanceScore: true,
        instructorNotes: true,
        feedbackGivenAt: true,
        assessmentType: true,
        lessonTopics: true,
        passed: true,
        // metadata: true,  // Not in schema - access via (booking as any).metadata
        client: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Total COMPLETED lessons (with or without feedback)
    const totalLessons = await prisma.booking.count({
      where: {
        instructorId,
        status: 'COMPLETED',
        ...(clientId ? { clientId } : {}),
      },
    });

    const totalLessonsWithFeedback = bookingsWithFeedback.length;

    // Average score — MOCK assessments only
    // COACHING lessons have null score by design — never included in average
    const mockLessons = bookingsWithFeedback.filter(
      b => b.assessmentType === 'MOCK' && b.performanceScore !== null
    );
    const averageScore =
      mockLessons.length > 0
        ? Math.round(
            mockLessons.reduce((sum, b) => sum + (b.performanceScore ?? 0), 0) /
              mockLessons.length
          )
        : null;

    // ── Top focus areas — most frequently flagged PDA codes ─────────────────
    const allFocusCodes: number[] = [];
    bookingsWithFeedback.forEach(b => {
      if (Array.isArray(b.lessonFeedback)) {
        allFocusCodes.push(...(b.lessonFeedback as number[]));
      }
    });

    const focusFrequency: Record<number, number> = {};
    allFocusCodes.forEach(code => {
      focusFrequency[code] = (focusFrequency[code] || 0) + 1;
    });

    const topFocusAreas = Object.entries(focusFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => {
        const fb = getFeedbackByCode(Number(code));
        return fb ? `${getCategoryDisplayName(fb.category)}: ${fb.shortText}` : null;
      })
      .filter(Boolean) as string[];

    // ── Top strengths — most frequently recorded in studentStrengths[] ───────
    // Only uses explicitly recorded strength codes — not inferred from score.
    // "Not in lessonFeedback" does NOT mean strength; must be explicitly observed.
    const allStrengthCodes: number[] = [];
    bookingsWithFeedback.forEach(b => {
      if (Array.isArray(b.studentStrengths) && (b.studentStrengths as number[]).length > 0) {
        allStrengthCodes.push(...(b.studentStrengths as number[]));
      }
    });

    const strengthFrequency: Record<number, number> = {};
    allStrengthCodes.forEach(code => {
      strengthFrequency[code] = (strengthFrequency[code] || 0) + 1;
    });

    const topStrengths = Object.entries(strengthFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code]) => {
        const fb = getFeedbackByCode(Number(code));
        return fb ? `${getCategoryDisplayName(fb.category)}: ${fb.shortText}` : null;
      })
      .filter(Boolean) as string[];

    // Recent feedback (last 20) — most recent first
    const recentFeedback = bookingsWithFeedback.slice(0, 20).map(b => {
      const meta = (b.metadata as any) ?? {};
      return {
        id: b.id,
        bookingId: b.id,
        clientName: b.client?.name ?? 'Unknown',
        date: b.startTime?.toISOString() ?? b.feedbackGivenAt?.toISOString() ?? '',
        assessmentType: b.assessmentType ?? 'COACHING',
        // Score only present for MOCK
        performanceScore: b.assessmentType === 'MOCK' ? b.performanceScore : null,
        passed: b.assessmentType === 'MOCK' ? b.passed : null,
        focusAreaCodes: Array.isArray(b.lessonFeedback) ? (b.lessonFeedback as number[]) : [],
        strengthCodes: Array.isArray(b.studentStrengths) ? (b.studentStrengths as number[]) : [],
        lessonTopics: b.lessonTopics ?? null,
        notes: b.instructorNotes,
        nextLessonFocus: meta.nextLessonFocus ?? null,
      };
    });

    return NextResponse.json({
      totalLessonsWithFeedback,
      totalLessons,
      // averageScore only from MOCK — null if no mock assessments yet
      averageScore,
      mockCount: mockLessons.length,
      coachingCount: bookingsWithFeedback.filter(b => b.assessmentType !== 'MOCK').length,
      recentFeedback,
      topFocusAreas,
      topStrengths,
    });
  } catch (error) {
    console.error('Lesson feedback summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
