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

export const dynamic = 'force-dynamic';

// Assessment types — v1 supports COACHING and MOCK only.
// OFFICIAL and future types (HR_MOCK, SCHOOL_CHECKLIST etc.) are added via migration,
// no code change needed — assessmentType is a String, not a DB enum.
const ASSESSMENT_TYPES = ['COACHING', 'MOCK'] as const
type AssessmentType = typeof ASSESSMENT_TYPES[number]

const feedbackSchema = z.object({
  bookingId: z.string(),
  instructorId: z.string(),
  clientId: z.string(),
  feedbackCodes: z.array(z.number()).default([]),
  strengths: z.string().optional().default(''),
  areasToImprove: z.string().optional().default(''),
  instructorNotes: z.string().optional().default(''),
  whiteboardSketchUrl: z.string().url().optional().nullable(),
  assessmentType: z.enum(ASSESSMENT_TYPES).default('COACHING'),
  lessonTopics: z.string().optional().default(''), // comma-separated
  nextLessonFocus: z.string().optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = feedbackSchema.parse(body);

    // Verify booking belongs to this instructor
    const booking = await prisma.booking.findFirst({
      where: { id: data.bookingId, instructorId: session.user.instructorId },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isScoredAssessment = data.assessmentType === 'MOCK'

    // Score is only computed for formal assessments (MOCK/OFFICIAL)
    // COACHING lessons do not produce a score — avoids misleading partial scores
    const categoryScores = isScoredAssessment ? calculateCategoryScores(data.feedbackCodes) : null
    const overallScore = (isScoredAssessment && categoryScores)
      ? calculateOverallScore(categoryScores, data.feedbackCodes)
      : null
    const summary = generateFeedbackSummary(data.feedbackCodes)

    // Determine pass/fail for mock/official: score >= 80 and no critical errors
    const passed = isScoredAssessment && overallScore !== null
      ? overallScore >= 80 && summary.criticalIssues === 0
      : null

    // Combine notes — include next lesson focus for coaching lessons
    const notesParts = [data.strengths, data.areasToImprove, data.instructorNotes]
    if (data.nextLessonFocus) notesParts.push(`Next lesson focus: ${data.nextLessonFocus}`)
    const combinedNotes = notesParts.filter(Boolean).join('\n\n') || null

    await prisma.booking.update({
      where: { id: data.bookingId },
      data: {
        lessonFeedback: data.feedbackCodes,
        instructorNotes: combinedNotes,
        performanceScore: overallScore,
        feedbackGivenAt: new Date(),
        assessmentType: data.assessmentType,
        lessonTopics: data.lessonTopics || null,
        passed,
        ...(data.whiteboardSketchUrl !== undefined && {
          whiteboardSketchUrl: data.whiteboardSketchUrl,
        }),
      } as any,
    });

    return NextResponse.json({
      success: true,
      assessmentType: data.assessmentType,
      summary: {
        ...summary,
        overallScore,
        passed,
        isScoredAssessment,
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

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, instructorId: session.user.instructorId },
      select: {
        lessonFeedback: true,
        instructorNotes: true,
        performanceScore: true,
        feedbackGivenAt: true,
        assessmentType: true,
        lessonTopics: true,
        passed: true,
      },
    });
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Get lesson feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



