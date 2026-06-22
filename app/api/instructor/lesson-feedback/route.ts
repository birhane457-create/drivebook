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

const feedbackSchema = z.object({
  bookingId: z.string(),
  instructorId: z.string(),
  clientId: z.string(),
  feedbackCodes: z.array(z.number()).default([]),
  strengths: z.string().optional().default(''),
  areasToImprove: z.string().optional().default(''),
  instructorNotes: z.string().optional().default(''),
  whiteboardSketchUrl: z.string().url().optional().nullable(),
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

    const categoryScores = calculateCategoryScores(data.feedbackCodes);
    const overallScore = calculateOverallScore(categoryScores);
    const summary = generateFeedbackSummary(data.feedbackCodes);

    // Store feedback on the booking record
    await prisma.booking.update({
      where: { id: data.bookingId },
      data: {
        lessonFeedback: data.feedbackCodes,
        instructorNotes: [data.strengths, data.areasToImprove, data.instructorNotes]
          .filter(Boolean)
          .join('\n\n') || null,
        performanceScore: overallScore,
        feedbackGivenAt: new Date(),
        ...(data.whiteboardSketchUrl !== undefined && {
          whiteboardSketchUrl: data.whiteboardSketchUrl,
        }),
      } as any,
    });

    return NextResponse.json({ success: true, summary: { ...summary, overallScore } });
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
      },
    });
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Get lesson feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
