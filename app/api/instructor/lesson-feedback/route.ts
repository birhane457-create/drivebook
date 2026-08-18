import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  generateFeedbackSummary,
  calculateCategoryScores,
  calculateOverallScore,
} from '@/lib/services/lesson-feedback-service';
import { createNotification } from '@/lib/services/notifications';

export const dynamic = 'force-dynamic';

// Assessment types — v1 supports COACHING and MOCK only.
const ASSESSMENT_TYPES = ['COACHING', 'MOCK'] as const
type AssessmentType = typeof ASSESSMENT_TYPES[number]

const feedbackSchema = z.object({
  bookingId: z.string(),
  instructorId: z.string(),
  clientId: z.string(),
  // Focus areas — things the student needs to work on
  feedbackCodes: z.array(z.number()).default([]),
  // Strengths — things the student did well (now first-class, not concatenated into notes)
  studentStrengthCodes: z.array(z.number()).default([]),
  // Private instructor notes — never shown to student
  instructorNotes: z.string().optional().default(''),
  whiteboardSketchUrl: z.string().url().optional().nullable(),
  assessmentType: z.enum(ASSESSMENT_TYPES).default('COACHING'),
  lessonTopics: z.string().optional().default(''), // comma-separated topics covered
  // What the instructor wants to focus on next lesson — shown prominently to student
  nextLessonFocus: z.string().max(500).optional().default(''),
  // Legacy fields — still accepted but no longer the primary strength mechanism
  strengths: z.string().optional().default(''),
  areasToImprove: z.string().optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = feedbackSchema.parse(body);

    // Verify booking belongs to this instructor and is COMPLETED
    const booking = await prisma.booking.findFirst({
      where: {
        id: data.bookingId,
        instructorId: session.user.instructorId,
      },
      select: {
        id: true,
        status: true,
        feedbackGivenAt: true,
        client: {
          select: {
            userId: true,
            name: true,
          },
        },
        instructor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Feedback only allowed on completed lessons
    if (booking.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Feedback can only be submitted for completed lessons' },
        { status: 400 }
      );
    }

    const isResubmission = booking.feedbackGivenAt !== null;

    // ── Server enforces scoring rules — client cannot override ──────────────
    //
    // COACHING: qualitative only — no score, no pass/fail
    //   The absence of a score is meaningful. Don't manufacture one.
    //
    // MOCK: scored assessment — calculate from codes, never trust client value
    //   pass = score >= 80 AND zero critical-severity codes
    //
    const isMock = data.assessmentType === 'MOCK';

    let overallScore: number | null = null;
    let passed: boolean | null = null;

    if (isMock) {
      const categoryScores = calculateCategoryScores(data.feedbackCodes);
      overallScore = calculateOverallScore(categoryScores, data.feedbackCodes);
      const summary = generateFeedbackSummary(data.feedbackCodes);
      passed = overallScore >= 80 && summary.criticalIssues === 0;
    }
    // COACHING → score and passed remain null (server authority, not client)

    // Build instructor notes — private, never shown to student
    // nextLessonFocus is stored separately in metadata, not concatenated here
    const notesParts = [data.strengths, data.areasToImprove, data.instructorNotes]
    const combinedNotes = notesParts.filter(Boolean).join('\n\n') || null;

    // Build metadata — nextLessonFocus is first-class here
    const existingBooking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      select: { lessonTopics: true },
    });
    const nextLessonFocusMeta = data.nextLessonFocus
      ? { nextLessonFocus: data.nextLessonFocus }
      : {};

    await prisma.booking.update({
      where: { id: data.bookingId },
      data: {
        // Focus areas — what to work on
        lessonFeedback: data.feedbackCodes,
        // Strengths — what went well (now stored in studentStrengths field)
        studentStrengths: data.studentStrengthCodes,
        instructorNotes: combinedNotes,
        // Score only for MOCK — null for COACHING (server enforced)
        performanceScore: overallScore,
        passed,
        feedbackGivenAt: new Date(),
        assessmentType: data.assessmentType,
        lessonTopics: data.lessonTopics || null,
        ...(data.whiteboardSketchUrl !== undefined && {
          whiteboardSketchUrl: data.whiteboardSketchUrl,
        }),
        // nextLessonFocus stored in metadata alongside any existing metadata
        metadata: {
          ...nextLessonFocusMeta,
        },
      } as any,
    });

    // ── Notify student — fire-and-forget, non-blocking ───────────────────────
    // Student receives an in-app notification that feedback is ready.
    // The notification links to their progress page.
    // nextLessonFocus is included in the message if set.
    const clientUserId = booking.client?.userId;
    const instructorName = booking.instructor?.name ?? 'Your instructor';
    const clientName = booking.client?.name ?? 'Student';

    if (clientUserId) {
      const focusSnippet = data.nextLessonFocus
        ? ` Focus for next lesson: ${data.nextLessonFocus}.`
        : '';
      createNotification({
        userId: clientUserId,
        type: 'NEW_MESSAGE',
        title: 'Lesson feedback ready',
        message: `${instructorName} has recorded feedback from your lesson.${focusSnippet}`,
        link: '/client-dashboard/progress',
        metadata: {
          bookingId: data.bookingId,
          instructorName,
          nextLessonFocus: data.nextLessonFocus || null,
          isResubmission,
        },
      }).catch(e => console.error('[lesson-feedback] Notification failed (non-critical):', e));
    }

    const summaryForResponse = generateFeedbackSummary(data.feedbackCodes);

    return NextResponse.json({
      success: true,
      isResubmission,
      assessmentType: data.assessmentType,
      summary: {
        focusAreaCount: data.feedbackCodes.length,
        strengthCount: data.studentStrengthCodes.length,
        // Score only returned for MOCK — null for COACHING is intentional
        overallScore,
        passed,
        isScoredAssessment: isMock,
        criticalIssues: summaryForResponse.criticalIssues,
        testReady: isMock ? (passed ?? false) : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Lesson feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');
    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });

    const booking: any = await prisma.booking.findFirst({
      where: { id: bookingId, instructorId: session.user.instructorId },
      select: {
        lessonFeedback: true,
        studentStrengths: true,
        instructorNotes: true,
        performanceScore: true,
        feedbackGivenAt: true,
        assessmentType: true,
        lessonTopics: true,
        passed: true,
        // metadata: true,  // Not in schema - access via (booking as any).metadata
      },
    });
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Extract nextLessonFocus from metadata
    const meta = (booking.metadata as any) ?? {};

    return NextResponse.json({
      ...booking,
      nextLessonFocus: meta.nextLessonFocus ?? null,
    });
  } catch (error) {
    console.error('Get lesson feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



