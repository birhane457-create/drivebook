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
    // Auth boundary fix: do not use session.user.clientId for data access.
    // clientId in the JWT is always clients[0] — wrong for users who have booked
    // with multiple instructors (multiple Client records, different clientIds).
    // Resolve by userId instead, which is stable and unambiguous.
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve all Client records owned by this user (one per instructor they've booked with)
    const clientRecords = await prisma.client.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!clientRecords.length) {
      return NextResponse.json({ recommendations: [] });
    }
    const clientIds = clientRecords.map((c) => c.id);

    // Get last 5 lessons with feedback (PostgreSQL: filter non-empty arrays in JS)
    const recentBookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        status: { in: ['COMPLETED', 'CONFIRMED'] },
      },
      orderBy: { endTime: 'desc' },
      take: 20,
      select: { lessonFeedback: true },
    });

    // Filter to only bookings that have feedback codes
    const bookingsWithFeedback = recentBookings.filter(
      (b) => (b.lessonFeedback as number[]).length > 0
    ).slice(0, 5);

    if (!recentBookings.length) {
      return NextResponse.json({ recommendations: [] });
    }

    // Flatten all codes, count frequency
    const codeFrequency = new Map<number, number>();
    for (const booking of bookingsWithFeedback) {
      for (const code of (booking.lessonFeedback as number[])) {
        codeFrequency.set(code, (codeFrequency.get(code) ?? 0) + 1);
      }
    }

    const uniqueCodes = Array.from(codeFrequency.keys());
    if (!uniqueCodes.length) {
      return NextResponse.json({ recommendations: [] });
    }

    // Find active content — fetch all active, filter by matching codes in JS
    // (hasSome is MongoDB-only; PostgreSQL array overlap requires raw SQL or JS filter)
    const allContent = await prisma.learningContent.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    const content = allContent.filter((item) =>
      (item.pdaCodes as number[]).some((c) => uniqueCodes.includes(c))
    );

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
