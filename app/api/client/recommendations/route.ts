import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/recommendations
 *
 * Returns learning content matched to the student's recent PDA feedback codes.
 * Ranked by: severity weight of matched codes, then frequency of the issue.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.clientId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get last 5 lessons with feedback
    const recentBookings = await prisma.booking.findMany({
      where: {
        clientId: session.user.clientId,
        status: { in: ['COMPLETED', 'CONFIRMED'] },
        NOT: { lessonFeedback: { isEmpty: true } },
      },
      orderBy: { endTime: 'desc' },
      take: 5,
      select: { lessonFeedback: true },
    });

    if (!recentBookings.length) {
      return NextResponse.json({ recommendations: [] });
    }

    // Flatten all codes, count frequency
    const codeFrequency = new Map<number, number>();
    for (const booking of recentBookings) {
      for (const code of (booking.lessonFeedback as number[])) {
        codeFrequency.set(code, (codeFrequency.get(code) ?? 0) + 1);
      }
    }

    const uniqueCodes = Array.from(codeFrequency.keys());
    if (!uniqueCodes.length) {
      return NextResponse.json({ recommendations: [] });
    }

    // Find active content that covers any of these codes
    const content = await prisma.learningContent.findMany({
      where: {
        active: true,
        pdaCodes: { hasSome: uniqueCodes },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Score each content item: sum of frequency for each matched code
    const scored = content.map((item: { pdaCodes: number[]; [key: string]: unknown }) => {
      const matchedCodes = item.pdaCodes.filter((c: number) => uniqueCodes.includes(c));
      const score = matchedCodes.reduce((sum: number, c: number) => sum + (codeFrequency.get(c) ?? 0), 0);
      return { ...item, matchedCodes, relevanceScore: score };
    });

    // Sort by relevance, return top 5
    scored.sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => b.relevanceScore - a.relevanceScore);
    const top = scored.slice(0, 5);

    return NextResponse.json({ recommendations: top });
  } catch (error) {
    console.error('[recommendations] error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
